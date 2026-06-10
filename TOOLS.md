# Tool Interception System — From First Principles

This document explains exactly what was built, why every piece exists, and how it all connects.
Written as if you are implementing tool interception for the first time.

---

## The Problem We Were Solving

When an AI agent runs, it can call tools (like running shell commands, reading files, writing files).
The original code just ran those tools directly — no permission, no logging, no way to stop dangerous commands.

**The goal:** Before a tool runs, pause and ask the user. After it runs, record what happened.

---

## Step 1 — What is a "Tool Call"?

Before writing any logic, we need to name the thing we are working with.

When the AI decides to call a tool, it sends back something like:

```json
{
  "name": "zsh",
  "args": { "comand": "rm -rf /" }
}
```

This is a **ToolCall** — the runtime instruction from the AI, not a definition.

We added this type to `utils/tools.ts`:

```ts
// The runtime shape of a tool call from the AI
export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};
```

Why a separate type? Because `Ttool` (which was already there) describes the **schema** of a tool — what parameters it accepts, what it is called. `ToolCall` describes a **live call** — the actual name and actual argument values sent by the AI at runtime.

Two different things. Two different types.

---

## Step 2 — What is a Hook?

A **hook** is a function that gets called automatically at a specific moment.

We needed two moments:
- **Before** the tool runs → to decide if we should allow or deny it
- **After** the tool runs → to log or audit what happened

That gives us two kinds of hooks:

```ts
// A PreHook can return "allow" or "deny"
export type PreHook = (context: HookContext) => "allow" | "deny" | void | Promise<...>;

// A PostHook just observes — it cannot stop the tool
export type PostHook = (context: HookContext) => void | Promise<void>;
```

Why does `PreHook` return a string but `PostHook` returns void? Because the pre-hook has **power** — it makes a decision. The post-hook is just an **observer** — it sees what happened but cannot change it.

---

## Step 3 — What is HookContext?

Every hook receives a **context** object. This is the information the hook needs to do its job.

```ts
export type HookContext = {
  tool: ToolCall;    // which tool was called, with what args
  result?: unknown;  // what the tool returned (only available in PostHooks)
};
```

Why `result?` is optional: When a PreHook runs, the tool has not executed yet — so there is no result. The `?` marks it as possibly missing. When the PostHook runs, the result is filled in.

---

## Step 4 — The `Hooks` Container

We need somewhere to store our hooks. That is the `Hooks` type:

```ts
export type Hooks = {
  pre: PreHook[];   // array of pre-hooks
  post: PostHook[]; // array of post-hooks
};
```

Why arrays? Because you might want **multiple** hooks for the same moment. Example: one hook checks permission, another hook logs to a file, another sends a Slack alert. Arrays let you stack them all.

---

## Step 5 — Managing the Arrays

We created four functions to manage these arrays cleanly:

### `createHooks()` — initialize an empty container

```ts
export function createHooks(): Hooks {
  return { pre: [], post: [] };
}
```

Why not just write `{ pre: [], post: [] }` directly? You could. But `createHooks()` gives it a name, makes it findable, and in future could add default hooks automatically.

### `addPreHook()` and `addPostHook()` — add to the arrays

```ts
export function addPreHook(hooks: Hooks, hook: PreHook) {
  hooks.pre.push(hook); // push the function into the pre array
}

export function addPostHook(hooks: Hooks, hook: PostHook) {
  hooks.post.push(hook);
}
```

Why functions instead of doing `hooks.pre.push(...)` directly in your code?
Because if you always use `addPreHook`, you have one place to change if you later want to validate hooks, deduplicate them, or log that a hook was registered.

---

## Step 6 — Firing the Hooks

Having hooks in arrays is useless unless something runs them.

### `firePreHooks()` — run all pre-hooks, stop at first "deny"

```ts
export async function firePreHooks(
  hooks: Hooks | undefined,
  context: HookContext,
): Promise<HookDecision> {
  for (const hook of hooks?.pre ?? []) {
    if ((await hook(context)) === "deny") {
      return "deny"; // stop immediately, do not run remaining hooks
    }
  }
  return "allow"; // all hooks passed
}
```

Why loop and stop at first deny? Same logic as a security checkpoint — if any guard says NO, you don't keep asking the others. The first `"deny"` is enough.

The `hooks?.pre ?? []` part: `?.` means "if hooks is undefined, stop here", `?? []` means "if the result is null/undefined, use empty array instead". Together they mean: even if you pass no hooks at all, this function won't crash.

