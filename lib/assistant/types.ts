export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

/** One message as the assistant server understands it. */
export type WireMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: ToolCall[]; provider_data?: unknown[] }
  | { role: 'tool'; content: string; tool_call_id: string; name: string };

export type CardRow = {
  label: string;
  value: string;
  detail?: string;
  color?: string;
  /** 0 to 1, drawn as a bar. */
  progress?: number;
  warning?: boolean;
};

/** Figures shown under a reply. Built on the phone from the database, never from the model's text. */
export type AnswerCard = {
  title: string;
  headline?: string;
  caption?: string;
  rows: CardRow[];
  link?: { label: string; period?: string; categoryId?: string };
};

export type ToolOutput = {
  /** What the model receives. */
  data: unknown;
  card?: AnswerCard;
};
