// main.ts (v1.1 - Syntax errors fixed)

// Import necessary modules from Deno standard library
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// --- 1. Configuration Module (equivalent to app/core/config.py and .env) ---

// Dynamically load environment variables from .env file
// Using `deno run --load` flag at startup is more modern, but this provides in-code loading as backup
await load({ export: true });

const settings = {
  APP_NAME: "kimi-ai-2api-deno",
  APP_VERSION: "1.0.0",
  DESCRIPTION: "A high-performance Deno proxy that converts kimi-ai.chat to OpenAI-compatible API format.",

  // Read from environment variables, provide default values
  API_MASTER_KEY: Deno.env.get("API_MASTER_KEY") || "sk-kimi-ai-2api-default-key-please-change-me",
  PORT: parseInt(Deno.env.get("PORT") || "8088", 10),
  SESSION_CACHE_TTL: parseInt(Deno.env.get("SESSION_CACHE_TTL") || "3600", 10) * 1000, // Convert to milliseconds

  // Kimi upstream service configuration
  UPSTREAM_URL: "https://kimi-ai.chat/wp-admin/admin-ajax.php",
  CHAT_PAGE_URL: "https://kimi-ai.chat/chat/",
  
  // List of supported models
  KNOWN_MODELS: ["kimi-k2-instruct-0905", "kimi-k2-instruct"],
  DEFAULT_MODEL: "kimi-k2-instruct-0905",
};

// --- 2. SSE Utility Functions (equivalent to app/utils/sse_utils.py) ---

const encoder = new TextEncoder();
const DONE_CHUNK = encoder.encode("data: [DONE]\n\n");