### `firePostHooks()` — run all post-hooks, always

```ts
export async function firePostHooks(
  hooks: Hooks | undefined,
  context: HookContext,
) {
  for (const hook of hooks?.post ?? []) {
    await hook(context); // run every post-hook, no early exit
  }
}
```

Why no early exit here? Post-hooks are observers. If one logger fails, the others should still run. Each one is independent.

---

## Step 7 — The Tool Dispatcher

The dispatcher is the function that actually runs a tool. It is where all the pieces connect:

```ts
async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  hooks: Hooks,          // hooks are passed in from outside
): Promise<string> {

  // 1. Build context — one object that travels through the whole flow
  const context: HookContext = { tool: { name, args } };

  // 2. Fire pre-hooks — they decide if we proceed
  const decision = await firePreHooks(hooks, context);
  if (decision === "deny") {
    return JSON.stringify({ success: false, errorMessage: "Blocked by pre-hook." });
  }

  // 3. Run the actual tool
  let result: unknown;
  if (name === "zsh") {
    result = await bashTool(args.comand as string);
  } else if (name === "file_write") {
    result = await writeFileTool(args.fileName as string, args.content as string);
  } else if (name === "read_write") {
    result = await readFileTool(args.fileName as string);
  } else {
    result = { success: false, errorMessage: `Unknown tool: ${name}` };
  }

  // 4. Attach result to context so post-hooks can see it
  context.result = result;

  // 5. Fire post-hooks — they observe the result
  await firePostHooks(hooks, context);

  // 6. Return result as a JSON string (what the AI receives)
  return JSON.stringify(result);
}
```

Why is `result` declared with `let` instead of `const`? Because we don't know it yet when we declare it — we fill it in after figuring out which tool to run. `let` allows reassignment; `const` does not.

Why does `dispatchTool` take `hooks` as a parameter instead of importing a global hooks object? So that different parts of your code could have different hook sets. Tests can pass empty hooks. The real agent passes the full production hooks.

---

## Step 8 — Building the Hooks for This App

All hook creation is isolated in one function:

```ts
function buildHooks(): Hooks {
  const hooks = createHooks();

  // Pre-hook: only ask for zsh, allow everything else automatically
  addPreHook(hooks, async ({ tool }) => {
    if (tool.name === "zsh") {
      const allowed = await askPermission(tool.name, tool.args);
      return allowed ? "allow" : "deny";
    }
    return "allow";
  });

  // Post-hook: log a success or failure icon after every tool
  addPostHook(hooks, ({ tool, result }) => {
    const ok = (result as { success?: boolean })?.success !== false;
    console.log(`  ${ok ? "✅" : "❌"}  ${tool.name} done`);
  });

  return hooks;
}
```

Why put this in its own function? So the agent's `action` handler stays clean — it just calls `buildHooks()` and gets back a ready-to-use object. If you want to add a new permission rule tomorrow, you add it here and nowhere else.

---

## Step 9 — The Agentic Loop

The old code sent one message and stopped. An agent needs to **loop** — because the AI might call multiple tools before giving a final answer.

The flow for each provider:

```
User sends prompt
       │
       ▼
  AI responds
       │
       ├── has tool calls? ──YES──► dispatchTool (with hooks) ──► send result back to AI ──┐
       │                                                                                     │
       └── no tool calls? ──────────────────────────────────────────────────────────────────┘
                │
                ▼
         print final answer
```

In code (OpenAI example):

```ts
// First call
let response = await client.chat.completions.create({ model, messages, tools });

// Keep looping while the AI calls tools
while (response.choices[0].finish_reason === "tool_calls") {
  messages.push(response.choices[0].message); // save AI's tool call message

  for (const toolCall of response.choices[0].message.tool_calls!) {
    const args = JSON.parse(toolCall.function.arguments);
    const result = await dispatchTool(toolCall.function.name, args, hooks); // hooks fire here
    messages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
  }

  response = await client.chat.completions.create({ model, messages, tools }); // next turn
}

console.log(response.choices[0].message.content); // final answer
```

Why push the assistant message before the tool results? The AI needs to see the full conversation history — including its own previous message where it decided to call a tool — so it can understand the context when it reads the result.

---

## Step 10 — Fixing `bashTool` (the Silent Bug)

The original `bashTool` was broken in a specific way:

