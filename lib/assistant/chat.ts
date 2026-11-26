import type { SQLiteDatabase } from 'expo-sqlite';
import { todayISO } from '../finance/format';
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

/** Asks one question, running whichever data tools the model requests until it replies. */
export async function askAssistant(
  db: SQLiteDatabase,
  question: string,
  history: PastTurn[],
  signal: AbortSignal
): Promise<{ answer: string }> {
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

  for (let request = 0; request < MAX_REQUESTS; request += 1) {
    const reply = await post(messages, signal);
    if (!reply.tool_calls?.length) {
      return { answer: reply.content };
    }

    messages.push({
      role: 'assistant',
      content: reply.content,
      tool_calls: reply.tool_calls,
      provider_data: reply.provider_data ?? undefined,
    });
    for (const call of reply.tool_calls) {
      let content: string;
      try {
        content = JSON.stringify(await runTool(db, call.name, call.arguments ?? {}));
      } catch (error) {
        console.warn(`Assistant tool ${call.name} failed`, error);
        content = JSON.stringify({ error: 'The data could not be read.' });
      }
      messages.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: content.slice(0, 16000) });
    }
  }

  throw new AssistantError("The assistant couldn't finish that question. Try asking it more simply.");
}
