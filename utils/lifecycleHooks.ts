import type { ToolCall } from './tools';

export type HookDecision = 'allow' | 'deny';

export type HookContext = {
  tool: ToolCall;
  result?: unknown;
};

export type PreHook = (
  context: HookContext,
) => HookDecision | void | Promise<HookDecision | void>;

export type PostHook = (context: HookContext) => void | Promise<void>;

export type Hooks = {
  pre: PreHook[];
  post: PostHook[];
};

export function createHooks(): Hooks {
  return { pre: [], post: [] };
}

export function addPreHook(hooks: Hooks, hook: PreHook) {
  hooks.pre.push(hook);
}

export function addPostHook(hooks: Hooks, hook: PostHook) {
  hooks.post.push(hook);
}

export async function firePreHooks(
  hooks: Hooks | undefined,
  context: HookContext,
): Promise<HookDecision> {
  for (const hook of hooks?.pre ?? []) {
    if ((await hook(context)) === 'deny') {
      return 'deny';
    }
  }
  return 'allow';
}

export async function firePostHooks(
  hooks: Hooks | undefined,
  context: HookContext,
) {
  for (const hook of hooks?.post ?? []) {
    await hook(context);
  }
}