```ts
// OLD — broken
export function bashTool(command: string) {
  const isExecuted = exec(command, (error, stdout, stderr) => {
    console.log(stdout); // printed to terminal, NOT returned to AI
  });
  return { success: true, data: isExecuted }; // returned a ChildProcess object, not output
}
```

`exec` with a callback is **fire and forget** — it starts the command and immediately returns a `ChildProcess` handle. The output comes later in a callback. So the AI was receiving a process handle, not the actual command output.

The fix — use `promisify` to make it awaitable:

```ts
// NEW — correct
const execAsync = promisify(exec);

export async function bashTool(command: string): Promise<toolReturnType> {
  try {
    const { stdout, stderr } = await execAsync(command); // actually wait for output
    return { success: true, data: stdout || stderr };    // return real output
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, errorMessage: error.message };
    }
    return { success: false, errorMessage: String(error) };
  }
}
```

`promisify` wraps a callback-based function into one that returns a Promise. `await` then waits for the command to actually finish before continuing.

---

## Files Changed

| File | What Changed |
|---|---|
| `utils/tools.ts` | Added `ToolCall` type — the runtime shape of an AI tool call |
| `utils/lifecycleHooks.ts` | **New file** — the entire hooks system: types, arrays, fire functions |
| `utils/toolsDefinition.ts` | Fixed `bashTool` to be async and capture real output; removed unused imports |
| `utils/tools.ts` | Fixed all tool schema `type` values to `'object'` (was `'string'` or `Type.OBJECT`) |
| `commands/agent.ts` | Added agentic loop, wired in lifecycle hooks, added `buildHooks()` |

---

## How to Add a New Permission Rule

You only touch `buildHooks()` in `agent.ts`. Nothing else:

```ts
// Block writing to sensitive system paths
addPreHook(hooks, ({ tool }) => {
  if (tool.name === "file_write") {
    const path = tool.args.fileName as string;
    if (path.startsWith("/etc") || path.startsWith("/usr")) {
      console.error("Blocked: cannot write to system paths");
      return "deny";
    }
  }
  return "allow";
});
```

## How to Add a New Logger

Add another post-hook:

```ts
addPostHook(hooks, ({ tool, result }) => {
  const log = `[${new Date().toISOString()}] ${tool.name}: ${JSON.stringify(result)}`;
  fs.appendFile("agent.log", log + "\n"); // write to a log file
});
```

No changes to `dispatchTool`, no changes to the provider loops, no changes to anything else.

---

## Appendix — Two Approaches to Human Intervention

This section documents the original approach that was implemented first, why it was replaced, and what the lifecycle hooks pattern solves.

---

### Approach 1 — Hardcoded Inline Check (Original)

When we first built the permission gate, the logic lived **directly inside the dispatch function**:

```ts
async function askPermission(
  toolName: string,
  args: Record<string, unknown>
): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const argsStr = JSON.stringify(args, null, 2);
    rl.question(`\n🔒 Agent wants to run: ${toolName}\n${argsStr}\nAllow? (y/n): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function dispatchTool(name: string, args: Record<string, unknown>): Promise<string> {
  // ❌ permission logic hardcoded HERE, inside the dispatcher
  if (name === 'zsh') {
    const allowed = await askPermission(name, args);
    if (!allowed) {
      return JSON.stringify({ success: false, errorMessage: 'User denied permission.' });
    }
    const result = await bashTool(args.comand as string);
    return JSON.stringify(result);
  }

  if (name === 'file_write') {
    // no permission check — runs directly
    const result = await writeFileTool(args.fileName as string, args.content as string);
    return JSON.stringify(result);
  }

  if (name === 'read_write') {
    // no permission check — runs directly
    const result = await readFileTool(args.fileName as string);
    return JSON.stringify(result);
  }

  return JSON.stringify({ success: false, errorMessage: `Unknown tool: ${name}` });
}
```

#### How it worked

1. `dispatchTool` received the tool name and args from the AI
2. It checked `if (name === 'zsh')` — hardcoded string match
3. Inside that branch it called `askPermission` — blocking readline prompt
4. If the user typed `y`, the tool ran. If `n`, it returned a denial message
5. Other tools (`file_write`, `read_write`) had no check — they ran silently

---

### Why Approach 1 Fails — Five Concrete Problems

#### Problem 1: Adding a rule requires modifying `dispatchTool`

Say you now want permission for `file_write` as well. You have to go into `dispatchTool` and add another `if`:

```ts
if (name === 'file_write') {
  const allowed = await askPermission(name, args);  // ← now you add this
  if (!allowed) return JSON.stringify({ ... });
  const result = await writeFileTool(...);
  return JSON.stringify(result);
}
```

This breaks the **Open/Closed Principle** — your function is not closed for modification. Every new requirement forces you to edit the same function.

#### Problem 2: Permission logic and dispatch logic are tangled

`dispatchTool` is supposed to answer one question: *"which function do I call for this tool name?"*

But now it also answers: *"should I ask for permission?"* and *"how do I ask?"* and *"what do I do if denied?"*

Three different responsibilities in one function. When something breaks, you don't know which responsibility caused it.

#### Problem 3: No way to add post-execution visibility

You want to log what happened after every tool call. In the hardcoded approach you would have to add a `console.log` inside every single `if` branch:

```ts
if (name === 'zsh') {
  // ... permission check
  const result = await bashTool(...);
  console.log(`zsh done: ${JSON.stringify(result)}`);  // ← added here
  return JSON.stringify(result);
}

