# 🎓 Complete Beginner's Guide: Building a Kimi AI Gateway

> **For people who have never coded before**

This guide explains how we built this project from scratch, in simple terms anyone can understand.

---

## 🤔 What Did We Build?

Imagine you have a powerful AI service (Kimi AI) that speaks one language, and you have apps that speak a different language (OpenAI format). We built a **translator** that sits in the middle and helps them talk to each other.

**Real-world analogy:**
- Kimi AI = A Japanese restaurant
- Your apps = English-speaking customers
- Our gateway = A translator who helps customers order food

---

## 🧩 The Building Blocks

### 1. **Deno** - The Foundation
Think of Deno as the "engine" that runs our code. It's like:
- Microsoft Word runs documents
- Chrome runs websites
- **Deno runs TypeScript/JavaScript code**

**Why Deno?**
- It's modern and secure
- No complicated setup
- Works the same everywhere (your computer, cloud servers)

### 2. **TypeScript** - The Language
TypeScript is the language we wrote our instructions in. It's like English, but for computers.

```typescript
// This is TypeScript - it tells the computer what to do
const greeting = "Hello!";
console.log(greeting); // Shows "Hello!" on screen
```

### 3. **GitHub** - The Storage
GitHub is like Google Drive, but for code. It:
- Stores your code online
- Tracks every change you make
- Lets others see and use your code

### 4. **Deno Deploy** - The Cloud Server
This is where your code lives and runs 24/7. It's like:
- Renting a computer that never turns off
- Anyone can access it from anywhere
- You don't have to maintain it

---

## 📝 How We Built It (Step by Step)

### Step 1: Understanding the Problem

**The Challenge:**
- Kimi AI has its own special way of receiving requests
- Most AI apps are built for OpenAI's format
- We need to convert between the two

**The Solution:**
Build a "middleman" service that:
1. Receives requests in OpenAI format
2. Translates them to Kimi format
3. Sends to Kimi AI
4. Gets the response
5. Translates back to OpenAI format
6. Returns to the user

### Step 2: Writing the Code

Our code has 4 main parts:

#### Part 1: Configuration (Settings)
```typescript
const settings = {
  API_MASTER_KEY: "your-secret-password",
  PORT: 8088,
  // ... other settings
};
```
This is like setting up preferences - what password to use, which port to listen on, etc.

#### Part 2: The Translator Functions
```typescript
function createChatCompletionChunk(requestId, model, content) {
  // Takes Kimi's response and formats it like OpenAI
  return {
    id: requestId,
    model: model,
    choices: [{ delta: { content: content } }]
  };
}
```
These functions convert data from one format to another.

#### Part 3: The Kimi AI Handler
```typescript
class KimiAIProvider {
  // This class handles all communication with Kimi AI
  // - Gets security tokens (nonce)
  // - Sends requests
  // - Manages conversation history
}
```
Think of this as the "brain" that knows how to talk to Kimi AI.

**📖 Deep Dive: Understanding the Kimi AI Handler**

This is the most complex part of our code. Let's break it down piece by piece:

##### What is a "Class"?

A class is like a blueprint for creating objects. Think of it like:
- **Blueprint for a car** = Class
- **Your actual car** = Object created from that class

```typescript
class KimiAIProvider {
  // Properties (data the class stores)
  private sessionCache = new Map();
  private nonce = null;
  
  // Methods (actions the class can do)
  async fetchNonce() { ... }
  async chatCompletion() { ... }
}
```

##### The Five Main Jobs of KimiAIProvider:

**Job 1: Getting Security Tokens (Nonce)**

```typescript
private async fetchNonce(): Promise<string> {
  // 1. Visit Kimi AI's website
  const response = await fetch("https://kimi-ai.chat/chat/");
  
  // 2. Read the HTML page
  const htmlContent = await response.text();
  
  // 3. Find the security token hidden in the page
  const match = htmlContent.match(/var kimi_ajax = ({.*?});/);
  
  // 4. Extract the nonce value
  const nonce = ajaxData.nonce;
  
  return nonce;
}
```

**Why do we need a nonce?**
- Kimi AI uses it to prevent fake/malicious requests
- It's like a temporary password that changes frequently
- We need to fetch a fresh one from their website

