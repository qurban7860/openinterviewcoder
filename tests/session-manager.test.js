const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSession,
  getSessionContext,
  listSessions,
  setActiveSession,
} = require('../src/session-manager');

test('createSession stores a valid interview session and mode', () => {
  const session = createSession({
    name: 'Frontend Round',
    interviewType: 'coding',
    mode: 'coding-interview',
  });

  assert.equal(session.name, 'Frontend Round');
  assert.equal(session.interviewType, 'coding');
  assert.equal(session.mode, 'coding-interview');
  assert.ok(session.id);
});

test('session context is bounded and retains the latest messages', () => {
  const session = createSession({ name: 'Bounded session', interviewType: 'behavioral' });
  for (let index = 0; index < 20; index += 1) {
    session.messages.push({ type: 'user', content: `Question ${index}` });
    session.messages.push({ type: 'assistant', content: `Answer ${index}` });
  }

  const context = getSessionContext(session, 6);
  assert.ok(context.length <= 6);
  assert.equal(context[0].content, 'Question 19');
});

test('listSessions and setActiveSession maintain active IDs reliably', () => {
  const first = createSession({ name: 'Session 1', interviewType: 'system-design' });
  const second = createSession({ name: 'Session 2', interviewType: 'behavioral' });
  setActiveSession(second.id);

  const sessions = listSessions();
  assert.ok(sessions.some((entry) => entry.id === first.id));
  assert.ok(sessions.some((entry) => entry.id === second.id));
  assert.equal(sessions.find((entry) => entry.id === second.id).active, true);
});
