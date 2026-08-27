(function () {
  const url = String(window.SUPABASE_URL || window.__SUPABASE_CONFIG__?.url || '').trim();
  const anonKey = String(window.SUPABASE_ANON_KEY || window.__SUPABASE_CONFIG__?.anonKey || '').trim();

  if (!url || !anonKey) {
    console.warn('Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in your environment or window.__SUPABASE_CONFIG__.');
    window.PyNovaSupabase = {
      _isConfigured: false,
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        signUp: async () => ({ data: { user: null }, error: { message: 'Supabase is not configured.' } }),
        signInWithPassword: async () => ({ data: { user: null }, error: { message: 'Supabase is not configured.' } }),
        signOut: async () => ({ error: null })
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'Supabase is not configured.' } }) }) }),
        upsert: async () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'Supabase is not configured.' } }) }) })
      })
    };
    return;
  }

  window.PyNovaSupabase = window.supabase.createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  window.PyNovaSupabase._isConfigured = true;
})();
