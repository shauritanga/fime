import { AnswerCardView } from '@/components/assistant/AnswerCardView';
import { Mascot } from '@/components/assistant/Mascot';
import { TypingDots } from '@/components/assistant/TypingDots';
import { Screen } from '@/components/finance-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { askAssistant, AssistantError } from '@/lib/assistant/chat';
import type { AnswerCard } from '@/lib/assistant/types';
import { getSetting, setSetting } from '@/lib/finance/database';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

type Turn = {
  id: number;
  question: string;
  answer?: string;
  cards: AnswerCard[];
  error?: string;
};

const CONSENT_KEY = 'assistant-consent-v1';

const suggestions = [
  'Analyze my spending this month',
  'How can I save more?',
  'Check my budget',
];
const followUps = ['What bills are coming up?', 'Show my largest expenses', 'Compare with last month'];

export default function AssistantScreen() {
  const db = useSQLiteContext();
  // `null` while the saved choice is being read.
  const [consented, setConsented] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getSetting(db, CONSENT_KEY)
      .then((value) => setConsented(value === 'yes'))
      .catch(() => setConsented(false));
    return () => requestRef.current?.abort();
  }, [db]);

  async function accept() {
    await setSetting(db, CONSENT_KEY, 'yes');
    setConsented(true);
  }

  async function withdraw() {
    newChat();
    await setSetting(db, CONSENT_KEY, 'no');
    setConsented(false);
  }

  function newChat() {
    requestRef.current?.abort();
    requestRef.current = null;
    setTurns([]);
    setBusy(false);
    setMenuOpen(false);
  }

  async function ask(question: string, retryId?: number) {
    const clean = question.trim();
    if (!clean || busy) {
      return;
    }

    const id = retryId ?? Date.now();
    const history = turns
      .filter((turn) => turn.id !== id && turn.answer)
      .map((turn) => ({ question: turn.question, answer: turn.answer as string }));
    const controller = new AbortController();
    requestRef.current = controller;
    setDraft('');
    setMenuOpen(false);
    setBusy(true);
    setTurns((current) => [...current.filter((turn) => turn.id !== id), { id, question: clean, cards: [] }]);

    function finish(changes: Partial<Turn>) {
      // A reply for a chat that has since been cleared is dropped.
      if (requestRef.current !== controller) {
        return;
      }
      setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...changes } : turn)));
      setBusy(false);
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

  function openLink(link: NonNullable<AnswerCard['link']>) {
    router.navigate({
      pathname: '/transactions',
      params: { period: link.period ?? '', categoryId: link.categoryId ?? '', opened: String(Date.now()) },
    });
  }

  if (consented === null) {
    return <Screen>{null}</Screen>;
  }

  if (!consented) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.consent}>
          <Mascot />
          <Text style={styles.greeting}>Meet your money assistant</Text>
          <Text style={styles.consentText}>
            Ask questions in English or Swahili about your spending, budgets, bills and goals.
          </Text>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Before you turn it on</Text>
            <Text style={styles.noticeText}>
              • Your question, and the records needed to answer it (such as amounts, categories, titles and
              dates), are sent over the internet to Fime&apos;s server and an outside AI service.
            </Text>
            <Text style={styles.noticeText}>• Your password, phone number and lenders&apos; names are not sent.</Text>
            <Text style={styles.noticeText}>• It can read your data but cannot change it. Answers can be wrong.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={accept} style={styles.primary}>
            <Text style={styles.primaryText}>Turn on assistant</Text>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  const last = turns[turns.length - 1];

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Assistant</Text>
          <Pressable accessibilityRole="button" onPress={newChat} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>New chat</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.messages, turns.length === 0 && styles.welcome]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => turns.length > 0 && scrollRef.current?.scrollToEnd({ animated: true })}
          ref={scrollRef}>
          {turns.length === 0 ? (
            <>
              <View style={styles.hero}>
                <Mascot size={110} />
                <Text style={styles.greeting}>What can I help you with today?</Text>
              </View>
              {suggestions.map((suggestion) => (
                <Pressable
                  accessibilityRole="button"
                  key={suggestion}
                  onPress={() => ask(suggestion)}
                  style={styles.suggestion}>
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={withdraw} style={styles.suggestion}>
                <Text style={styles.privacy}>Turn off the assistant</Text>
              </Pressable>
            </>
          ) : (
            turns.map((turn) => (
              <View key={turn.id}>
                <View style={styles.question}>
                  <Text style={styles.questionText}>{turn.question}</Text>
                </View>
                {turn.answer ? (
                  <View style={styles.answer}>
                    <RichText text={turn.answer} />
                    {turn.cards.map((card) => (
                      <AnswerCardView card={card} key={card.title} onOpenLink={openLink} />
                    ))}
                  </View>
                ) : turn.error ? (
                  <View style={styles.answer}>
                    <Text style={styles.error}>{turn.error}</Text>
                    {turn === last ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => ask(turn.question, turn.id)}
                        style={styles.chip}>
                        <Text style={styles.chipText}>Try again</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <TypingDots />
                )}
              </View>
            ))
          )}

          {last?.answer && !busy ? (
            <View style={styles.followUps}>
              {followUps
                .filter((item) => !turns.some((turn) => turn.question === item))
                .map((item) => (
                  <Pressable accessibilityRole="button" key={item} onPress={() => ask(item)} style={styles.chip}>
                    <Text style={styles.chipText}>{item}</Text>
                  </Pressable>
                ))}
            </View>
          ) : null}
        </ScrollView>

        {menuOpen ? (
          <View style={styles.menu}>
            <MenuItem label="Add transaction" onPress={() => router.navigate('/add')} />
            <MenuItem label="Set a budget" onPress={() => router.navigate('/insights/budgets')} />
            <MenuItem label="Check my balance" onPress={() => ask('What is my balance this month?')} />
            <MenuItem label="Upcoming bills" onPress={() => ask('What bills are coming up?')} />
          </View>
        ) : null}

        <View style={styles.composer}>
          <Pressable
            accessibilityLabel={menuOpen ? 'Close actions' : 'More actions'}
            accessibilityRole="button"
            onPress={() => setMenuOpen((open) => !open)}
            style={styles.roundButton}>
            <SymbolView
              name={menuOpen ? { ios: 'xmark', android: 'close', web: 'close' } : { ios: 'plus', android: 'add', web: 'add' }}
              tintColor={palette.ink}
              size={24}
            />
          </Pressable>
          <TextInput
            accessibilityLabel="Your question"
            maxLength={2000}
            multiline
            onChangeText={setDraft}
            onFocus={() => setMenuOpen(false)}
            placeholder="Ask about your money…"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={draft}
          />
          <Pressable
            accessibilityLabel="Send"
            accessibilityRole="button"
            disabled={busy || !draft.trim()}
            onPress={() => ask(draft)}
            style={[styles.roundButton, styles.send, (busy || !draft.trim()) && styles.disabled]}>
            <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} tintColor={palette.white} size={22} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuItem}>
      <Text style={styles.menuText}>{label}</Text>
    </Pressable>
  );
}