function createSSEData(data: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function createChatCompletionChunk(
  requestId: string,
  model: string,
  content: string,
  finishReason: string | null = null
): Record<string, unknown> {
  return {
    id: requestId,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [
      {
        index: 0,
        delta: { content: content },
        finish_reason: finishReason,
      },
    ],
  };
}

// --- 3. Core Service Provider (equivalent to app/providers/kimi_ai_provider.py) ---

class KimiAIProvider {
  private sessionCache = new Map<string, any>();
  private nonce: string | null = null;
  private noncePromise: Promise<string> | null = null;

  constructor() {
    console.info("Initializing KimiAIProvider, fetching nonce for the first time...");
    this.getNonce().catch(err => console.error("Failed to initialize nonce:", err));
  }

  private async fetchNonce(): Promise<string> {
    try {
      console.info("Fetching new nonce from upstream page...");
      const response = await fetch(settings.CHAT_PAGE_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch upstream page, status code: ${response.status}`);
      }

      const htmlContent = await response.text();
      const match = htmlContent.match(/var kimi_ajax = ({.*?});/);
      if (!match || !match[1]) {
        throw new Error("'kimi_ajax' JS variable not found in page HTML.");
      }

      const ajaxData = JSON.parse(match[1]);
      const nonce = ajaxData.nonce;
      if (!nonce) {
        throw new Error("'nonce' field missing in 'kimi_ajax' object.");
      }

      console.log(`Successfully fetched new nonce: ${nonce}`);
      return nonce;
    } catch (error) {
      console.error(`Failed to fetch nonce: ${error.message}`);
      throw new Error(`Unable to get necessary dynamic parameters from upstream service: ${error.message}`);
    }
  }

  private getNonce(forceRefresh = false): Promise<string> {
    if (!this.noncePromise || forceRefresh) {
      this.noncePromise = this.fetchNonce().then(nonce => {
        this.nonce = nonce;
        return nonce;
      }).catch(err => {
        this.noncePromise = null; // Allow retry on failure
        throw err;
      });
    }
    return this.noncePromise;
  }

  private getOrCreateSession(userKey: string): any {
    if (this.sessionCache.has(userKey)) {
      return this.sessionCache.get(userKey).data;
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 11);
    const newSessionId = `session_${timestamp}_${randomStr}`;

    const newSession = {
      kimi_session_id: newSessionId,
      messages: [],
    };

    const timeoutId = setTimeout(() => {
      this.sessionCache.delete(userKey);
      console.log(`Session '${userKey}' has expired and been cleared.`);
    }, settings.SESSION_CACHE_TTL);

    this.sessionCache.set(userKey, { data: newSession, timeoutId });
    console.info(`Created new session for user '${userKey}': ${newSessionId}`);
    return newSession;
  }

  private buildContextualPrompt(history: { role: string; content: string }[], newMessage: string): string {
    const historyLines = history.map(msg => {
      const role = msg.role === "user" ? "User" : "Model";
      return `${role}: ${msg.content}`;
    });
    return [...historyLines, `User: ${newMessage}`].join("\n").trim();
  }

  private preparePayload(prompt: string, model: string, sessionId: string, nonce: string): URLSearchParams {
    let upstreamModel: string;
    if (model === "kimi-k2-instruct-0905") {
      upstreamModel = "moonshotai/Kimi-K2-Instruct-0905";
    } else if (model === "kimi-k2-instruct") {
      upstreamModel = "moonshotai/Kimi-K2-Instruct";
    } else {
      throw new Error(`Unsupported model: ${model}`);
    }

    return new URLSearchParams({
      action: "kimi_send_message",
      nonce: nonce,
      message: prompt,
      model: upstreamModel,
      session_id: sessionId,
    });
  }

  async getModels(): Promise<Response> {
    const modelData = {
      object: "list",
      data: settings.KNOWN_MODELS.map(name => ({
        id: name,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "lzA6",
      })),
    };
    return new Response(JSON.stringify(modelData), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async chatCompletion(request: Request): Promise<Response> {
    const requestData = await request.json();
    const { messages, user, model = settings.DEFAULT_MODEL } = requestData;

    if (!messages || !Array.isArray(messages) || messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return new Response(JSON.stringify({ error: "'messages' list cannot be empty, and the last message must be from user role." }), { status: 400 });
    }

    const currentUserMessage = messages[messages.length - 1];
    let sessionData: any;
    let promptToSend: string;
    let kimiSessionId: string;

    if (user) {
      console.info(`Detected 'user' field, entering stateful mode. User: ${user}`);
      sessionData = this.getOrCreateSession(user);
      promptToSend = this.buildContextualPrompt(sessionData.messages, currentUserMessage.content);
      kimiSessionId = sessionData.kimi_session_id;
    } else {
      console.info("No 'user' field detected, entering stateless mode.");
      promptToSend = currentUserMessage.content;
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 11);
      kimiSessionId = `session_${timestamp}_${randomStr}`;
    }

    const requestId = `chatcmpl-${crypto.randomUUID()}`;

    const stream = new ReadableStream({
      start: async (controller) => { // <--- This is the key fix point
        const makeRequest = async (isRetry = false): Promise<string | null> => {
          try {
            const nonce = await this.getNonce(isRetry);
            const payload = this.preparePayload(promptToSend, model, kimiSessionId, nonce);

            console.info(`Sending request to upstream, Session ID: ${kimiSessionId}, Model: ${model}`);
            
            const response = await fetch(settings.UPSTREAM_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
              },
              body: payload,
            });

            if (!response.ok) throw new Error(`Upstream API error, status code: ${response.status}`);

            const responseData = await response.json();
            if (!responseData.success) {
              throw new Error(`Upstream request failed: ${responseData.data || "Unknown error"}`);
            }
            return responseData.data?.message || "";
          } catch (error) {
            console.error(`Error requesting upstream service: ${error.message}`);
            if (!isRetry) {
              console.warn("Attempting to refresh nonce and retry...");
              return await makeRequest(true);
            }
            return null; // Return null after retry failure
          }
        };

        const assistantResponseContent = await makeRequest();

        if (assistantResponseContent === null) {
            const errorChunk = createChatCompletionChunk(requestId, model, "Upstream request still failed after retry", "stop");
            controller.enqueue(createSSEData(errorChunk));
            controller.enqueue(DONE_CHUNK);
            controller.close();
            return;
        }

        if (sessionData) {
          sessionData.messages.push(currentUserMessage);
          sessionData.messages.push({ role: "assistant", content: assistantResponseContent });
          console.info(`Session '${user}' context has been updated.`);
        }

        // Pseudo-streaming generation
        for (const char of assistantResponseContent) {
          const chunk = createChatCompletionChunk(requestId, model, char);
          controller.enqueue(createSSEData(chunk));
          await new Promise(resolve => setTimeout(resolve, 20)); // Simulate typewriter effect
        }

        const finalChunk = createChatCompletionChunk(requestId, model, "", "stop");
        controller.enqueue(createSSEData(finalChunk));
        controller.enqueue(DONE_CHUNK);
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }
}


// --- 4. HTTP Server and Routing (equivalent to main.py and nginx.conf) ---

const provider = new KimiAIProvider();

console.info(`${settings.APP_NAME} v${settings.APP_VERSION} starting...`);

Deno.serve({ port: settings.PORT }, async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Security check (equivalent to verify_api_key)
  if (settings.API_MASTER_KEY && settings.API_MASTER_KEY !== "1") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ detail: "Bearer Token authentication required." }), { status: 401 });
    }
    const token = authHeader.substring(7);
    if (token !== settings.API_MASTER_KEY) {
      return new Response(JSON.stringify({ detail: "Invalid API Key." }), { status: 403 });
    }
  }

  // Routing
  if (pathname === "/v1/chat/completions" && req.method === "POST") {
    return await provider.chatCompletion(req);
  }

  if (pathname === "/v1/models" && req.method === "GET") {
    return await provider.getModels();
  }

  if (pathname === "/" && req.method === "GET") {
    return new Response(
        JSON.stringify({ message: `Welcome to ${settings.APP_NAME} v${settings.APP_VERSION}. Service is running normally.` }),
        { headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ detail: "Not Found" }), { status: 404 });
});

console.info(`Service started, listening on http://localhost:${settings.PORT}`);
