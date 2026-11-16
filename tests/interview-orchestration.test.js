const test = require('node:test');
const assert = require('node:assert/strict');

const { buildInterviewSystemPrompt, buildInterviewUserMessage } = require('../src/interview-orchestration');

test('coding interviews include structured reasoning guidance', () => {
  const prompt = buildInterviewSystemPrompt({
    interviewType: 'coding',
    mode: 'coding-interview',
    role: 'Frontend Engineer',
    company: 'Acme',
  });

  assert.match(prompt, /Clarify requirements/i);
  assert.match(prompt, /time complexity/i);
  assert.match(prompt, /edge cases/i);
});

test('behavioral interviews avoid fabricating personal achievements', () => {
  const prompt = buildInterviewSystemPrompt({
    interviewType: 'behavioral',
    mode: 'behavioral',
    role: 'Product Engineer',
  });

  assert.match(prompt, /STAR/i);
  assert.match(prompt, /Never fabricate/i);
});

test('user message includes session context without forcing requirements', () => {
  const prompt = buildInterviewUserMessage({
    prompt: 'Explain this approach.',
    session: {
      name: 'Frontend round',
      role: 'Frontend Engineer',
      company: 'Acme',
      mode: 'coding-interview',
    },
  });

  assert.match(prompt, /Frontend round/i);
  assert.match(prompt, /Explain this approach\./i);
});

test('system prompt includes candidate background and role requirements', () => {
  const prompt = buildInterviewSystemPrompt({
    interviewType: 'general',
    mode: 'project-discussion',
    role: 'Staff Engineer',
    company: 'Northstar',
    background: 'Built a platform serving 5M users with a focus on reliability and observability.',
    jobDescription: 'Lead architecture, mentor engineers, and drive platform standards across the team.',
  });

  assert.match(prompt, /Built a platform serving 5M users/i);
  assert.match(prompt, /Lead architecture, mentor engineers/i);
});
