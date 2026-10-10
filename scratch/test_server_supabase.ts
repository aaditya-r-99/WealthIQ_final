import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function test() {
  console.log('Testing invalid token:');
  const res1 = await supabase.auth.getUser('invalid_token_123');
  console.log('res1:', {
    hasUser: Boolean(res1.data?.user),
    error: res1.error ? res1.error.message : null,
    status: res1.error?.status,
  });
}

test().catch(console.error);
