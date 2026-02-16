import path from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk';

export interface ClaudeSDKResult {
  success: boolean;
  costUsd: number;
  numTurns: number;
  durationMs: number;
  error?: string;
}

export async function generateSpecWithClaude(
  prompt: string,
  cwd: string,
): Promise<ClaudeSDKResult> {
  const absCwd = path.isAbsolute(cwd)
    ? cwd
    : path.join(process.cwd(), cwd);

  const q = query({
    prompt,
    options: {
      cwd: absCwd,
      model: 'sonnet',
      tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
      allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
      maxTurns: 100,
      maxBudgetUsd: 1.0,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
    },
  });

  for await (const message of q) {
    if (message.type === 'result') {
      if (message.subtype === 'success') {
        const success = message as SDKResultSuccess;
        return {
          success: true,
          costUsd: success.total_cost_usd,
          numTurns: success.num_turns,
          durationMs: success.duration_ms,
        };
      } else {
        return {
          success: false,
          costUsd: message.total_cost_usd,
          numTurns: message.num_turns,
          durationMs: message.duration_ms,
          error: `SDK error: ${message.subtype}`,
        };
      }
    }
  }

  return {
    success: false,
    costUsd: 0,
    numTurns: 0,
    durationMs: 0,
    error: 'SDK returned no result message',
  };
}
