import { Redirect } from 'expo-router';

// Only a slot for the centre tab button; the chat itself is app/assistant.tsx.
export default function AskTab() {
  return <Redirect href="/assistant" />;
}
