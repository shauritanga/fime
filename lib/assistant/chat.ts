import type { SQLiteDatabase } from 'expo-sqlite';
import { todayISO } from '../finance/format';
import { isAction, runAction, type AppBridge, type Change, type PendingAction, type Screen } from './actions';
import { runTool } from './tools';
import type { ToolCall, WireMessage } from './types';

// In development the server runs on the computer and is reached over `adb reverse tcp:8787 tcp:8787`.
// Release builds need EXPO_PUBLIC_ASSISTANT_URL set to the https address of the deployed server.
export const assistantUrl = (
  process.env.EXPO_PUBLIC_ASSISTANT_URL ?? (__DEV__ ? 'http://127.0.0.1:8787' : '')
).replace(/\/$/, '');

export type PastTurn = { question: string; answer: string };

const MAX_PAST_TURNS = 5;
const MAX_REQUESTS = 5;
const TIMEOUT_MS = 70_000;

/** An error whose message is safe and useful to show to the user. */
export class AssistantError extends Error {}

type ServerReply = { content: string; tool_calls: ToolCall[]; provider_data?: unknown[] | null };

async function post(messages: WireMessage[], signal: AbortSignal): Promise<ServerReply> {
  const timer = new AbortController();
  const timeout = setTimeout(() => timer.abort(), TIMEOUT_MS);
  const cancel = () => timer.abort();
  signal.addEventListener('abort', cancel);
  try {
    const response = await fetch(`${assistantUrl}/v1/chat`, {
      body: JSON.stringify({ today: todayISO(), messages }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: timer.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body) {
      throw new AssistantError(
        typeof body?.detail === 'string' ? body.detail : "The assistant couldn't answer. Please try again."
      );
    }
    return body as ServerReply;
  } catch (error) {
    if (error instanceof AssistantError) {
      throw error;
    }
    throw new AssistantError("Can't reach the assistant. Check your internet connection and try again.");
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
  }
}

export type Reply = {
  answer: string;
  /** What was saved, in the app's own words. */
  saved: string[];
  /** Changes waiting for the user to tap Confirm. */
  pending: PendingAction[];
  screens: Screen[];
};

export type Abilities = {
  app: AppBridge;
  /** Changes made in this chat, newest last. */
  undo: Change[];
};

const MAX_CHANGES = 10;

/** Asks one question, running whichever tools the model requests until it replies. */
export async function askAssistant(
  db: SQLiteDatabase,
  question: string,
  history: PastTurn[],
  signal: AbortSignal,
  { app, undo }: Abilities
): Promise<Reply> {
  if (!assistantUrl) {
    throw new AssistantError('The assistant is not set up in this version yet.');
  }

  const messages: WireMessage[] = [
    ...history.slice(-MAX_PAST_TURNS).flatMap<WireMessage>((turn) => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer.slice(0, 4000) },
    ]),
    { role: 'user', content: question },
  ];

  const done: Omit<Reply, 'answer'> = { saved: [], pending: [], screens: [] };
  // If a model repeats a change while answering one question, it is not saved twice.
  const made = new Map<string, string>();
  // Never report a failure without saying that something was saved or is waiting.
  const partial = (): Reply => ({ answer: "I couldn't write a fuller reply.", ...done });

  for (let request = 0; request < MAX_REQUESTS; request += 1) {
    let reply: ServerReply;
    try {
      reply = await post(messages, signal);
    } catch (error) {
      if (done.saved.length || done.pending.length) {
        return partial();
      }
      throw error;
    }
    if (!reply.tool_calls?.length) {
      return { answer: reply.content, ...done };
    }

    messages.push({
      role: 'assistant',
      content: reply.content,
      tool_calls: reply.tool_calls,
      provider_data: reply.provider_data ?? undefined,
    });
    for (const call of reply.tool_calls) {
      // "New chat" cancels the question, so nothing more may be changed for it.
      if (signal.aborted) {
        throw new AssistantError('Cancelled.');
      }
      let content: string;
      try {
        const args = call.arguments ?? {};
        if (isAction(call.name)) {
          const key = `${call.name}:${JSON.stringify(args)}`;
          const earlier = made.get(key);
          if (earlier) {
            content = earlier;
          } else if (made.size >= MAX_CHANGES) {
            content = JSON.stringify({ saved: false, error: 'Too many changes at once. Ask the user to continue.' });
          } else {
            const outcome = await runAction({ db, app, undo }, call.name, args);
            for (const change of outcome.changes ?? []) {
              done.saved.push(change.summary);
              if (change.undo) {
                undo.push(change);
              }
            }
            if (outcome.pending) {
              done.pending.push(outcome.pending);
            }
            if (outcome.screen) {
              done.screens.push(outcome.screen);
            }
            content = JSON.stringify(outcome.data);
            // Only successful work is remembered, so a corrected retry still runs.
            if (outcome.changes || outcome.pending) {
              made.set(key, content);
            }
          }
        } else {
          content = JSON.stringify(await runTool(db, call.name, args));
        }
      } catch (error) {
        console.warn(`Assistant tool ${call.name} failed`, error);
        content = JSON.stringify({ error: 'That did not work. Nothing was changed.' });
      }
      messages.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: content.slice(0, 16000) });
    }
  }

  if (done.saved.length || done.pending.length) {
    return partial();
  }
  throw new AssistantError("The assistant couldn't finish that question. Try asking it more simply.");
}