/** Shows **bold** parts of a reply; everything else is plain text. */
function RichText({ text }: { text: string }) {
  return (
    <Text selectable style={styles.answerText}>
      {text.split('**').map((part, index) => (
        <Text key={index} style={index % 2 === 1 ? styles.bold : undefined}>
          {part}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  consent: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  consentText: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  notice: {
    alignSelf: 'stretch',
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  noticeText: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 20,
  },
  primary: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: palette.emerald,
    borderRadius: radii.sm,
    paddingVertical: 15,
  },
  primaryText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '900',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  headerTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  headerButton: {
    justifyContent: 'center',
    minHeight: 48,
  },
  headerButtonText: {
    color: palette.emerald,
    fontSize: 14,
    fontWeight: '900',
  },
  messages: {
    gap: spacing.md,
    padding: spacing.md,
  },
  welcome: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  hero: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  greeting: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  suggestion: {
    justifyContent: 'center',
    minHeight: 40,
  },
  suggestionText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  privacy: {
    color: palette.muted,
    fontSize: 12,
  },
  question: {
    alignSelf: 'flex-end',
    backgroundColor: palette.slate,
    borderRadius: radii.lg,
    maxWidth: '85%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  questionText: {
    color: palette.white,
    fontSize: 15,
  },
  answer: {
    marginTop: spacing.md,
  },
  answerText: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '900',
  },
  error: {
    color: palette.coral,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  followUps: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  chip: {
    alignSelf: 'flex-end',
    borderColor: palette.emerald,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  chipText: {
    color: palette.emerald,
    fontSize: 13,
    fontWeight: '800',
  },
  menu: {
    alignSelf: 'flex-start',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    elevation: 4,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.md,
    minWidth: 220,
  },
  menuItem: {
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  menuText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  composer: {
    alignItems: 'flex-end',
    borderColor: palette.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    margin: spacing.sm,
    padding: 4,
  },
  input: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    maxHeight: 110,
    minHeight: 48,
    paddingVertical: 12,
  },
  roundButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  send: {
    backgroundColor: palette.slate,
  },
  disabled: {
    opacity: 0.35,
  },
});
