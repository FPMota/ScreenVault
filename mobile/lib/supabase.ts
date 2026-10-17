// Bulletproof safeguard for oxc runtime in @supabase/supabase-js:
// Prevents TypeError: Cannot read properties of undefined (reading 'enumerable')
// when ownKeys runs on objects with symbols in React Native / Expo Web.
if (typeof Object.getOwnPropertyDescriptor === 'function') {
  const origGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  Object.getOwnPropertyDescriptor = function (target: any, prop: any) {
    const desc = origGetOwnPropertyDescriptor.call(Object, target, prop);
    if (!desc && typeof prop === 'symbol') {
      return { enumerable: false, configurable: true, writable: true, value: undefined };
    }
    return desc;
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://lwbkizefljmlnmlxourm.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_eyxqsTur9dpYcAh4uRRYSw_tTspMnNo';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

