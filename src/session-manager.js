const { randomUUID } = require('crypto');

const sessions = new Map();
let activeSessionId = null;

function normalizeMode(mode) {
  if (!mode) return 'general';
  const cleaned = String(mode).trim().toLowerCase();
  return cleaned || 'general';
}

function createSession({
  name = 'New Interview Session',
  interviewType = 'general',
  mode = 'general',
  description = '',
  company = '',
  role = '',
  messages = [],
} = {}) {
  const id = randomUUID();
  const session = {
    id,
    name,
    interviewType,
    mode: normalizeMode(mode),
    description,
    company,
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: Array.isArray(messages) ? messages.map((message) => ({
      id: message.id || randomUUID(),
      type: message.type === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || ''),
      createdAt: message.createdAt || new Date().toISOString(),
    })) : [],
  };
  sessions.set(id, session);
  if (!activeSessionId) activeSessionId = id;
  return session;
}

function listSessions() {
  return Array.from(sessions.values())
    .map((session) => ({
      ...session,
      active: session.id === activeSessionId,
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function setActiveSession(sessionId) {
  if (!sessionId || !sessions.has(sessionId)) {
    throw new Error('Unknown session ID.');
  }
  activeSessionId = sessionId;
  return sessions.get(sessionId);
}

function getActiveSession() {
  return sessions.get(activeSessionId) || null;
}

function appendMessage(sessionId, message) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Unable to find that session.');
  }

  const entry = {
    id: message.id || randomUUID(),
    type: message.type === 'assistant' ? 'assistant' : 'user',
    content: String(message.content || ''),
    createdAt: message.createdAt || new Date().toISOString(),
  };

  session.messages.push(entry);
  session.updatedAt = new Date().toISOString();
  return entry;
}

function updateSessionMeta(sessionId, updates = {}) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Unable to find that session.');
  }

  const next = {
    ...session,
    ...updates,
    mode: normalizeMode(updates.mode || session.mode || 'general'),
    updatedAt: new Date().toISOString(),
  };

  if (typeof updates.name === 'string' && updates.name.trim()) {
    next.name = updates.name.trim();
  }
  if (typeof updates.role === 'string') next.role = updates.role.trim();
  if (typeof updates.company === 'string') next.company = updates.company.trim();
  if (typeof updates.description === 'string') next.description = updates.description.trim();
  if (typeof updates.interviewType === 'string') next.interviewType = updates.interviewType.trim();

  sessions.set(sessionId, next);
  return next;
}

function getSessionContext(session, limit = 10) {
  const source = session && Array.isArray(session.messages) ? session.messages : [];
  const bounded = source.slice(-limit);
  const recentQuestions = bounded
    .filter((message) => message && message.type === 'user')
    .slice(-limit)
    .reverse();

  if (recentQuestions.length) {
    return recentQuestions.map((message) => ({
      role: 'user',
      content: message.content,
    }));
  }

  return bounded
    .slice()
    .reverse()
    .map((message) => ({
      role: message.type === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }));
}

module.exports = {
  activeSessionId,
  appendMessage,
  createSession,
  getActiveSession,
  getSessionContext,
  listSessions,
  setActiveSession,
  updateSessionMeta,
};
