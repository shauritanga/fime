import { Mascot } from '@/components/assistant/Mascot';
import { ReplyText } from '@/components/assistant/ReplyText';
import { TypingDots } from '@/components/assistant/TypingDots';
import { palette, radii, spacing } from '@/constants/theme';
import { ask, newChat, useChat } from '@/lib/assistant/store';
import { useVoice, type VoiceMode } from '@/lib/assistant/useVoice';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSetting, setSetting } from '@/lib/finance/database';
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

export default function AssistantScreen() {
  const db = useSQLiteContext();
  const { isLoading, isSignedIn } = useAuth();
  const { turns, busy } = useChat();
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

  const last = turns[turns.length - 1];
  const recording = voice.phase === 'recording';
  const transcribing = voice.phase === 'transcribing';
  const hasDraft = draft.trim().length > 0;

  return (
    <View style={styles.screen}>
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
              <Text style={styles.titleText}>Assistant</Text>
              {consented ? <SymbolView name={icons.chevron} size={20} tintColor={palette.muted} /> : null}
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
                          <SymbolView name={item.icon} size={20} tintColor={palette.muted} />
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
                          <ReplyText reply={turn.answer} />
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
                    placeholderTextColor={palette.muted}
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
                      tintColor={palette.white}
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
      <SymbolView name={icon} size={26} tintColor={faint ? palette.muted : palette.ink} />
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

const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.background,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  circle: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  title: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 48,
  },
  titleText: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '900',
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
  messages: {
    gap: spacing.md,
    padding: spacing.md,
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
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 35,
    textAlign: 'center',
  },
  suggestion: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
  },
  suggestionText: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: '600',
  },
  question: {
    alignSelf: 'flex-end',
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.lg,
    maxWidth: '85%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  questionText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  answer: {
    marginTop: spacing.md,
  },
  error: {
    color: palette.coral,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  chip: {
    alignSelf: 'flex-start',
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
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    elevation: 6,
    marginHorizontal: spacing.md,
    minWidth: 220,
    paddingVertical: 4,
  },
  headerMenu: {
    left: 0,
    position: 'absolute',
    top: 72,
    zIndex: 5,
  },
  actionsMenu: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
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
  voiceError: {
    paddingHorizontal: spacing.md,
  },
  composer: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    elevation: 2,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: 4,
  },
  input: {
    color: palette.ink,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 50,
    paddingHorizontal: spacing.sm,
  },
  listening: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.sm,
  },
  listeningText: {
    color: palette.emerald,
    fontSize: 16,
    fontWeight: '800',
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
    backgroundColor: palette.emerald,
    borderRadius: radii.md,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
});
