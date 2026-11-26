import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { assistantUrl, AssistantError } from './chat';

/** `dictate` puts the words in the text box; `ask` sends them straight away. */
export type VoiceMode = 'dictate' | 'ask';

const MAX_MILLIS = 60_000;
const MIN_MILLIS = 800;

// Speech needs one channel at a modest bit rate, which keeps uploads small.
const recordingOptions = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 };

async function transcribe(uri: string) {
  if (!assistantUrl) {
    throw new AssistantError('The assistant is not set up in this version yet.');
  }
  const timer = new AbortController();
  const timeout = setTimeout(() => timer.abort(), 70_000);
  try {
    const response = await fetch(`${assistantUrl}/v1/transcribe`, {
      body: new File(uri),
      headers: { 'Content-Type': 'audio/mp4' },
      method: 'POST',
      signal: timer.signal,
    });
    const body = (await response.json().catch(() => null)) as { text?: string; detail?: string } | null;
    if (!response.ok || typeof body?.text !== 'string') {
      throw new AssistantError(body?.detail ?? "I couldn't understand the recording. Please try again.");
    }
    return body.text.trim();
  } catch (error) {
    if (error instanceof AssistantError) {
      throw error;
    }
    throw new AssistantError("Can't reach the assistant. Check your internet connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
}

function deleteRecording(uri: string) {
  try {
    new File(uri).delete();
  } catch (error) {
    console.warn('Unable to delete a recording', error);
  }
}

export function useVoice(onText: (text: string, mode: VoiceMode) => void) {
  const recorder = useAudioRecorder(recordingOptions);
  const { durationMillis } = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [error, setError] = useState('');
  const modeRef = useRef<VoiceMode>('dictate');
  // Guards against double taps while the recorder is starting or stopping.
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    };
  }, []);

  async function start(mode: VoiceMode) {
    if (busyRef.current || phase !== 'idle') {
      return;
    }
    busyRef.current = true;
    setError('');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Fime needs microphone access to hear you. You can allow it in your phone settings.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      modeRef.current = mode;
      setPhase('recording');
    } catch (cause) {
      console.warn('Unable to start recording', cause);
      setError("The microphone couldn't start. Please try again.");
    } finally {
      busyRef.current = false;
    }
  }

  const stop = useCallback(
    async (keep: boolean) => {
      if (busyRef.current) {
        return;
      }
      busyRef.current = true;
      const length = recorder.getStatus().durationMillis;
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = recorder.uri;
        await setAudioModeAsync({ allowsRecording: false });
        if (!keep) {
          setPhase('idle');
          return;
        }
        if (!uri || length < MIN_MILLIS) {
          setError('That was too short. Hold on a little longer while you speak.');
          setPhase('idle');
          return;
        }
        setPhase('transcribing');
        const text = await transcribe(uri);
        if (!mountedRef.current) {
          return;
        }
        setPhase('idle');
        if (text) {
          onText(text, modeRef.current);
        } else {
          setError("I didn't hear any words. Please try again.");
        }
      } catch (cause) {
        if (!(cause instanceof AssistantError)) {
          console.warn('Voice input failed', cause);
        }
        setPhase('idle');
        setError(cause instanceof AssistantError ? cause.message : "That recording didn't work. Please try again.");
      } finally {
        busyRef.current = false;
        if (uri) {
          deleteRecording(uri);
        }
      }
    },
    [onText, recorder]
  );

  useEffect(() => {
    if (phase === 'recording' && durationMillis >= MAX_MILLIS) {
      stop(true);
    }
  }, [durationMillis, phase, stop]);

  return {
    cancel: () => stop(false),
    clearError: () => setError(''),
    done: () => stop(true),
    error,
    phase,
    seconds: Math.floor(durationMillis / 1000),
    start,
  };
}