**Real-world analogy:**
Imagine going to a concert:
- You can't just walk in (no nonce)
- You need to get a wristband at the entrance (fetch nonce)
- The wristband proves you're allowed in (use nonce in requests)
- Wristbands expire after the concert (nonce expires)

**Job 2: Managing Conversation History**

```typescript
private getOrCreateSession(userKey: string): any {
  // Check if this user already has a conversation going
  if (this.sessionCache.has(userKey)) {
    return this.sessionCache.get(userKey).data;
  }
  
  // If not, create a new conversation for them
  const newSession = {
    kimi_session_id: `session_${timestamp}_${randomStr}`,
    messages: [] // Empty conversation history
  };
  
  // Store it for later
  this.sessionCache.set(userKey, newSession);
  
  return newSession;
}
```

**Why manage sessions?**
- So the AI remembers previous messages in the conversation
- Each user gets their own separate conversation
- Like having multiple chat windows open at once

**Real-world analogy:**
Think of a phone with multiple text conversations:
- Each contact has their own chat thread (session)
- You can see previous messages in each thread (history)
- Messages don't mix between different contacts (separate sessions)

**Visual representation:**
```
User "Alice" → Session 1 → [
  "Hello",
  "What's the weather?",
  "Thanks!"
]

User "Bob" → Session 2 → [
  "Hi there",
  "Tell me a joke"
]
```

**Job 3: Building Context-Aware Prompts**

```typescript
private buildContextualPrompt(history, newMessage): string {
  // Take all previous messages
  const historyLines = history.map(msg => {
    const role = msg.role === "user" ? "User" : "Model";
    return `${role}: ${msg.content}`;
  });
  
  // Add the new message
  // Combine everything into one big prompt
  return [...historyLines, `User: ${newMessage}`].join("\n");
}
```

**Example transformation:**
```
Input (separate messages):
[
  { role: "user", content: "What's 2+2?" },
  { role: "assistant", content: "4" },
  { role: "user", content: "What about 3+3?" }
]

Output (combined prompt):
"User: What's 2+2?
Model: 4
User: What about 3+3?"
```

**Why do this?**
- Kimi AI needs context to give relevant answers
- Without history, it wouldn't know "What about 3+3?" refers to math
- It's like reminding someone of the entire conversation so far

**Job 4: Preparing Requests for Kimi AI**

```typescript
private preparePayload(prompt, model, sessionId, nonce): URLSearchParams {
  // Convert our model name to Kimi's format
  let upstreamModel;
  if (model === "kimi-k2-instruct-0905") {
    upstreamModel = "moonshotai/Kimi-K2-Instruct-0905";
  }
  
  // Package everything Kimi AI expects
  return new URLSearchParams({
    action: "kimi_send_message",
    nonce: nonce,              // Security token
    message: prompt,           // The actual question
    model: upstreamModel,      // Which AI model to use
    session_id: sessionId      // Which conversation this belongs to
  });
}
```

**What's URLSearchParams?**
It formats data like a web form:
```
action=kimi_send_message&nonce=abc123&message=Hello&model=...
```

Like filling out a form on a website, but in code.

**Job 5: Handling the Actual Chat Request**

```typescript
async chatCompletion(request: Request): Promise<Response> {
  // 1. Parse the incoming request
  const { messages, user, model } = await request.json();
  
  // 2. Validate the request
  if (!messages || messages.length === 0) {
    return new Response("Error: No messages", { status: 400 });
  }
  
  // 3. Get or create a session for this user
  const sessionData = this.getOrCreateSession(user);
  
  // 4. Build the prompt with history
  const promptToSend = this.buildContextualPrompt(
    sessionData.messages, 
    currentUserMessage.content
  );
  
  // 5. Get a fresh nonce
  const nonce = await this.getNonce();
  
  // 6. Prepare the request for Kimi
  const payload = this.preparePayload(promptToSend, model, sessionId, nonce);
  
  // 7. Send to Kimi AI
  const response = await fetch("https://kimi-ai.chat/...", {
    method: "POST",
    body: payload
  });
  
  // 8. Get the response
  const responseData = await response.json();
  const aiMessage = responseData.data.message;
  
  // 9. Save to conversation history
  sessionData.messages.push(currentUserMessage);
  sessionData.messages.push({ role: "assistant", content: aiMessage });
  
  // 10. Stream the response back to the user
  // (character by character for that typing effect)
  for (const char of aiMessage) {
    controller.enqueue(char);
    await delay(20);
  }
}
```

