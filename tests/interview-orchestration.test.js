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

test('session suggestions adapt to the role, company, and interview mode', () => {
  const suggestions = require('../src/interview-orchestration').buildInterviewSuggestions({
    role: 'Platform Engineer',
    company: 'Northstar',
    mode: 'system-design',
    background: 'Migrated our event pipeline to Kafka with strict reliability goals.',
    jobDescription: 'Design and operate a realtime platform with strong observability and resilience requirements.',
  });

  assert.ok(suggestions.length >= 3);
  assert.ok(suggestions.some((item) => /architecture|trade-off|scalab|reliab|observab/i.test(item)));
  assert.ok(suggestions.some((item) => /Kafka|event|pipeline|platform/i.test(item)));
});

test('focus areas map to the session mode and role requirements', () => {
  const focusAreas = require('../src/interview-orchestration').buildInterviewFocusAreas({
    mode: 'system-design',
    role: 'Platform Engineer',
    company: 'Northstar',
    jobDescription: 'Design and operate a realtime platform with strong observability and resilience requirements.',
  });

  assert.ok(focusAreas.length >= 3);
  assert.ok(focusAreas.some((item) => /architecture|scalab|reliab|observab/i.test(item)));
  assert.ok(focusAreas.some((item) => /Northstar|Platform Engineer/i.test(item)));
});

test('readiness summary highlights key role, company, and mode context', () => {
  const summary = require('../src/interview-orchestration').buildInterviewReadinessSummary({
    mode: 'behavioral',
    role: 'Senior Frontend Engineer',
    company: 'Northstar',
    background: 'Led our design system migration and improved app performance across the platform.',
    jobDescription: 'Drive frontend architecture, mentoring, and product quality across teams.',
  });

  assert.match(summary, /Senior Frontend Engineer/i);
  assert.match(summary, /Northstar/i);
  assert.match(summary, /Behavioral/i);
  assert.match(summary, /design system|performance|mentoring/i);
});

test('interview checklist covers the most important conversation checkpoints for the active mode', () => {
  const checklist = require('../src/interview-orchestration').buildInterviewChecklist({
    mode: 'coding-interview',
    role: 'Backend Engineer',
    company: 'Northstar',
  });

  assert.ok(checklist.length >= 3);
  assert.ok(checklist.some((item) => /clarify|requirements|constraints/i.test(item)));
  assert.ok(checklist.some((item) => /complexity|edge cases|testing/i.test(item)));
  assert.ok(checklist.some((item) => /Northstar|Backend Engineer/i.test(item)));
});
