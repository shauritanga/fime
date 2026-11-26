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