**Step-by-step flow:**

```
1. User sends: "What's the weather?"
   ↓
2. Check if user has existing conversation
   ↓
3. Build full context: "User: What's the weather?"
   ↓
4. Get security token from Kimi's website
   ↓
5. Package everything in Kimi's format
   ↓
6. Send to Kimi AI servers
   ↓
7. Kimi responds: "I don't have real-time weather data..."
   ↓
8. Save both messages to conversation history
   ↓
9. Stream response back: "I" → " " → "d" → "o" → "n" → "'" → "t" → ...
   ↓
10. User sees the response appear character by character
```

##### Error Handling & Retry Logic

```typescript
const makeRequest = async (isRetry = false): Promise<string | null> => {
  try {
    // Try to send the request
    const nonce = await this.getNonce(isRetry);
    const response = await fetch(...);
    return response.data.message;
  } catch (error) {
    // If it fails and we haven't retried yet
    if (!isRetry) {
      console.warn("Attempting to refresh nonce and retry...");
      return await makeRequest(true); // Try again with fresh nonce
    }
    return null; // Give up after one retry
  }
};
```

**Why retry?**
- The nonce might have expired
- Network might have hiccuped
- Gives the request a second chance before failing

**Real-world analogy:**
Like calling someone:
- First call: No answer (maybe they're busy)
- Wait a moment
- Second call: They pick up!
- If still no answer, leave a voicemail (return error)

##### Memory Management (Session Cache)

```typescript
// Set a timer to delete old sessions
const timeoutId = setTimeout(() => {
  this.sessionCache.delete(userKey);
  console.log(`Session '${userKey}' has expired and been cleared.`);
}, settings.SESSION_CACHE_TTL); // Default: 1 hour
```

**Why delete old sessions?**
- Saves memory (RAM)
- Prevents the server from getting overloaded
- Old conversations aren't useful after a while

**Visual representation:**
```
Time: 0:00 → User starts conversation → Session created
Time: 0:30 → User sends more messages → Session still active
Time: 1:00 → Timer expires → Session deleted
Time: 1:01 → User sends message → New session created
```

##### The Complete Picture

Here's how all the pieces work together:

```
┌─────────────────────────────────────────────────────────┐
│                   KimiAIProvider                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐      ┌──────────────┐               │
│  │ Session      │      │ Nonce        │               │
│  │ Manager      │      │ Manager      │               │
│  │              │      │              │               │
│  │ - Store      │      │ - Fetch      │               │
│  │   history    │      │ - Cache      │               │
│  │ - Expire     │      │ - Refresh    │               │
│  │   old ones   │      │              │               │
│  └──────────────┘      └──────────────┘               │
│         │                      │                       │
│         └──────────┬───────────┘                       │
│                    │                                   │
│         ┌──────────▼──────────┐                        │
│         │  Request Builder    │                        │
│         │                     │                        │
│         │  - Combine history  │                        │
│         │  - Format payload   │                        │
│         │  - Add nonce        │                        │
│         └──────────┬──────────┘                        │
│                    │                                   │
│         ┌──────────▼──────────┐                        │
│         │  HTTP Client        │                        │
│         │                     │                        │
│         │  - Send to Kimi     │                        │
│         │  - Handle errors    │                        │
│         │  - Retry if needed  │                        │
│         └──────────┬──────────┘                        │
│                    │                                   │
│         ┌──────────▼──────────┐                        │
│         │  Response Handler   │                        │
│         │                     │                        │
│         │  - Parse response   │                        │
│         │  - Update history   │                        │
│         │  - Stream to user   │                        │
│         └─────────────────────┘                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

##### Key Takeaways

1. **The class is organized** - Each method has one clear job
2. **It's stateful** - Remembers conversations and nonces
3. **It's resilient** - Retries on failure, handles errors
4. **It's efficient** - Caches nonces, expires old sessions
5. **It's a translator** - Converts between OpenAI and Kimi formats

This is the heart of our entire application!

#### Part 4: The Web Server
```typescript
Deno.serve({ port: 8088 }, async (req) => {
  // Listen for incoming requests
  // Check if they have the right password
  // Route them to the right handler
  // Send back the response
});
```
This is like a receptionist - it receives visitors (requests) and directs them to the right place.

### Step 3: Configuration Files

#### `deno.json` - Project Settings
```json
{
  "tasks": {
    "start": "deno run --allow-net --allow-env --env-file=.env main.ts"
  }
}
```
This tells Deno:
- What command to run to start the app
- What permissions to give (network access, environment variables)

#### `.env` - Secret Settings
```
API_MASTER_KEY=1
PORT=8088
SESSION_CACHE_TTL=3600
```
This file stores sensitive information like passwords and settings.

#### `.gitignore` - What NOT to Upload
```
.env.local
.env.production
```
Tells Git to ignore certain files (like local secrets) when uploading to GitHub.

### Step 4: Uploading to GitHub

We used Git commands to save and upload our code:

```bash
git init                    # Start tracking changes
git add .                   # Select all files to upload
git commit -m "message"     # Save a snapshot with a description
git push                    # Upload to GitHub
```

Think of it like:
- `git add` = Put files in a box
- `git commit` = Seal the box and label it
- `git push` = Ship the box to GitHub

### Step 5: Deploying to Deno Deploy

1. **Connected GitHub to Deno Deploy**
   - Logged in with GitHub account
   - Gave Deno Deploy permission to read our code

2. **Created a Project**
   - Clicked "New Project"
   - Selected our repository
   - Chose `main.ts` as the entry file

3. **Set Environment Variables**
   - Added `API_MASTER_KEY` in the dashboard
   - Deno Deploy reads these instead of the `.env` file

4. **Automatic Deployment**
   - Every time we push to GitHub
   - Deno Deploy automatically updates the live site
   - No manual work needed!

---

## 🔧 How It Works (When Someone Uses It)

Let's trace what happens when someone sends a message:

### 1. User Sends Request
```
User's App → https://your-project.deno.dev/v1/chat/completions
```
The user's app sends a message in OpenAI format.

### 2. Our Gateway Receives It
```typescript
// Check password
if (token !== settings.API_MASTER_KEY) {
  return "Invalid API Key";
}
```
First, we check if they have the right password.

### 3. Convert to Kimi Format
```typescript
const payload = {
  action: "kimi_send_message",
  nonce: securityToken,
  message: userMessage,
  model: "moonshotai/Kimi-K2-Instruct-0905"
};
```
We translate the OpenAI format to what Kimi expects.

### 4. Send to Kimi AI
```typescript
const response = await fetch("https://kimi-ai.chat/...", {
  method: "POST",
  body: payload
});
```
We send the translated request to Kimi AI.

### 5. Get Response
```
Kimi AI → "Hello! How can I help you today?"
```
Kimi AI sends back its response.

### 6. Convert Back to OpenAI Format
```typescript
const chunk = {
  id: "chatcmpl-123",
  object: "chat.completion.chunk",
  choices: [{ delta: { content: "Hello!" } }]
};
```
We translate Kimi's response back to OpenAI format.

### 7. Stream to User
```typescript
for (const char of response) {
  controller.enqueue(char); // Send one character at a time
  await delay(20); // Small delay for typewriter effect
}
```
We send the response back character by character (streaming).

---

## 🎯 Key Concepts Explained

### What is an API?
**API = Application Programming Interface**

Think of it like a restaurant menu:
- The menu shows what you can order (available functions)
- You place an order (make a request)
- The kitchen prepares it (processes the request)
- You get your food (receive the response)

### What is HTTP?
**HTTP = How computers talk to each other over the internet**

Like sending letters:
- **GET** = "Please send me information"
- **POST** = "Here's some information, do something with it"
- **Headers** = The envelope (contains metadata)
- **Body** = The letter content (the actual data)

### What is JSON?
**JSON = A way to structure data**

```json
{
  "name": "John",
  "age": 30,
  "hobbies": ["reading", "coding"]
}
```

It's like filling out a form with labeled fields. Computers love it because it's organized and easy to read.

### What is Streaming?
Instead of waiting for the entire response, we send it piece by piece:

**Non-streaming:**
```
[Wait 5 seconds...]
"Hello! How can I help you today?"
```

**Streaming:**
```
"H" → "e" → "l" → "l" → "o" → "!" → ...
```

Like watching a video while it downloads vs waiting for the full download.

### What is Environment Variables?
Secret settings that change based on where the code runs:

**On your computer:**
```
API_KEY=test-key-123
```

**On production server:**
```
API_KEY=real-secret-key-xyz
```

Same code, different settings!

---

## 🛠️ Tools We Used

### 1. **Code Editor (Kiro/VS Code)**
Where we write code. Like Microsoft Word, but for code.

### 2. **Terminal/Command Line**
A text-based way to control your computer. Instead of clicking, you type commands:
```bash
deno run main.ts  # Run the program
git push          # Upload to GitHub
```

### 3. **Git**
Tracks every change to your code. Like "Track Changes" in Word, but much more powerful.

### 4. **GitHub**
Online storage for code. Like Dropbox, but designed for developers.

### 5. **Deno Deploy**
Cloud hosting service. Runs your code 24/7 on powerful servers.

---

## 📚 What You Learned

By building this project, you learned:

1. **Basic Programming Concepts**
   - Variables (storing data)
   - Functions (reusable code blocks)
   - Classes (organizing related code)
   - Async/Await (handling delays)

2. **Web Development**
   - HTTP requests and responses
   - APIs and endpoints
   - Authentication (passwords/keys)
   - Streaming data

3. **DevOps (Deployment)**
   - Version control with Git
   - Cloud deployment
   - Environment variables
   - Continuous deployment

4. **Problem Solving**
   - Breaking big problems into small steps
   - Debugging errors
   - Reading documentation
   - Testing and iteration

---

## 🚀 Next Steps

### If You Want to Learn More:

1. **Learn JavaScript/TypeScript Basics**
   - [JavaScript.info](https://javascript.info) - Free, comprehensive
   - [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

2. **Learn Web APIs**
   - [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API)
   - Build simple REST APIs

3. **Learn Deno**
   - [Deno Manual](https://deno.land/manual)
   - [Deno by Example](https://examples.deno.land)

4. **Practice Projects**
   - Build a weather API wrapper
   - Create a URL shortener
   - Make a simple chatbot

### Modify This Project:

1. **Add Features**
   - Add rate limiting (prevent abuse)
   - Add logging (track usage)
   - Add more AI providers (Claude, GPT-4)

2. **Improve It**
   - Add a web interface
   - Add user accounts
   - Add usage statistics

3. **Deploy Elsewhere**
   - Try Railway, Fly.io, or Cloudflare Workers
   - Self-host on a VPS
   - Run it on your own computer

---

## 💡 Common Questions

### "I don't understand the code!"
That's normal! Programming is like learning a new language. Start with:
1. Understanding what each section does (high-level)
2. Then dive into individual functions
3. Look up terms you don't know
4. Experiment by changing small things

### "How long does it take to learn this?"
- **Basic understanding**: 1-2 weeks
- **Build simple projects**: 1-3 months
- **Build complex projects**: 6-12 months
- **Professional level**: 1-2 years

Everyone learns at their own pace!

### "Do I need to memorize everything?"
No! Professional developers Google things constantly. Focus on:
- Understanding concepts
- Knowing what's possible
- Learning how to find answers

### "What if I break something?"
That's how you learn! With Git, you can always undo changes:
```bash
git reset --hard HEAD  # Undo all changes
```

---

## 🎉 Congratulations!

You've successfully:
- ✅ Built a real, working API gateway
- ✅ Deployed it to the cloud
- ✅ Made it accessible worldwide
- ✅ Learned fundamental programming concepts

This is a significant achievement! Many "beginners" never get this far. You should be proud.

**Remember:** Every expert was once a beginner. Keep learning, keep building, and don't be afraid to make mistakes!

---

## 📞 Need Help?

- **GitHub Issues**: Report bugs or ask questions
- **Deno Discord**: Active community of helpful developers
- **Stack Overflow**: Search for specific error messages
- **Documentation**: Always read the official docs first

Happy coding! 🚀
