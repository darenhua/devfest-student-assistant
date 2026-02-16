import path from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage, SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk';

export interface ClaudeSDKResult {
  success: boolean;
  costUsd: number;
  numTurns: number;
  durationMs: number;
  sessionId?: string;
  resultText?: string;
  error?: string;
}

export async function generateSpecWithClaude(
  prompt: string,
  cwd: string,
  branch: string,
): Promise<ClaudeSDKResult> {
  const absCwd = path.isAbsolute(cwd)
    ? cwd
    : path.join(process.cwd(), cwd);

  console.log(`[spec-gen][${branch}] Starting Claude SDK query in cwd: ${absCwd}`);
  console.log(`[spec-gen][${branch}] Prompt length: ${prompt.length} chars`);

  try {
    const q = query({
      prompt,
      options: {
        cwd: absCwd,
        model: 'sonnet',
        maxTurns: 100,
        maxBudgetUsd: 1.0,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      },
    });

    let messageCount = 0;

    for await (const message of q) {
      messageCount++;
      logSDKMessage(branch, message, messageCount);

      if (message.type === 'result') {
        if (message.subtype === 'success') {
          const success = message as SDKResultSuccess;
          console.log(
            `[spec-gen][${branch}] SDK result: success | turns=${success.num_turns} cost=$${success.total_cost_usd.toFixed(4)} duration=${success.duration_ms}ms`,
          );
          return {
            success: true,
            costUsd: success.total_cost_usd,
            numTurns: success.num_turns,
            durationMs: success.duration_ms,
            sessionId: success.session_id,
            resultText: success.result,
          };
        } else {
          console.log(`[spec-gen][${branch}] SDK result: error subtype=${message.subtype}`);
          return {
            success: false,
            costUsd: message.total_cost_usd,
            numTurns: message.num_turns,
            durationMs: message.duration_ms,
            sessionId: 'session_id' in message ? (message as any).session_id : undefined,
            error: `SDK error: ${message.subtype}`,
          };
        }
      }
    }

    console.log(`[spec-gen][${branch}] SDK stream ended after ${messageCount} messages with no result`);
    return {
      success: false,
      costUsd: 0,
      numTurns: 0,
      durationMs: 0,
      error: `SDK returned no result message (${messageCount} messages received)`,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[spec-gen][${branch}] SDK threw exception: ${errMsg}`);
    if (err instanceof Error && err.stack) {
      console.error(`[spec-gen][${branch}] Stack: ${err.stack.split('\n').slice(0, 5).join(' | ')}`);
    }
    return {
      success: false,
      costUsd: 0,
      numTurns: 0,
      durationMs: 0,
      error: errMsg,
    };
  }
}

/** Log interesting SDK messages to the server console */
function logSDKMessage(branch: string, msg: SDKMessage, idx: number): void {
  switch (msg.type) {
    case 'system':
      console.log(`[spec-gen][${branch}][msg ${idx}] system: session=${msg.session_id}`);
      break;
    case 'assistant':
      if (msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'tool_use') {
            const input = JSON.stringify(block.input).slice(0, 200);
            console.log(`[spec-gen][${branch}][msg ${idx}] tool_use: ${block.name} → ${input}`);
          }
        }
      }
      break;
    case 'result':
      console.log(`[spec-gen][${branch}][msg ${idx}] result: subtype=${msg.subtype}`);
      break;
    default:
      break;
  }
}
