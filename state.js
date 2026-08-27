// PyNova AI - Global State Management

const DEFAULT_STATE = {
  profile: {
    userId: 'guest',
    username: 'User',
    avatar: '🤖',
    level: 1,
    xp: 0,
    streak: 1,
    lastActiveDate: new Date().toDateString(),
    badges: ['badge_code'],
    stats: {
      lessonsCompleted: 0,
      challengesSolved: 0,
      quizzesCompleted: 0,
      debugsRun: 0,
      projectsCompleted: 0
    }
  },
  progress: {
    lessons: {},
    quizzes: {},
    challenges: {},
    projects: {}
  },
  weakTopics: [],
  activity: [],
  chatHistory: [
    {
      id: 'chat_welcome',
      title: 'Welcome to Python AI',
      messages: [
        { sender: 'ai', text: 'Hello! I am your Python AI Teacher. Let\'s learn Python together. How can I help you today?', date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]
    }
  ],
  activeRoadmapNode: 'intro_to_python',
  skillAssessmentCompleted: false,
  settings: {
    leaderboardEnabled: true,
    theme: 'dark'
  }
};

class StateManager {
  constructor() {
    this.state = this.buildDefaultState();
    this.listeners = [];
    this.init();
  }

  getCurrentUser() {
    if (window.PyNovaAuth && window.PyNovaAuth.currentUser) {
      return window.PyNovaAuth.currentUser;
    }
    return null;
  }

  buildDefaultState(user = null) {
    const base = JSON.parse(JSON.stringify(DEFAULT_STATE));
    const username = user && user.username ? user.username : 'User';
    const userId = user && user.id ? user.id : 'guest';

    base.profile.userId = userId;
    base.profile.username = username;
    base.profile.lastActiveDate = new Date().toDateString();
    base.activity = [{
      type: 'Account Created',
      detail: `Welcome to Python AI, ${username}!`,
      date: new Date().toISOString()
    }];
    base.chatHistory = [{
      id: 'chat_welcome',
      title: 'Welcome to Python AI',
      messages: [{
        sender: 'ai',
        text: `Hello ${username}! I am your Python AI Teacher. Let's learn Python together. How can I help you today?`,
        date: new Date().toISOString()
      }]
    }];
    return base;
  }

  normalizeLoadedState(profileData, user) {
    const base = this.buildDefaultState(user || this.getCurrentUser());
    const completedLessons = profileData.completed_lessons || {};
    const quizScores = profileData.quiz_scores || {};
    const projectData = profileData.projects || {};

    base.profile.userId = profileData.user_id || base.profile.userId;
    base.profile.username = profileData.username || base.profile.username;
    base.profile.avatar = profileData.avatar || base.profile.avatar;
    base.profile.level = Number(profileData.level || 1);
    base.profile.xp = Number(profileData.xp || 0);
    base.profile.streak = Number(profileData.streak || 1);
    base.profile.lastActiveDate = profileData.last_active_date ? new Date(profileData.last_active_date).toDateString() : new Date().toDateString();
    base.profile.badges = Array.isArray(profileData.badges) && profileData.badges.length ? profileData.badges : ['badge_code'];
    base.profile.stats.lessonsCompleted = Object.keys(completedLessons).length;
    base.profile.stats.challengesSolved = Object.keys(base.progress.challenges || {}).length;
    base.profile.stats.quizzesCompleted = Object.keys(quizScores).length;
    base.profile.stats.projectsCompleted = Object.keys(projectData).length;
    base.progress.lessons = completedLessons;
    base.progress.quizzes = quizScores;
    base.progress.projects = projectData && typeof projectData === 'object' ? projectData : {};
    base.weakTopics = Array.isArray(profileData.weak_topics) ? profileData.weak_topics : [];
    base.activity = Array.isArray(profileData.activity) ? profileData.activity : base.activity;
    base.chatHistory = Array.isArray(profileData.chat_history) ? profileData.chat_history : base.chatHistory;
    base.activeRoadmapNode = profileData.active_roadmap_node || base.activeRoadmapNode;
    base.skillAssessmentCompleted = !!profileData.skill_assessment_completed;
    base.settings = { ...DEFAULT_STATE.settings, ...(profileData.settings || {}) };
    return base;
  }

  async refreshFromSupabase() {
    const user = this.getCurrentUser();
    const client = window.PyNovaSupabase;
    if (!client || !user || !user.id) {
      return;
    }

    const { data, error } = await client.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) {
      console.warn('No profile row available yet:', error);
      return;
    }
    if (!data) {
      return;
    }

    this.state = this.normalizeLoadedState(data, user);
    this.notifyListeners();
  }

  init() {
    const user = this.getCurrentUser();
    this.state = this.buildDefaultState(user);
    if (window.PyNovaSupabase && window.PyNovaSupabase._isConfigured) {
      setTimeout(() => this.refreshFromSupabase(), 0);
    }
  }

  save() {
    const client = window.PyNovaSupabase;
    const user = this.getCurrentUser();
    if (!client || !client._isConfigured || !user || !user.id) {
      return;
    }

    this.state.profile.userId = user.id;
    this.state.profile.username = user.username || this.state.profile.username;
    this.state.profile.stats.lessonsCompleted = Object.keys(this.state.progress.lessons || {}).length;
    this.state.profile.stats.quizzesCompleted = Object.keys(this.state.progress.quizzes || {}).length;
    this.state.profile.stats.projectsCompleted = Object.keys(this.state.progress.projects || {}).length;

    const payload = {
      user_id: user.id,
      username: this.state.profile.username,
      xp: Number(this.state.profile.xp || 0),
      level: Number(this.state.profile.level || 1),
      streak: Number(this.state.profile.streak || 1),
      completed_lessons: this.state.progress.lessons || {},
      quiz_scores: this.state.progress.quizzes || {},
      projects: this.state.progress.projects || {},
      avatar: this.state.profile.avatar || '🤖',
      badges: Array.isArray(this.state.profile.badges) ? this.state.profile.badges : ['badge_code'],
      last_active_date: new Date().toISOString(),
      activity: Array.isArray(this.state.activity) ? this.state.activity : [],
      chat_history: Array.isArray(this.state.chatHistory) ? this.state.chatHistory : [],
      active_roadmap_node: this.state.activeRoadmapNode || 'intro_to_python',
      skill_assessment_completed: !!this.state.skillAssessmentCompleted,
      settings: this.state.settings || { leaderboardEnabled: true, theme: 'dark' },
      updated_at: new Date().toISOString()
    };

    client.from('profiles').upsert(payload, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) {
        console.warn('Could not save profile state', error);
      }
      window.dispatchEvent(new CustomEvent('pynova-profile-updated', {
        detail: { userId: user.id }
      }));
    });

    this.notifyListeners();
  }

  reset() {
    const user = this.getCurrentUser();
    this.state = this.buildDefaultState(user);
    this.save();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  updateStreak() {
    const today = new Date().toDateString();
    const lastActive = this.state.profile.lastActiveDate;

    if (lastActive !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastActive === yesterday.toDateString()) {
        this.state.profile.streak += 1;
        this.addActivity('Streak Maintained', `You're on a ${this.state.profile.streak}-day learning streak! 🔥`);
        if (this.state.profile.streak >= 7) {
          this.awardBadge('badge_streak');
        }
      } else {
        this.state.profile.streak = 1;
      }
      this.state.profile.lastActiveDate = today;
    }
  }

  addXp(amount) {
    const oldLevel = this.state.profile.level;
    this.state.profile.xp += amount;

    const newLevel = Math.floor(Math.sqrt(this.state.profile.xp / 100)) + 1;
    this.addActivity('XP Earned', `+${amount} XP gained`);

    if (this.state.profile.xp >= 2000) {
      this.awardBadge('badge_master');
    }

    if (newLevel > oldLevel) {
      this.state.profile.level = newLevel;
      this.addActivity('Level Up', `Congratulations! You reached Level ${newLevel}! 🏆`);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('pynova-level-up', { detail: { level: newLevel } }));
      }, 500);
    }

    this.save();
  }

  getXpProgress() {
    const lvl = this.state.profile.level;
    const currentLevelXp = (lvl - 1) * (lvl - 1) * 100;
    const nextLevelXp = lvl * lvl * 100;
    const xpInLevel = this.state.profile.xp - currentLevelXp;
    const xpNeededForLevel = nextLevelXp - currentLevelXp;
    const percentage = Math.min(100, Math.max(0, (xpInLevel / xpNeededForLevel) * 100));

    return {
      currentLevelXp,
      nextLevelXp,
      xpInLevel,
      xpNeededForLevel,
      percentage
    };
  }

  completeLesson(lessonId, xpReward = 50) {
    if (!this.state.progress.lessons[lessonId]) {
      this.state.progress.lessons[lessonId] = true;
      this.state.profile.stats.lessonsCompleted += 1;
      this.addActivity('Lesson Completed', `Finished lesson: ${this.formatId(lessonId)}`);

      if (this.state.profile.stats.lessonsCompleted === 1) {
        this.awardBadge('badge_beg');
      }

      this.addXp(xpReward);
      this.save();
    }
  }

  completeQuiz(quizId, score, total, xpReward = 80) {
    const existing = this.state.progress.quizzes[quizId];
    if (!existing || score > existing.score) {
      this.state.progress.quizzes[quizId] = { score, total, date: new Date().toDateString() };
      this.state.profile.stats.quizzesCompleted += 1;
      this.addActivity('Quiz Completed', `Scored ${score}/${total} on ${this.formatId(quizId)}`);

      if (score === total) {
        this.awardBadge('badge_quiz');
      }

      this.addXp(xpReward);
      this.save();
    }
  }

  solveChallenge(challengeId, xpReward = 100) {
    if (!this.state.progress.challenges[challengeId]) {
      this.state.progress.challenges[challengeId] = true;
      this.state.profile.stats.challengesSolved += 1;
      this.addActivity('Challenge Solved', `Solved code arena: ${this.formatId(challengeId)}`);
      this.addXp(xpReward);
      this.save();
    }
  }

  completeProjectTask(projectId, taskId, status) {
    if (!this.state.progress.projects[projectId]) {
      this.state.progress.projects[projectId] = { tasks: {}, completed: false };
    }
    this.state.progress.projects[projectId].tasks[taskId] = status;
    this.save();
  }

  completeProject(projectId, xpReward = 250) {
    if (!this.state.progress.projects[projectId]) {
      this.state.progress.projects[projectId] = { tasks: {}, completed: false };
    }
    if (!this.state.progress.projects[projectId].completed) {
      this.state.progress.projects[projectId].completed = true;
      this.state.profile.stats.projectsCompleted += 1;
      this.addActivity('Project Built', `Completed project: ${this.formatId(projectId)} 🚀`);
      this.awardBadge('badge_project');
      this.addXp(xpReward);
      this.save();
    }
  }

  incrementDebugCount() {
    this.state.profile.stats.debugsRun += 1;
    if (this.state.profile.stats.debugsRun === 1) {
      this.awardBadge('badge_bug');
    }
    this.save();
  }

  awardBadge(badgeId) {
    if (!this.state.profile.badges.includes(badgeId)) {
      this.state.profile.badges.push(badgeId);
      this.addActivity('Badge Earned', `Unlocked badge: ${badgeId}`);
      this.save();

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('pynova-badge-earned', { detail: { badgeId } }));
      }, 500);
    }
  }

  addActivity(type, detail) {
    this.state.activity.unshift({
      type,
      detail,
      date: new Date().toISOString()
    });
    if (this.state.activity.length > 15) {
      this.state.activity.pop();
    }
  }

  addWeakTopic(topic) {
    if (!this.state.weakTopics.includes(topic)) {
      this.state.weakTopics.push(topic);
      this.save();
    }
  }

  removeWeakTopic(topic) {
    this.state.weakTopics = this.state.weakTopics.filter(t => t !== topic);
    this.save();
  }

  addChatMessage(chatId, sender, text) {
    let chat = this.state.chatHistory.find(c => c.id === chatId);
    if (!chat) {
      chat = { id: chatId, title: text.substring(0, 25) + '...', messages: [] };
      this.state.chatHistory.unshift(chat);
    }
    chat.messages.push({
      sender,
      text,
      date: new Date().toISOString()
    });
    if (chat.messages.length === 2 && chat.id !== 'chat_welcome') {
      chat.title = chat.messages[0].text.substring(0, 25) + '...';
    }
    this.save();
  }

  createNewChat() {
    const id = 'chat_' + Date.now();
    const newChat = {
      id,
      title: 'New AI Teacher Session',
      messages: [{
        sender: 'ai',
        text: 'Hello! I\'m ready for another study session. Ask me any Python question, or select a lesson topic you want to dive into!',
        date: new Date().toISOString()
      }]
    };
    this.state.chatHistory.unshift(newChat);
    this.save();
    return id;
  }

  formatId(id) {
    return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

window.PyNovaState = new StateManager();
