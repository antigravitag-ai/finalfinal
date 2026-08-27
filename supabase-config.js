window.__SUPABASE_CONFIG__ = window.__SUPABASE_CONFIG__ || {
  url: '',
  anonKey: ''
};

window.SUPABASE_URL = window.SUPABASE_URL || window.__SUPABASE_CONFIG__.url || '';
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || window.__SUPABASE_CONFIG__.anonKey || '';
