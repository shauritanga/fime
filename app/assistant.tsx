import { AnswerCardView } from '@/components/assistant/AnswerCardView';
import { Backdrop } from '@/components/assistant/Backdrop';
import { Mascot } from '@/components/assistant/Mascot';
import { assistantFonts as font, assistantTheme as theme } from '@/components/assistant/theme';
import { TypingDots } from '@/components/assistant/TypingDots';
import { spacing } from '@/constants/theme';
import { ask, newChat, useChat } from '@/lib/assistant/store';
import type { AnswerCard } from '@/lib/assistant/types';
import { useVoice, type VoiceMode } from '@/lib/assistant/useVoice';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSetting, setSetting } from '@/lib/finance/database';
import {
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  useFonts,
} from '@expo-google-fonts/urbanist';
import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

// Raised when voice input was added: recordings are a new kind of data to agree to.
const CONSENT_KEY = 'assistant-consent-v2';

type IconName = SymbolViewProps['name'];

const icons = {
  add: { ios: 'plus', android: 'add', web: 'add' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  chevron: { ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  menu: { ios: 'line.3.horizontal', android: 'notes', web: 'notes' },
  mic: { ios: 'mic', android: 'mic_none', web: 'mic_none' },
  send: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  voice: { ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' },
  spending: { ios: 'chart.pie', android: 'donut_large', web: 'donut_large' },
  save: { ios: 'questionmark', android: 'help_outline', web: 'help_outline' },
  budget: { ios: 'magnifyingglass', android: 'search', web: 'search' },
} satisfies Record<string, IconName>;

const suggestions = [
  { icon: icons.spending, label: 'Analyze my spending', question: 'Analyze my spending this month' },
  { icon: icons.save, label: 'How can I save more?', question: 'How can I save more?' },
  { icon: icons.budget, label: 'Check my budget', question: 'Check my budget' },
];
const followUps = ['What bills are coming up?', 'Show my largest expenses', 'Compare with last month'];

export default function AssistantScreen() {
  const db = useSQLiteContext();
  const { isLoading, isSignedIn } = useAuth();
  const { turns, busy } = useChat();
  // The text falls back to the system font until these arrive.
  useFonts({ Urbanist_400Regular, Urbanist_500Medium, Urbanist_600SemiBold, Urbanist_700Bold });
  // `null` while the saved choice is being read.
  const [consented, setConsented] = useState<boolean | null>(null);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<'header' | 'actions' | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const onVoiceText = useCallback(
    (text: string, mode: VoiceMode) => {
      if (mode === 'ask') {
        ask(db, text);
      } else {
        setDraft((current) => (current ? `${current} ${text}` : text));
      }
    },
    [db]
  );
  const voice = useVoice(onVoiceText);

  useEffect(() => {
    getSetting(db, CONSENT_KEY)
      .then((value) => setConsented(value === 'yes'))
      .catch(() => setConsented(false));
  }, [db]);

  if (!isLoading && !isSignedIn) {
    return <Redirect href="/login" />;
  }

  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  async function accept() {
    await setSetting(db, CONSENT_KEY, 'yes');
    setConsented(true);
  }

  async function withdraw() {
    newChat();
    setMenu(null);
    await setSetting(db, CONSENT_KEY, 'no');
    setConsented(false);
  }

  function send(question: string) {
    setDraft('');
    setMenu(null);
    voice.clearError();
    ask(db, question);
  }

  function openLink(link: NonNullable<AnswerCard['link']>) {
    router.dismissTo({
      pathname: '/transactions',
      params: { period: link.period ?? '', categoryId: link.categoryId ?? '', opened: String(Date.now()) },
    });
  }

  const last = turns[turns.length - 1];
  const recording = voice.phase === 'recording';
  const transcribing = voice.phase === 'transcribing';
  const hasDraft = draft.trim().length > 0;

  return (
    <View style={styles.screen}>
      <Backdrop />
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <View style={styles.header}>
            {consented ? (
              <IconButton
                icon={icons.menu}
                label="Chat menu"
                onPress={() => setMenu((open) => (open === 'header' ? null : 'header'))}
              />
            ) : (
              <IconButton icon={icons.back} label="Close assistant" onPress={close} />
            )}
            <Pressable
              accessibilityRole="button"
              disabled={!consented}
              onPress={() => setMenu((open) => (open === 'header' ? null : 'header'))}
              style={styles.title}>
              <Text style={styles.titleText}>Chat Assistant</Text>
              {consented ? <SymbolView name={icons.chevron} size={20} tintColor={theme.faint} /> : null}
            </Pressable>
            <Pressable
              accessibilityLabel="New chat"
              accessibilityRole="button"
              disabled={!consented}
              onPress={() => {
                newChat();
                setDraft('');
                setMenu(null);
              }}
              style={({ pressed }) => [styles.circle, pressed && styles.pressed]}>
              <Mascot size={28} />
            </Pressable>
          </View>

          {menu === 'header' ? (
            <View style={[styles.menu, styles.headerMenu]}>
              <MenuItem
                label="New chat"
                onPress={() => {
                  newChat();
                  setMenu(null);
                }}
              />
              <MenuItem label="Back to Fime" onPress={close} />
              <MenuItem label="Turn off assistant" onPress={withdraw} />
            </View>
          ) : null}

          {consented === null ? (
            <View style={styles.flex} />
          ) : !consented ? (
            <ScrollView contentContainerStyle={styles.consent}>
              <Mascot size={110} />
              <Text style={styles.greeting}>Meet your money assistant</Text>
              <Text style={styles.consentText}>
                Type or speak, in English or Swahili, about your spending, budgets, bills and goals.
              </Text>
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>Before you turn it on</Text>
                <Text style={styles.noticeText}>
                  • Your question, and the records needed to answer it (such as amounts, categories, titles and
                  dates), are sent over the internet to Fime&apos;s server and an outside AI service.
                </Text>
                <Text style={styles.noticeText}>
                  • When you use the microphone, your recording is sent the same way to be turned into text.
                  Fime does not keep it.
                </Text>
                <Text style={styles.noticeText}>• Your password, phone number and lenders&apos; names are not sent.</Text>
                <Text style={styles.noticeText}>• It can read your data but cannot change it. Answers can be wrong.</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={accept} style={styles.primary}>
                <Text style={styles.primaryText}>Turn on assistant</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <>
              <ScrollView
                contentContainerStyle={[styles.messages, turns.length === 0 && styles.welcome]}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => turns.length > 0 && scrollRef.current?.scrollToEnd({ animated: true })}
                onTouchStart={() => setMenu(null)}
                ref={scrollRef}
                showsVerticalScrollIndicator={false}>
                {turns.length === 0 ? (
                  <>
                    <View style={styles.hero}>
                      <Mascot size={124} />
                      <Text style={styles.greeting}>What can I help you{'\n'}with today?</Text>
                    </View>
                    <View>
                      {suggestions.map((item) => (
                        <Pressable
                          accessibilityRole="button"
                          key={item.label}
                          onPress={() => send(item.question)}
                          style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                          <SymbolView name={item.icon} size={20} tintColor={theme.faint} />
                          <Text style={styles.suggestionText}>{item.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  turns.map((turn) => (
                    <View key={turn.id}>
                      <View style={styles.question}>
                        <Text style={styles.questionText}>{turn.question}</Text>
                      </View>
                      {turn.answer ? (
                        <View style={styles.answer}>
                          <View style={styles.bubble}>
                            <RichText text={turn.answer} />
                          </View>
                          {turn.cards.map((card) => (
                            <AnswerCardView card={card} key={card.title} onOpenLink={openLink} />
                          ))}
                        </View>
                      ) : turn.error ? (
                        <View style={styles.answer}>
                          <Text style={styles.error}>{turn.error}</Text>
                          {turn === last ? (
                            <Chip label="Try again" onPress={() => ask(db, turn.question, turn.id)} />
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
                        <Chip key={item} label={item} onPress={() => send(item)} />
                      ))}
                  </View>
                ) : null}
              </ScrollView>

              {menu === 'actions' ? (
                <View style={[styles.menu, styles.actionsMenu]}>
                  <MenuItem label="Add transaction" onPress={() => router.dismissTo('/add')} />
                  <MenuItem label="Set a budget" onPress={() => router.dismissTo('/insights/budgets')} />
                  <MenuItem label="Check my balance" onPress={() => send('What is my balance this month?')} />
                  <MenuItem label="Upcoming bills" onPress={() => send('What bills are coming up?')} />
                </View>
              ) : null}

              {voice.error ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (voice.error.includes('settings')) {
                      Linking.openSettings();
                    }
                    voice.clearError();
                  }}
                  style={styles.voiceError}>
                  <Text style={styles.error}>{voice.error}</Text>
                </Pressable>
              ) : null}

              <View style={styles.composer}>
                {recording || transcribing ? (
                  <View accessibilityLiveRegion="polite" style={styles.listening}>
                    <Text style={styles.listeningText}>
                      {recording
                        ? `Listening… 0:${String(Math.min(voice.seconds, 60)).padStart(2, '0')}`
                        : 'Writing what you said…'}
                    </Text>
                    {transcribing ? <TypingDots /> : null}
                  </View>
                ) : (
                  <TextInput
                    accessibilityLabel="Your question"
                    maxLength={2000}
                    multiline
                    onChangeText={setDraft}
                    onFocus={() => setMenu(null)}
                    placeholder="Ask me anything about your money…"
                    placeholderTextColor={theme.faint}
                    style={styles.input}
                    value={draft}
                  />
                )}

                <View style={styles.composerRow}>
                  {recording ? (
                    <IconButton icon={icons.close} label="Cancel recording" onPress={voice.cancel} plain />
                  ) : (
                    <IconButton
                      icon={menu === 'actions' ? icons.close : icons.add}
                      label={menu === 'actions' ? 'Close actions' : 'More actions'}
                      onPress={() => setMenu((open) => (open === 'actions' ? null : 'actions'))}
                      plain
                    />
                  )}
                  <View style={styles.flex} />
                  {!recording ? (
                    <IconButton
                      disabled={transcribing}
                      faint
                      icon={icons.mic}
                      label="Dictate your question"
                      onPress={() => voice.start('dictate')}
                      plain
                    />
                  ) : null}
                  <Pressable
                    accessibilityLabel={
                      recording ? 'Finish recording' : hasDraft ? 'Send' : 'Ask with your voice'
                    }
                    accessibilityRole="button"
                    disabled={transcribing || (hasDraft && busy) || (!hasDraft && !recording && busy)}
                    onPress={() => {
                      if (recording) {
                        voice.done();
                      } else if (hasDraft) {
                        send(draft);
                      } else {
                        setMenu(null);
                        voice.start('ask');
                      }
                    }}
                    style={({ pressed }) => [
                      styles.mainButton,
                      (pressed || transcribing || (busy && !recording)) && styles.pressed,
                    ]}>
                    <SymbolView
                      name={recording ? icons.check : hasDraft ? icons.send : icons.voice}
                      size={24}
                      tintColor="#FFFFFF"
                    />
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function IconButton({
  disabled,
  faint,
  icon,
  label,
  onPress,
  plain,
}: {
  disabled?: boolean;
  faint?: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Without the white circle behind it. */
  plain?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [plain ? styles.plainButton : styles.circle, pressed && styles.pressed]}>
      <SymbolView name={icon} size={26} tintColor={faint ? theme.faint : theme.ink} />
    </Pressable>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
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

const shadow = {
  elevation: 2,
  shadowColor: '#3B2A63',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.background,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  circle: {
    ...shadow,
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  title: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 48,
  },
  titleText: {
    color: theme.ink,
    fontFamily: font.semibold,
    fontSize: 19,
  },
  consent: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  consentText: {
    color: theme.faint,
    fontFamily: font.medium,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  notice: {
    ...shadow,
    alignSelf: 'stretch',
    backgroundColor: theme.surface,
    borderRadius: 24,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeTitle: {
    color: theme.ink,
    fontFamily: font.bold,
    fontSize: 16,
  },
  noticeText: {
    color: theme.ink,
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  primary: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: theme.ink,
    borderRadius: 18,
    paddingVertical: 16,
  },
  primaryText: {
    color: '#FFFFFF',
    fontFamily: font.bold,
    fontSize: 16,
  },
  messages: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  welcome: {
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    flexGrow: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  greeting: {
    color: theme.ink,
    fontFamily: font.bold,
    fontSize: 30,
    lineHeight: 37,
    textAlign: 'center',
  },
  suggestion: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
  },
  suggestionText: {
    color: theme.faint,
    fontFamily: font.medium,
    fontSize: 16,
  },
  question: {
    alignSelf: 'flex-end',
    backgroundColor: theme.ink,
    borderRadius: 22,
    maxWidth: '85%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  questionText: {
    color: '#FFFFFF',
    fontFamily: font.medium,
    fontSize: 16,
  },
  answer: {
    marginTop: spacing.md,
  },
  bubble: {
    backgroundColor: theme.surface,
    borderRadius: 22,
    padding: spacing.md,
  },
  answerText: {
    color: theme.ink,
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  bold: {
    fontFamily: font.bold,
  },
  error: {
    color: theme.error,
    fontFamily: font.medium,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  followUps: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  chip: {
    alignSelf: 'flex-end',
    borderColor: theme.accentLine,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  chipText: {
    color: theme.accent,
    fontFamily: font.semibold,
    fontSize: 14,
  },
  menu: {
    ...shadow,
    backgroundColor: theme.surface,
    borderRadius: 18,
    elevation: 6,
    marginHorizontal: spacing.lg,
    minWidth: 220,
    paddingVertical: 4,
  },
  headerMenu: {
    left: 0,
    position: 'absolute',
    top: 76,
    zIndex: 5,
  },
  actionsMenu: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  menuItem: {
    borderBottomColor: theme.line,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  menuText: {
    color: theme.ink,
    fontFamily: font.semibold,
    fontSize: 15,
  },
  voiceError: {
    paddingHorizontal: spacing.lg,
  },
  composer: {
    ...shadow,
    backgroundColor: theme.surface,
    borderRadius: 28,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  input: {
    color: theme.ink,
    fontFamily: font.medium,
    fontSize: 17,
    maxHeight: 120,
    minHeight: 52,
    paddingHorizontal: spacing.xs,
  },
  listening: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.xs,
  },
  listeningText: {
    color: theme.accent,
    fontFamily: font.semibold,
    fontSize: 17,
  },
  composerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  plainButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  mainButton: {
    alignItems: 'center',
    backgroundColor: theme.ink,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
});
