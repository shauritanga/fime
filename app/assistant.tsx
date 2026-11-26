import { Mascot } from '@/components/assistant/Mascot';
import { ReplyText } from '@/components/assistant/ReplyText';
import { TypingDots } from '@/components/assistant/TypingDots';
import { palette, radii, spacing } from '@/constants/theme';
import { ask, newChat, useChat } from '@/lib/assistant/store';
import { useVoice, type VoiceMode } from '@/lib/assistant/useVoice';
import { useAuth } from '@/lib/auth/AuthContext';
import { getSetting, setSetting } from '@/lib/finance/database';
import { openPrivacyPolicy } from '@/lib/privacy';
import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Raised whenever what the assistant does with data changes, so people agree to it again.
const CONSENT_KEY = 'assistant-consent-v3';

type IconName = SymbolViewProps['name'];

const icons = {
  add: { ios: 'plus', android: 'add', web: 'add' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  menu: { ios: 'line.3.horizontal', android: 'notes', web: 'notes' },
  mic: { ios: 'mic', android: 'mic_none', web: 'mic_none' },
  newChat: { ios: 'plus.bubble', android: 'add_comment', web: 'add_comment' },
  send: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  sparkle: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  voice: { ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' },
} satisfies Record<string, IconName>;

export default function AssistantScreen() {
  const db = useSQLiteContext();
  const { isLoading, isSignedIn } = useAuth();
  const { turns, busy } = useChat();
  // `null` while the saved choice is being read.
  const [consented, setConsented] = useState<boolean | null>(null);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<'header' | 'actions' | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // The composer rides on top of the keyboard. This follows the keyboard's own height, which works
  // the same whether or not Android resizes the window.
  const insets = useSafeAreaInsets();
  const keyboard = useReanimatedKeyboardAnimation();
  const bottomSpace = useAnimatedStyle(() => ({
    // `height` is negative while the keyboard is up.
    paddingBottom: Math.max(-keyboard.height.value, insets.bottom),
  }));

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
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        <Animated.View style={[styles.flex, bottomSpace]}>
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
              style={({ pressed }) => [styles.titlePill, pressed && styles.pressed]}>
              <SymbolView name={icons.sparkle} size={18} tintColor={palette.emerald} />
              <Text style={styles.titleText}>Assistant</Text>
            </Pressable>
            <View style={styles.flex} />
            {consented ? (
              <IconButton
                icon={icons.newChat}
                label="New chat"
                onPress={() => {
                  newChat();
                  setDraft('');
                  setMenu(null);
                }}
              />
            ) : null}
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
                <Text style={styles.noticeText}>
                  • It can read your data, and it sets or replaces a budget as soon as you ask it to. It
                  cannot change anything else. Answers can be wrong, so check what it saved.
                </Text>
              </View>
              <Pressable accessibilityRole="link" onPress={openPrivacyPolicy} style={styles.policyLink}>
                <Text style={styles.policyText}>Read the privacy policy</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={accept} style={styles.primary}>
                <Text style={styles.primaryText}>Turn on assistant</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <>
              <ScrollView
                contentContainerStyle={styles.messages}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => turns.length > 0 && scrollRef.current?.scrollToEnd({ animated: true })}
                onTouchStart={() => setMenu(null)}
                ref={scrollRef}
                showsVerticalScrollIndicator={false}>
                {turns.map((turn) => (
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
                ))}

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

                {recording || transcribing ? (
                  <View accessibilityLiveRegion="polite" style={styles.listening}>
                    <Text numberOfLines={1} style={styles.listeningText}>
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
                    placeholder="Ask Fime"
                    placeholderTextColor={palette.muted}
                    style={styles.input}
                    value={draft}
                  />
                )}

                {!recording ? (
                  <IconButton
                    disabled={transcribing}
                    icon={icons.mic}
                    label="Dictate your question"
                    onPress={() => voice.start('dictate')}
                    plain
                  />
                ) : null}
                <Pressable
                  accessibilityLabel={recording ? 'Finish recording' : hasDraft ? 'Send' : 'Ask with your voice'}
                  accessibilityRole="button"
                  disabled={transcribing || (busy && !recording)}
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
                    size={22}
                    tintColor={palette.white}
                  />
                </Pressable>
              </View>
            </>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function IconButton({
  disabled,
  icon,
  label,
  onPress,
  plain,
}: {
  disabled?: boolean;
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
      <SymbolView name={icon} size={26} tintColor={palette.ink} />
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

// A barely tinted page, so the white buttons and composer stand out by their shadows.
const chatBackground = '#FAFBFA';
const softShadow = {
  elevation: 3,
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: chatBackground,
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
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  circle: {
    ...softShadow,
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  titlePill: {
    alignItems: 'center',
    backgroundColor: palette.emeraldSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 48,
    paddingHorizontal: spacing.md,
  },
  titleText: {
    color: palette.emerald,
    fontSize: 16,
    fontWeight: '800',
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
  policyLink: {
    justifyContent: 'center',
    minHeight: 40,
  },
  policyText: {
    color: palette.emerald,
    fontSize: 14,
    fontWeight: '800',
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
  greeting: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 35,
    textAlign: 'center',
  },
  question: {
    alignSelf: 'flex-end',
    backgroundColor: '#EDF0EE',
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
    top: 68,
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
    ...softShadow,
    alignItems: 'flex-end',
    backgroundColor: palette.white,
    borderRadius: 30,
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: 6,
  },
  input: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 48,
    paddingVertical: 12,
  },
  listening: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
  },
  listeningText: {
    color: palette.emerald,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  plainButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 46,
  },
  mainButton: {
    alignItems: 'center',
    backgroundColor: palette.emerald,
    borderRadius: 999,
    height: 46,
    justifyContent: 'center',
    marginBottom: 1,
    marginLeft: 2,
    width: 46,
  },
});
