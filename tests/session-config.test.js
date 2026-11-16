const test = require('node:test');
const assert = require('node:assert/strict');

const { updateSessionMeta, createSession } = require('../src/session-manager');

test('session metadata persists role, company, and mode settings', () => {
  const session = createSession({
    name: 'System Design',
    interviewType: 'system-design',
    mode: 'system-design',
  });

  const updated = updateSessionMeta(session.id, {
    role: 'Senior Backend Engineer',
    company: 'Northstar Labs',
    mode: 'system-design',
  });

  assert.equal(updated.role, 'Senior Backend Engineer');
  assert.equal(updated.company, 'Northstar Labs');
  assert.equal(updated.mode, 'system-design');
});
