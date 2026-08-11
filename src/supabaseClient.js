import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'IL_TUO_PROJECT_URL';
const supabaseAnonKey = 'LA_TUA_CHIAVE_ANON';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
