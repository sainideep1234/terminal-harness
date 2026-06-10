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
    `  🔒  Calling  ${toolName}\n` +
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
  } else if (name === 'read_write') {
    result = await readFileTool(args.fileName as string);
  } else if (name === 'create_a_subagent') {
    const session = await getCurrentSession();
    result = await intializeSubAgents(
      args.provider as PROVIDERS_TYPES,
      args.query as string,
      args.systemPrompt as string,
      hooks,
    );
  } else {
    result = { success: false, errorMessage: `Unknown tool: ${name}` };
  }

  // Post-hooks receive the result for logging / auditing
  context.result = result;
  await firePostHooks(hooks, context);

  return JSON.stringify(result);
}

//  Hook setup
function buildHooks(): Hooks {
  const hooks = createHooks();

  // Pre-hook: ask user permission before any zsh command
  addPreHook(hooks, async ({ tool }) => {
    if (tool.name === 'zsh') {
      let allowed = true;
      if ((tool.args.comand as string).includes('rm -rf')) {
        allowed = await askPermission(tool.name, tool.args);
      }
      return allowed ? 'allow' : 'deny';
    }
    return 'allow';
  });

  // Post-hook: log every tool result
  addPostHook(hooks, ({ tool, result }) => {
    const ok = (result as { success?: boolean })?.success !== false;
    const icon = ok ? '✅' : '❌';
    console.log(`  ${icon}  ${tool.name} done`);
  });

  return hooks;
}

// System prompt
const SYSTEM_PROMPT = `
You are a powerful coding agent with access to the following tools:

  • zsh        :-  Run any shell command (zsh) on the user's machine.
  • file_write :-  Write (or overwrite) any file at an absolute path.
  • read_write :-  Read the full contents of any file at an absolute path.

Capabilities you can exercise:
  - Navigate the file system (ls, find, cat via zsh)
  - Read source files before editing them
  - Write or patch any file the user asks you to change
  - Install packages, run tests, start servers — anything via zsh

Guidelines:
  - Always read a file before modifying it so you preserve existing content.
  - Prefer minimal, targeted edits — do not rewrite files unnecessarily.
  - If a shell command might be destructive, briefly explain what it does.
  - Respond concisely; show relevant code or output, not raw JSON.
`.trim();

// Agent command
export const agentCommand = new Command('agent')
  .description('Runs the agent')
  .option('-p, --prompt <prompt>', 'prompt', '')
  .action(async (options) => {
    if (!options.prompt) return;

    const query: string = options.prompt;
    const hooks = buildHooks();

    // Pretty-print the parsed prompt
    console.log(
      `\n${'─'.repeat(60)}\n` +
        `  🤖  Agent Prompt\n` +
        `${'─'.repeat(60)}\n` +
        `  ${query}\n` +
        `${'─'.repeat(60)}\n`,
    );

    let session;
    try {
      session = await getCurrentSession();
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error(String(error));
      }
      process.exit(1);
    }

    // Google (Gemini)
    if (
      session.provider === 'google' &&
      session.apiKey &&
      session.client instanceof GoogleGenAI
    ) {
      const tools = getAllToolsOfProviders('google')! as FunctionDeclaration[];
      const chat = session.client.chats.create({
        model: session.model!,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: tools }],
        },
      });

      let response = await chat.sendMessage({ message: query });

      while (response.functionCalls && response.functionCalls.length > 0) {
        const toolResults: Part[] = [];
        for (const fc of response.functionCalls) {
          const result = await dispatchTool(
            fc.name!,
            fc.args as Record<string, unknown>,
            hooks,
          );
          toolResults.push({
            functionResponse: { name: fc.name!, response: { result } },
          });
        }
        response = await chat.sendMessage({ message: toolResults });
      }

      console.log(response.text);

      //  OpenAI
    } else if (
      session.provider === 'openai' &&
      session.apiKey &&
      session.client instanceof OpenAI
    ) {
      const tools = getAllToolsOfProviders(
        'openai',
      )! as unknown as OpenAI.Chat.ChatCompletionTool[];
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ];

      let response = await session.client.chat.completions.create({
        model: session.model,
        messages,
        tools,
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
          tools,
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
      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: query },
      ];

      let response = await session.client.messages.create({
        model: session.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
        tools,
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
          tools,
        });
      }

      const textBlock = response.content.find((b) => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        console.log(textBlock.text);
      }
    }
  });
