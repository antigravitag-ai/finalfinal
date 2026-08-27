(function () {
  const supabase = () => {
    if (!window.PyNovaSupabase || !window.PyNovaSupabase.auth) {
      return null;
    }
    return window.PyNovaSupabase;
  };

  function normalizeUsername(username) {
    return String(username || '').trim();
  }

  function slugifyUsername(value) {
    const cleaned = String(value || '').trim().toLowerCase();
    const slug = cleaned.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'user';
    return slug.slice(0, 32);
  }

  async function sha256Hex(value) {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function deriveSyntheticEmail(username) {
    const slug = slugifyUsername(username);
    const hash = await sha256Hex(`pynova:${slug}`);
    return `${slug}-${hash.slice(0, 12)}@example.com`;
  }

  async function fetchProfileByUserId(userId) {
    const client = supabase();
    if (!client || !userId) {
      return null;
    }

    const { data, error } = await client.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error) {
      console.warn('Unable to load profile', error);
      return null;
    }
    return data;
  }

  function emitAuthEvent(authenticated) {
    window.dispatchEvent(new CustomEvent('pynova-auth-state-changed', {
      detail: { authenticated: !!authenticated }
    }));
  }

  const authApi = {
    currentUser: null,
    sessionReady: false,
    isLoading: false,

    async initialize() {
      if (!this.sessionReady) {
        await this.refreshSession(true);
      }
      return this.currentUser;
    },

    async refreshSession(silent = false) {
      const client = supabase();
      if (!client) {
        this.sessionReady = true;
        this.currentUser = null;
        if (!silent) emitAuthEvent(false);
        return null;
      }

      this.isLoading = true;
      try {
        const { data: { session }, error } = await client.auth.getSession();
        if (error) {
          console.warn('Supabase session issue', error);
        }

        if (!session || !session.user) {
          this.currentUser = null;
          this.sessionReady = true;
          this.isLoading = false;
          if (!silent) emitAuthEvent(false);
          return null;
        }

        const profile = await fetchProfileByUserId(session.user.id);
        this.currentUser = {
          id: session.user.id,
          username: profile?.username || session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
          email: session.user.email,
          authUser: session.user
        };
        this.sessionReady = true;
        this.isLoading = false;
        if (!silent) emitAuthEvent(true);
        return session;
      } catch (error) {
        console.error('Supabase session init failed', error);
        this.currentUser = null;
        this.sessionReady = true;
        this.isLoading = false;
        if (!silent) emitAuthEvent(false);
        return null;
      }
    },

    async register(username, password, confirmPassword) {
      const cleanedUsername = normalizeUsername(username);
      if (!cleanedUsername) {
        return { ok: false, error: 'Username is required' };
      }
      if (!password) {
        return { ok: false, error: 'Password is required' };
      }
      if (password !== confirmPassword) {
        return { ok: false, error: 'Passwords do not match' };
      }

      const client = supabase();
      if (!client) {
        return { ok: false, error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.' };
      }

      const syntheticEmail = await deriveSyntheticEmail(cleanedUsername);
      const { data, error } = await client.auth.signUp({
        email: syntheticEmail,
        password,
        options: {
          data: { username: cleanedUsername }
        }
      });

      if (error) {
        const message = String(error.message || '').toLowerCase();
        if (message.includes('already') || message.includes('duplicate') || message.includes('taken')) {
          return { ok: false, error: 'Username already exists' };
        }
        return { ok: false, error: error.message || 'Unable to create account' };
      }

      const user = data?.user;
      if (!user) {
        return { ok: false, error: 'Unable to create account' };
      }

      const profilePayload = {
        user_id: user.id,
        username: cleanedUsername,
        xp: 0,
        level: 1,
        streak: 1,
        completed_lessons: {},
        quiz_scores: {},
        projects: {},
        avatar: '🤖',
        badges: ['badge_code'],
        last_active_date: new Date().toISOString(),
        activity: [{
          type: 'Account Created',
          detail: 'Welcome to Python AI!',
          date: new Date().toISOString()
        }],
        chat_history: [{
          id: 'chat_welcome',
          title: 'Welcome to Python AI',
          messages: [{
            sender: 'ai',
            text: 'Hello! I am your Python AI Teacher. Let\'s learn Python together. How can I help you today?',
            date: new Date().toISOString()
          }]
        }],
        active_roadmap_node: 'intro_to_python',
        skill_assessment_completed: false,
        settings: {
          leaderboardEnabled: true,
          theme: 'dark'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: profileData, error: profileError } = await client.from('profiles').upsert(profilePayload, { onConflict: 'user_id' }).select().single();
      if (profileError) {
        const message = String(profileError.message || '').toLowerCase();
        if (message.includes('duplicate') || message.includes('already') || message.includes('unique')) {
          await client.auth.signOut();
          return { ok: false, error: 'Username already exists' };
        }
        return { ok: false, error: profileError.message || 'Unable to create user profile' };
      }

      const session = await client.auth.signInWithPassword({ email: syntheticEmail, password });
      if (session.error) {
        return { ok: false, error: session.error.message || 'Unable to sign in' };
      }

      this.currentUser = {
        id: user.id,
        username: cleanedUsername,
        email: syntheticEmail,
        authUser: session.data?.user || user
      };
      this.sessionReady = true;
      emitAuthEvent(true);
      return { ok: true, user: this.currentUser, profile: profileData };
    },

    async signIn(username, password) {
      const cleanedUsername = normalizeUsername(username);
      if (!cleanedUsername) {
        return { ok: false, error: 'Username is required' };
      }
      if (!password) {
        return { ok: false, error: 'Password is required' };
      }

      const client = supabase();
      if (!client) {
        return { ok: false, error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.' };
      }

      const syntheticEmail = await deriveSyntheticEmail(cleanedUsername);
      const { data, error } = await client.auth.signInWithPassword({ email: syntheticEmail, password });
      if (error) {
        return { ok: false, error: 'Incorrect username or password' };
      }

      const profile = await fetchProfileByUserId(data.user.id);
      this.currentUser = {
        id: data.user.id,
        username: profile?.username || cleanedUsername,
        email: data.user.email,
        authUser: data.user
      };
      this.sessionReady = true;
      emitAuthEvent(true);
      return { ok: true, user: this.currentUser };
    },

    async logout() {
      const client = supabase();
      if (client) {
        await client.auth.signOut();
      }
      this.currentUser = null;
      this.sessionReady = true;
      emitAuthEvent(false);
      return true;
    },

    async getCurrentUser() {
      if (this.currentUser) {
        return this.currentUser;
      }

      const client = supabase();
      if (!client) {
        return null;
      }

      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) {
        this.currentUser = null;
        return null;
      }

      const profile = await fetchProfileByUserId(user.id);
      this.currentUser = {
        id: user.id,
        username: profile?.username || user.user_metadata?.username || user.email?.split('@')[0] || 'User',
        email: user.email,
        authUser: user
      };
      return this.currentUser;
    },

    isAuthenticated() {
      return !!this.currentUser;
    },

    onAuthStateChanged(callback) {
      if (typeof callback !== 'function') return () => {};
      const listener = () => callback(this.isAuthenticated());
      window.addEventListener('pynova-auth-state-changed', listener);
      listener();
      return () => window.removeEventListener('pynova-auth-state-changed', listener);
    }
  };

  window.PyNovaAuth = authApi;
  window.PyNovaAuth.initialize();
})();