if (name === 'file_write') {
  const result = await writeFileTool(...);
  console.log(`file_write done: ${JSON.stringify(result)}`);  // ← repeated here
  return JSON.stringify(result);
}

if (name === 'read_write') {
  const result = await readFileTool(...);
  console.log(`read_write done: ${JSON.stringify(result)}`);  // ← repeated again
  return JSON.stringify(result);
}
```

Repeated in every branch. If you want to change the log format, you change it in N places.

#### Problem 4: You cannot stack multiple behaviours

Imagine you want:
- Permission check for `zsh`
- Rate limiting (max 5 tool calls per session)
- Argument validation (no `null` values)

In the hardcoded approach, all three would have to live inside `dispatchTool` as nested logic. The function grows without bound. There's no way to say "plug this in, plug that out."

#### Problem 5: Impossible to test in isolation

To test the permission logic, you have to call `dispatchTool`, which calls `askPermission`, which blocks on `readline`, which expects a real terminal.

You cannot write a unit test like:
```ts
// ❌ can't test the permission rule alone
// it's buried inside dispatchTool with no way to access it separately
```

---

### Approach 2 — Lifecycle Hooks (What We Built)

The key insight: **separate "should I run this" from "how do I run this".**

#### The data structures

```ts
// A pre-hook is any function that looks at the tool call and decides allow or deny
type PreHook = (context: HookContext) => 'allow' | 'deny' | void | Promise<...>;

// A post-hook is any function that observes the result — it cannot stop anything
type PostHook = (context: HookContext) => void | Promise<void>;

// The container — two arrays, one per moment
type Hooks = {
  pre: PreHook[];   // all functions to run BEFORE the tool executes
  post: PostHook[]; // all functions to run AFTER the tool executes
};
```

Why arrays? Because you need to **stack** multiple behaviours at the same moment.
Each element in the array is an independent function. They don't know about each other.

#### The context object

```ts
type HookContext = {
  tool: ToolCall;   // name + args — what the AI wants to call
  result?: unknown; // filled in only AFTER the tool runs (undefined in PreHooks)
};
```

This is the **shared envelope** that travels through the entire flow. Pre-hooks read `tool`. Post-hooks read `tool` AND `result`.

#### Managing the arrays

```ts
// Create an empty hooks container
const hooks = createHooks(); // → { pre: [], post: [] }

// Push functions into the arrays
addPreHook(hooks, myPreFn);   // hooks.pre.push(myPreFn)
addPostHook(hooks, myPostFn); // hooks.post.push(myPostFn)
```

These are simple wrappers around `.push()`. They exist so you have a single named place to change if you later need to deduplicate, validate, or log hook registrations.

#### Firing the arrays

```ts
// Run every pre-hook — stop at first 'deny'
async function firePreHooks(hooks, context): Promise<'allow' | 'deny'> {
  for (const hook of hooks?.pre ?? []) {
    if ((await hook(context)) === 'deny') {
      return 'deny'; // early exit — first denial wins
    }
  }
  return 'allow'; // every hook passed
}

