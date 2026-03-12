import { supabase } from './supabase';

// Only these emails can access the CRM
const ALLOWED_EMAILS = [
  'j@mantiai.com',
  'sjseun@mantiai.com',
];

export function isEmailAllowed(email) {
  return ALLOWED_EMAILS.includes(email?.toLowerCase());
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => callback(event, session)
  );
  return subscription;
}
