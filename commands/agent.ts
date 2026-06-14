import { Command } from 'commander';
import {
  GoogleGenAI,
  type FunctionDeclaration,
  type Part,
} from '@google/genai';
import { getCurrentSession, PROVIDERS_TYPES } from '../utils/share';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import readline from 'readline';
import { getAllToolsOfProviders } from '../utils/providersToolAdapter';
import {
  bashTool,
  writeFileTool,
  readFileTool,
  grepSearchTool,
  findFilesTool,
  gitTool,
  WorkFlowStep,
} from '../utils/toolsDefinition';
import {
  createHooks,
  addPreHook,
  addPostHook,
  firePreHooks,
  firePostHooks,
  type Hooks,
  type HookContext,
} from '../utils/lifecycleHooks';
import { intializeSubAgents } from '../utils/sunagents';
type QueueItem = {
  toolId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'pending' | 'completed';
};
async function askPermission(
  toolName: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const cwd = process.cwd();
  const line = '─'.repeat(60);

  // Each arg on its own labelled line — full value, no truncation
  const argLines = Object.entries(args)
    .map(([k, v]) => `  │  ${k}: ${String(v)}`)
    .join('\n');

  const banner =
    `\n${line}\n` +
    `  Calling  ${toolName}\n` +
    `  │  path: ${cwd}\n` +
    `${argLines}\n` +
    `${line}`;

  return new Promise((resolve) => {
    rl.question(`${banner}\n  Allow? (y/n): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// Tool dispatcher — hooks fire around every execution
export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  hooks: Hooks,
): Promise<string> {
  const context: HookContext = { tool: { name, args } };

  // Pre-hooks decide allow/deny before the tool runs
  const decision = await firePreHooks(hooks, context);
  if (decision === 'deny') {
    return JSON.stringify({
      success: false,
      errorMessage: 'Blocked by pre-hook.',
    });
  }

  // Execute the right tool
  let result: unknown;
  if (name === 'zsh') {
    result = await bashTool(args.comand as string);
  } else if (name === 'file_write') {
    result = await writeFileTool(
      args.fileName as string,
      args.content as string,
    );
  } else if (name === 'read_file') {
    result = await readFileTool(args.fileName as string);
  } else if (name === 'grep_search') {
    result = await grepSearchTool(
      args.pattern as string,
      args.directory as string,
      args.fileGlob as string | undefined,
    );
  } else if (name === 'find_files') {
    result = await findFilesTool(
      args.directory as string,
      args.namePattern as string,
    );
  } else if (name === 'git') {
    result = await gitTool(args.gitCommand as string, args.repoPath as string);
  } else if (name === 'create_a_subagent') {
    result = await intializeSubAgents(
      args.provider as PROVIDERS_TYPES,
      args.query as string,
      args.systemPrompt as string,
      hooks,
    );
  } else if (name === 'plan_maker') {
    result = await toolSchedular(hooks, args.steps as WorkFlowStep[]);
  } else {
    result = { success: false, errorMessage: `Unknown tool: ${name}` };
  }

  // Post-hooks receive the result for logging / auditing
  context.result = result;
  await firePostHooks(hooks, context);

  return JSON.stringify(result);
}

async function toolSchedular(
  hooks: Hooks,
  workFlowSteps: WorkFlowStep[],
): Promise<Part[]> {
  const toolResults: Part[] = [];
  let waitingQueue: QueueItem[] = [];
  const readyQueue: QueueItem[] = [];
  const completedSet = new Set<string>();

  // Bug 1 fix: populate queues ONCE before the while loop — not inside it
  for (const step of workFlowSteps) {
    const item: QueueItem = {
      toolId: step.id,
      toolName: step.toolName,
      args: step.args,
      status: 'pending',
    };
    if (step.dependsOn.length === 0) {
      readyQueue.push(item);   // no deps → ready immediately
    } else {
      waitingQueue.push(item); // has deps → blocked
    }
  }

  // Bug 5 fix: runWorker defined ONCE, outside the while loop
  async function runWorker(): Promise<void> {
    const tool = readyQueue.shift();
    if (!tool) return;

    const result = await dispatchTool(tool.toolName, tool.args, hooks);

    // Bug 3 fix: add toolId string to completedSet, not the whole object
    completedSet.add(tool.toolId);

    toolResults.push({
      functionResponse: { name: tool.toolName, response: { result } },
    });

    // Bug 4 fix: check waitingQueue — move unblocked tasks to readyQueue
    const nowReady = waitingQueue.filter((waiting) => {
      const step = workFlowSteps.find((s) => s.id === waiting.toolId);
      return step?.dependsOn.every((depId) => completedSet.has(depId)) ?? false;
    });

    for (const task of nowReady) {
      waitingQueue = waitingQueue.filter((q) => q.toolId !== task.toolId);
      readyQueue.push(task); // now unblocked — workers will pick it up
    }

    return runWorker(); // this worker grabs the next ready task
  }

  // Bug 2 fix: while loop now works because readyQueue is populated before entering
  while (readyQueue.length > 0 || waitingQueue.length > 0) {
    const poolSize = Math.min(readyQueue.length, 5);
    if (poolSize === 0) break; // safety: circular dependency guard
    await Promise.all(Array.from({ length: poolSize }, () => runWorker()));
  }

  return toolResults;
}
//  Hook setup
function buildHooks(): Hooks {
  const hooks = createHooks();

  // Pre-hook: ask user permission before any zsh command
  addPreHook(hooks, async ({ tool }) => {
    if (tool.name === 'zsh') {
      let allowed = true;
      if ((tool.args.comand as string).includes('rm')) {
        allowed = await askPermission(tool.name, tool.args);
      }
      return allowed ? 'allow' : 'deny';
    }
    return 'allow';
  });

  // Post-hook: log every tool result
  addPostHook(hooks, ({ tool, result }) => {
    const res = result as { success?: boolean; errorMessage?: string };
    const ok = res?.success !== false;
    const icon = ok ? '✅' : '❌';
    const errSuffix =
      !ok && res?.errorMessage ? ` - Error: ${res.errorMessage}` : '';

    let details = '';
    if (tool.name === 'zsh') {
      details = ` [command: "${tool.args.comand}"]`;
    } else if (tool.name === 'file_write') {
      details = ` [file: ${tool.args.fileName}]`;
    } else if (tool.name === 'read_file') {
      details = ` [file: ${tool.args.fileName}]`;
    } else if (tool.name === 'grep_search') {
      details = ` [pattern: "${tool.args.pattern}" in ${tool.args.directory}]`;
    } else if (tool.name === 'find_files') {
      details = ` [pattern: "${tool.args.namePattern}" in ${tool.args.directory}]`;
    } else if (tool.name === 'git') {
      details = ` [git ${tool.args.gitCommand}]`;
    } else if (tool.name === 'create_a_subagent') {
      details = ` [query: "${tool.args.query}"]`;
    }

    console.log(`  ${icon}  ${tool.name}${details} done${errSuffix}`);
  });

  return hooks;
}

// System prompt
const SYSTEM_PROMPT = `
You are the Lead Coordinator Agent. 
Your role is to understand the user's request, plan the execution steps, and delegate all file writing, modifying, and command execution tasks to specialized subagents.

MANDATORY RULES:
- You must delegate all actual work (writing files, running shell commands, installing packages) to one or more specialized subagents using the 'create_a_subagent' tool.
- You only have direct access to 'read_file' (to read project files for context) and 'create_a_subagent' (to delegate tasks).
- Do NOT attempt to perform file writes or command executions yourself.

Subagents have access to these tools:
  - zsh        : Run any shell command
  - file_write : Write files to disk
  - read_file  : Read files from disk
  - grep_search: Search for a text pattern inside files (like grep -rn). Use this to find function definitions, usages, and bugs.
  - find_files : Find files by name pattern in a directory
  - git        : Run git commands (status, diff, add, commit, log, branch, checkout, etc.)
  - plan_maker : To create a plan before calling any tool call.

Guidelines for Spawning Subagents:
1. Divide complex or multi-step tasks into clear, individual sub-tasks.
2. For each sub-task, spawn a subagent using 'create_a_subagent' and provide a descriptive query and system instructions.
3. You can spawn multiple subagents sequentially to complete tasks step-by-step.
4. Instruct subagents to use 'grep_search' or 'find_files' before writing code so they understand the codebase context.
5. Instruct subagents to use 'git' to commit changes after completing their tasks.
`.trim();

// Agent command
export const agentCommand = new Command('agent')
  .description('Runs the agent')
  .option('-p, --prompt <prompt>', 'prompt', '')
  .action(async (options) => {
    try {
      if (!options.prompt) return;

      const query: string = options.prompt;
      const hooks = buildHooks();

      // Pretty-print the parsed prompt
      console.log(`[QUERY_ASKED]>>>>>>>>>>>>>> ${query}\n`);

      let session;
      try {
        session = await getCurrentSession();
      } catch (error) {
        if (error instanceof Error && !session) {
          console.error(error.message);
        } else {
          console.error(String(error));
        }
        process.exit(1);
      }

      // Google (Gemini) —
      if (
        session.provider === 'google' &&
        session.apiKey &&
        session.client instanceof GoogleGenAI
      ) {
        const tools = getAllToolsOfProviders(
          'google',
        )! as FunctionDeclaration[];

        const coordinatorTools = tools.filter(
          (t) =>
            t.name === 'create_a_subagent' ||
            t.name === 'read_file' ||
            t.name === 'plan_maker',
        );
        const chat = session.client.chats.create({
          model: session.model!,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: coordinatorTools }],
          },
        });

        let response = await chat.sendMessage({ message: query });

        const toolResults: Part[] = [];
        while (response.functionCalls && response.functionCalls.length > 0) {
          const queue = [...response.functionCalls];

          async function runWorker(): Promise<void> {
            const tool = queue.shift();
            if (!tool) return;

            const result = await dispatchTool(
              tool.name!,
              tool.args as Record<string, unknown>,
              hooks,
            );

            // If plan_maker ran, the scheduler already executed all steps.
            // Its results are a Part[] — spread them directly into toolResults.
            if (tool.name === 'plan_maker') {
              const scheduledResults: Part[] = JSON.parse(result);
              toolResults.push(...scheduledResults);
            } else {
              toolResults.push({
                functionResponse: { name: tool.name!, response: { result } },
              });
            }

            return runWorker();
          }

          const poolSize = Math.min(queue.length, 5);
          await Promise.all(
            Array.from({ length: poolSize }, () => runWorker()),
          );

          response = await chat.sendMessage({ message: toolResults });
        }

        // Stream the final text response token by token
        process.stdout.write('\n ');
        const stream = await chat.sendMessageStream({
          message: '(summarize what you did)',
        });
        for await (const chunk of stream) {
          process.stdout.write(chunk.text ?? '');
        }
        process.stdout.write('\n');

        //  OpenAI
      } else if (
        session.provider === 'openai' &&
        session.apiKey &&
        session.client instanceof OpenAI
      ) {
        console.log('enter in openai loop');

        const tools = getAllToolsOfProviders(
          'openai',
        )! as unknown as OpenAI.Chat.ChatCompletionTool[];
        const coordinatorTools = tools.filter(
          (t) =>
            t.type === 'function' &&
            (t.function.name === 'create_a_subagent' ||
              t.function.name === 'read_file'),
        );
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: query },
        ];

        let response = await session.client.chat.completions.create({
          model: session.model,
          messages,
          tools: coordinatorTools,
        });

        while (response.choices[0].finish_reason === 'tool_calls') {
          const assistantMsg = response.choices[0].message;
          messages.push(assistantMsg);

          for (const toolCall of assistantMsg.tool_calls!) {
            if (toolCall.type !== 'function') continue;

            const args = JSON.parse(toolCall.function.arguments) as Record<
              string,
              unknown
            >;
            const result = await dispatchTool(
              toolCall.function.name,
              args,
              hooks,
            );
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result,
            });
          }

          response = await session.client.chat.completions.create({
            model: session.model,
            messages,
            tools: coordinatorTools,
          });
        }

        console.log(response.choices[0].message.content);
      } else if (
        session.provider === 'claude' &&
        session.apiKey &&
        session.client instanceof Anthropic
      ) {
        const tools = getAllToolsOfProviders(
          'claude',
        )! as unknown as Anthropic.Tool[];
        const coordinatorTools = tools.filter(
          (t) => t.name === 'create_a_subagent' || t.name === 'read_file',
        );
        const messages: Anthropic.MessageParam[] = [
          { role: 'user', content: query },
        ];

        let response = await session.client.messages.create({
          model: session.model,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages,
          tools: coordinatorTools,
        });

        while (response.stop_reason === 'tool_use') {
          messages.push({ role: 'assistant', content: response.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              const result = await dispatchTool(
                block.name,
                block.input as Record<string, unknown>,
                hooks,
              );
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: result,
              });
            }
          }
          messages.push({ role: 'user', content: toolResults });

          response = await session.client.messages.create({
            model: session.model,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages,
            tools: coordinatorTools,
          });
        }

        const textBlock = response.content.find((b) => b.type === 'text');
        if (textBlock && textBlock.type === 'text') {
          console.log(textBlock.text);
        }
      }
    } catch (e) {
      console.error(e);
    }
  });
