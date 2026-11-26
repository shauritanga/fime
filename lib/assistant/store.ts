// The conversation lives outside the screen, so swiping the chat away and reopening it keeps it
// (until the app is closed, "New chat", or signing out). Nothing is written to disk.
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';
import type { AppBridge, Change, PendingAction, Screen } from './actions';
import { askAssistant, AssistantError } from './chat';

export type Turn = {
  id: number;
  question: string;
  answer?: string;
  error?: string;
  saved?: string[];
  pending?: PendingAction[];
  screens?: Screen[];
};

type Chat = { turns: Turn[]; busy: boolean };

let chat: Chat = { turns: [], busy: false };
let request: AbortController | null = null;
let undo: Change[] = [];
const listeners = new Set<() => void>();

function update(next: Chat) {
  chat = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function patch(id: number, changes: (turn: Turn) => Partial<Turn>, busy = chat.busy) {
  update({ turns: chat.turns.map((turn) => (turn.id === id ? { ...turn, ...changes(turn) } : turn)), busy });
}

export function useChat() {
  return useSyncExternalStore(subscribe, () => chat);
}

export function newChat() {
  request?.abort();
  request = null;
  undo = [];
  update({ turns: [], busy: false });
}

/** What the model is told about an earlier reply, including what actually happened. */
function recall(turn: Turn) {
  const notes = [
    ...(turn.saved ?? []).map((line) => `[Done: ${line}]`),
    ...(turn.pending ?? []).map((item) => `[Not done yet, waiting for the user to confirm: ${item.summary}]`),
  ];
  return [turn.answer, ...notes].join('\n');
}

export async function ask(db: SQLiteDatabase, app: AppBridge, question: string, retryId?: number) {
  const clean = question.trim();
  if (!clean || chat.busy) {
    return;
  }

  const id = retryId ?? Date.now();
  const others = chat.turns.filter((turn) => turn.id !== id);
  const history = others.flatMap((turn) =>
    turn.answer !== undefined ? [{ question: turn.question, answer: recall(turn) }] : []
  );
  const controller = new AbortController();
  request = controller;
  update({ turns: [...others, { id, question: clean }], busy: true });

  try {
    const reply = await askAssistant(db, clean, history, controller.signal, { app, undo });
    // A reply for a chat that has since been cleared is dropped.
    if (request === controller) {
      patch(id, () => reply, false);
    }
  } catch (error) {
    if (!(error instanceof AssistantError)) {
      console.warn('Assistant failed', error);
    }
    if (request === controller) {
      patch(
        id,
        () => ({
          error: error instanceof AssistantError ? error.message : 'Something went wrong. Please try again.',
        }),
        false
      );
    }
  }
}

/** Runs, or drops, a change that was waiting for the user's tap. */
export async function settle(turnId: number, actionId: string, confirmed: boolean) {
  const turn = chat.turns.find((item) => item.id === turnId);
  const action = turn?.pending?.find((item) => item.id === actionId);
  if (!action || chat.busy) {
    return;
  }

  // Removed first, so a double tap can't run it twice.
  patch(turnId, (item) => ({ pending: item.pending?.filter((entry) => entry.id !== actionId) }));
  let line = `Cancelled: ${action.summary}`;
  if (confirmed) {
    try {
      const change = await action.run();
      if (change.undo) {
        undo.push(change);
      }
      line = change.summary;
    } catch (error) {
      console.warn('Confirmed action failed', error);
      line = `Not done: ${error instanceof Error ? error.message : 'something went wrong'}`;
    }
  }
  patch(turnId, (item) => ({ saved: [...(item.saved ?? []), line] }));
}
