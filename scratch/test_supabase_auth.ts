import fs from 'fs';
import { supabase } from '../lib/supabase/client';

async function main() {
  const raw = fs.readFileSync('/tmp/active_session_fresh.json', 'utf8');
  const parsed = JSON.parse(raw);
  const token = parsed.access_token || parsed.currentSession?.access_token;
  console.log('Testing getUser with token present:', Boolean(token));
  try {
    const { data, error } = await supabase.auth.getUser(token);
    console.log('getUser result:', {
      hasUser: Boolean(data?.user),
      userId: data?.user?.id ? 'PRESENT' : 'NONE',
      error: error ? error.message : null,
      status: error?.status,
    });
  } catch (err: any) {
    console.error('Exception calling getUser:', err);
  }
}

main();
