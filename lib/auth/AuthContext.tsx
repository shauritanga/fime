import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

const PROFILE_KEY = 'fime.profile.v1';
const CREDENTIAL_KEY = 'fime.credential.v1';
const SESSION_KEY = 'fime.session.v1';

type StoredCredential = {
  passwordHash: string;
  salt: string;
};

export type UserProfile = {
  id: string;
  imageUri?: string;
  name: string;
  phoneNumber: string;
  initials: string;
  createdAt: string;
};

type RegisterInput = {
  name: string;
  password: string;
  phoneNumber: string;
};

type SignInInput = {
  password: string;
  phoneNumber: string;
};

type UpdateProfileInput = {
  imageUri?: string;
  name: string;
  phoneNumber: string;
};

type AuthContextValue = {
  isLoading: boolean;
  isSignedIn: boolean;
  profile: UserProfile | null;
  register: (input: RegisterInput) => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const [storedProfile, storedSession] = await Promise.all([
          readStorage(PROFILE_KEY),
          readStorage(SESSION_KEY),
        ]);

        if (!mounted) {
          return;
        }

        const parsedProfile = storedProfile ? parseProfile(storedProfile) : null;
        setProfile(parsedProfile);
        setIsSignedIn(Boolean(parsedProfile && storedSession === parsedProfile.id));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const register = useCallback(async ({ name, password, phoneNumber }: RegisterInput) => {
    const normalizedName = normalizeName(name);
    const normalizedPhone = normalizePhone(phoneNumber);
    validateProfile(normalizedName, normalizedPhone);
    validatePassword(password);

    const nextProfile: UserProfile = {
      createdAt: new Date().toISOString(),
      id: Crypto.randomUUID(),
      initials: initialsFromName(normalizedName),
      name: normalizedName,
      phoneNumber: normalizedPhone,
    };
    const credential = await createCredential(password);

    await Promise.all([
      writeStorage(PROFILE_KEY, JSON.stringify(nextProfile)),
      writeStorage(CREDENTIAL_KEY, JSON.stringify(credential)),
      writeStorage(SESSION_KEY, nextProfile.id),
    ]);

    setProfile(nextProfile);
    setIsSignedIn(true);
  }, []);

  const signIn = useCallback(async ({ password, phoneNumber }: SignInInput) => {
    const normalizedPhone = normalizePhone(phoneNumber);
    const [storedProfile, storedCredential] = await Promise.all([
      readStorage(PROFILE_KEY),
      readStorage(CREDENTIAL_KEY),
    ]);
    const nextProfile = storedProfile ? parseProfile(storedProfile) : null;
    const credential = storedCredential ? parseCredential(storedCredential) : null;

    if (!nextProfile || !credential) {
      throw new Error('Create an account on this device before logging in.');
    }
    if (normalizePhone(nextProfile.phoneNumber) !== normalizedPhone) {
      throw new Error('That phone number does not match this device profile.');
    }

    const passwordHash = await hashPassword(password, credential.salt);
    if (passwordHash !== credential.passwordHash) {
      throw new Error('The password is incorrect.');
    }

    await writeStorage(SESSION_KEY, nextProfile.id);
    setProfile(nextProfile);
    setIsSignedIn(true);
  }, []);

  const signOut = useCallback(async () => {
    await deleteStorage(SESSION_KEY);
    setIsSignedIn(false);
  }, []);

  const updateProfile = useCallback(
    async ({ imageUri, name, phoneNumber }: UpdateProfileInput) => {
      if (!profile) {
        throw new Error('No profile is available to update.');
      }

      const normalizedName = normalizeName(name);
      const normalizedPhone = normalizePhone(phoneNumber);
      validateProfile(normalizedName, normalizedPhone);

      const nextProfile: UserProfile = {
        ...profile,
        imageUri,
        initials: initialsFromName(normalizedName),
        name: normalizedName,
        phoneNumber: normalizedPhone,
      };

      await writeStorage(PROFILE_KEY, JSON.stringify(nextProfile));
      setProfile(nextProfile);
    },
    [profile]
  );

  const value = useMemo(
    () => ({
      isLoading,
      isSignedIn,
      profile,
      register,
      signIn,
      signOut,
      updateProfile,
    }),
    [isLoading, isSignedIn, profile, register, signIn, signOut, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

function parseProfile(value: string) {
  return JSON.parse(value) as UserProfile;
}

function parseCredential(value: string) {
  return JSON.parse(value) as StoredCredential;
}

async function createCredential(password: string): Promise<StoredCredential> {
  const salt = bytesToHex(Crypto.getRandomBytes(16));
  return {
    passwordHash: await hashPassword(password, salt),
    salt,
  };
}

async function hashPassword(password: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizePhone(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function validateProfile(name: string, phoneNumber: string) {
  if (name.length < 2) {
    throw new Error('Enter your full name.');
  }
  if (phoneNumber.length < 7) {
    throw new Error('Enter a valid phone number.');
  }
}

function validatePassword(password: string) {
  if (password.length < 6) {
    throw new Error('Use at least 6 characters for your password.');
  }
}

function initialsFromName(name: string) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'FI';
}

async function readStorage(key: string) {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }

  const available = await SecureStore.isAvailableAsync();
  if (!available) {
    return null;
  }
  return SecureStore.getItemAsync(key);
}

async function writeStorage(key: string, value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function deleteStorage(key: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}
