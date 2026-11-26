// The conversation lives outside the screen, so swiping the chat away and reopening it keeps it
// (until the app is closed, "New chat", or signing out). Nothing is written to disk.
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';
import { askAssistant, AssistantError } from './chat';

export type Turn = {
  id: number;
  question: string;
  answer?: string;
  error?: string;
};

type Chat = { turns: Turn[]; busy: boolean };

let chat: Chat = { turns: [], busy: false };
let request: AbortController | null = null;
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

export function useChat() {
  return useSyncExternalStore(subscribe, () => chat);
}

export function newChat() {
  request?.abort();
  request = null;
  update({ turns: [], busy: false });
}

export async function ask(db: SQLiteDatabase, question: string, retryId?: number) {
  const clean = question.trim();
  if (!clean || chat.busy) {
    return;
  }

  const id = retryId ?? Date.now();
  const others = chat.turns.filter((turn) => turn.id !== id);
  const history = others.flatMap((turn) =>
    turn.answer ? [{ question: turn.question, answer: turn.answer }] : []
  );
  const controller = new AbortController();
  request = controller;
  update({ turns: [...others, { id, question: clean }], busy: true });

  function finish(changes: Partial<Turn>) {
    // A reply for a chat that has since been cleared is dropped.
    if (request !== controller) {
      return;
    }
    update({
      turns: chat.turns.map((turn) => (turn.id === id ? { ...turn, ...changes } : turn)),
      busy: false,
    });
  }

  try {
    finish(await askAssistant(db, clean, history, controller.signal));
  } catch (error) {
    if (!(error instanceof AssistantError)) {
      console.warn('Assistant failed', error);
    }
    finish({
      error: error instanceof AssistantError ? error.message : 'Something went wrong. Please try again.',
    });
  }
}