// Run every post-hook — never stop early
async function firePostHooks(hooks, context) {
  for (const hook of hooks?.post ?? []) {
    await hook(context); // run all, even if one logs an error
  }
}
```

`firePreHooks` stops at the first `'deny'` — same as a security checkpoint. If ANY guard says no, you don't keep asking the rest.

`firePostHooks` never stops early — each observer is independent. One logger failing shouldn't stop the next one from running.

#### The dispatcher — now clean

```ts
async function dispatchTool(name: string, args: Record<string, unknown>, hooks: Hooks): Promise<string> {
  const context: HookContext = { tool: { name, args } };

  // Step 1 — ask all pre-hooks for a decision
  const decision = await firePreHooks(hooks, context);
  if (decision === 'deny') {
    return JSON.stringify({ success: false, errorMessage: 'Blocked by pre-hook.' });
  }

  // Step 2 — run the correct tool (pure dispatch, no permission logic here)
  let result: unknown;
  if (name === 'zsh')        result = await bashTool(args.comand as string);
  else if (name === 'file_write') result = await writeFileTool(args.fileName as string, args.content as string);
  else if (name === 'read_write') result = await readFileTool(args.fileName as string);
  else result = { success: false, errorMessage: `Unknown tool: ${name}` };

  // Step 3 — give result to post-hooks
  context.result = result;
  await firePostHooks(hooks, context);

  return JSON.stringify(result);
}
```

`dispatchTool` now has **one job** — route name to function. It does not know what permission logic exists. It does not know what logging exists. Those are outside it.

#### Wiring the actual permission check

```ts
function buildHooks(): Hooks {
  const hooks = createHooks();

  // Pre-hook: zsh needs user approval, everything else is automatic
  addPreHook(hooks, async ({ tool }) => {
    if (tool.name === 'zsh') {
      const allowed = await askPermission(tool.name, tool.args);
      return allowed ? 'allow' : 'deny';
    }
    return 'allow'; // other tools auto-approved
  });

  // Post-hook: log every result with a status icon
  addPostHook(hooks, ({ tool, result }) => {
    const ok = (result as { success?: boolean })?.success !== false;
    console.log(`  ${ok ? '✅' : '❌'}  ${tool.name} done`);
  });

  return hooks;
}
```

---

### Side-by-Side: The Same Requirement in Both Approaches

**Requirement: "Also ask permission before `file_write`"**

**Approach 1 — you must modify `dispatchTool`:**
```ts
// ❌ open the dispatcher, find the file_write branch, add permission logic
if (name === 'file_write') {
  const allowed = await askPermission(name, args); // ← add this
  if (!allowed) return JSON.stringify({ ... });    // ← add this
  const result = await writeFileTool(...);
  return JSON.stringify(result);
}
```

**Approach 2 — you add one line in `buildHooks`, touch nothing else:**
```ts
// ✅ just extend the pre-hook
addPreHook(hooks, async ({ tool }) => {
  if (tool.name === 'zsh' || tool.name === 'file_write') {
    const allowed = await askPermission(tool.name, tool.args);
    return allowed ? 'allow' : 'deny';
  }
  return 'allow';
});
```

---

**Requirement: "Rate-limit tool calls — max 10 per session"**

**Approach 1 — impossible without adding a counter into `dispatchTool` itself:**
```ts
// ❌ now dispatchTool has a counter variable — who owns it? where is it reset?
let callCount = 0;
async function dispatchTool(...) {
  callCount++;
  if (callCount > 10) return JSON.stringify({ error: 'rate limited' });
  // ... rest of function
}
```

**Approach 2 — one new pre-hook, nothing else changes:**
```ts
// ✅ isolated, self-contained
let callCount = 0;
addPreHook(hooks, () => {
  callCount++;
  if (callCount > 10) {
    console.error('Rate limit reached.');
    return 'deny';
  }
  return 'allow';
});
```

---

### The Fundamental Difference

| | Approach 1 (Hardcoded) | Approach 2 (Lifecycle Hooks) |
|---|---|---|
| Where does permission logic live? | Inside `dispatchTool` | Inside `buildHooks`, outside dispatch |
| Adding a new rule | Modify `dispatchTool` | Add a new hook function |
| Multiple behaviours at once | Nested if/else in one function | Separate array entries, stacked |
| Post-execution visibility | Repeat in every branch | One `addPostHook` call |
| Testability | Must call full dispatch | Test hook function alone |
| `dispatchTool` responsibility | Dispatch + permission + logging | Dispatch only |

The hardcoded approach is a shortcut that works for exactly one rule. The moment you need a second rule — or want to change the first — it starts fighting you.

The lifecycle hooks pattern treats each behaviour as a plugin. The dispatcher stays stable. Behaviours are added, removed, and composed without touching it.

