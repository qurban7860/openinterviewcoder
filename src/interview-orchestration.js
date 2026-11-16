const DEFAULT_INTERVIEW_MODE = 'general';

const MODE_DEFINITIONS = {
  'coding-interview': {
    title: 'Coding Interview',
    guidance: [
      'Clarify requirements when necessary.',
      'Explain the approach before implementation.',
      'Provide a correct solution, complexity analysis, and edge-case discussion.',
      'Keep the answer concise but useful for an interview conversation.',
    ],
  },
  'system-design': {
    title: 'System Design',
    guidance: [
      'State assumptions and requirements before proposing the architecture.',
      'Discuss components, trade-offs, scaling, reliability, and API contracts.',
      'Keep the answer structured and practical for design interviews.',
    ],
  },
  behavioral: {
    title: 'Behavioral Interview',
    guidance: [
      'Use a clear STAR-style structure when appropriate.',
      'Describe real experiences accurately and avoid fabricating achievements or metrics.',
      'Keep the answer natural, credible, and specific to the role.',
    ],
  },
  'project-discussion': {
    title: 'Project Discussion',
    guidance: [
      'Explain the problem, trade-offs, implementation, and measurable outcomes only when confirmed.',
      'Be honest about risks, assumptions, and lessons learned.',
    ],
  },
  general: {
    title: 'General Interview',
    guidance: [
      'Answer directly and clearly.',
      'Stay concise while remaining practical and professional.',
    ],
  },
};

function normalizeInterviewMode(mode) {
  if (!mode || typeof mode !== 'string') return DEFAULT_INTERVIEW_MODE;
  const cleaned = mode.trim().toLowerCase();
  return MODE_DEFINITIONS[cleaned] ? cleaned : DEFAULT_INTERVIEW_MODE;
}

function buildInterviewSystemPrompt({
  interviewType = 'general',
  mode = 'general',
  role = '',
  company = '',
  description = '',
  background = '',
  jobDescription = '',
} = {}) {
  const normalizedMode = normalizeInterviewMode(mode || interviewType || 'general');
  const definition = MODE_DEFINITIONS[normalizedMode] || MODE_DEFINITIONS.general;
  const rolePart = role ? `Role: ${role}.` : 'Role: not specified.';
  const companyPart = company ? `Company: ${company}.` : 'Company: not specified.';
  const relevantBackground = background || description || '';
  const relevantJobDescription = jobDescription || '';
  const backgroundPart = relevantBackground ? `Candidate background: ${relevantBackground}.` : '';
  const jobDescriptionPart = relevantJobDescription ? `Job description: ${relevantJobDescription}.` : '';

  const base = [
    'You are an interview copilot for software engineering and professional interviews.',
    `Current interview mode: ${definition.title}.`,
    `Interview type: ${interviewType || 'general'}.`,
    rolePart,
    companyPart,
    backgroundPart,
    jobDescriptionPart,
    'Answer in text only. Do not generate audio playback or spoken output.',
    'Focus on clarity, practicality, and interview-readiness.',
    ...definition.guidance,
  ].filter(Boolean).join(' ');

  if (normalizedMode === 'coding-interview') {
    return `${base} For coding problems: clarify requirements, explain the approach, show the implementation, reason about time complexity and space complexity, and discuss edge cases and testing strategy.`;
  }

  if (normalizedMode === 'behavioral') {
    return `${base} For behavioral questions: use the STAR format when helpful, be concrete, and never fabricate personal achievements, metrics, or responsibilities.`;
  }

  if (normalizedMode === 'system-design') {
    return `${base} For system design: state requirements and assumptions, propose a clear architecture, analyze trade-offs, and cover reliability, scalability, and failure handling.`;
  }

  if (normalizedMode === 'project-discussion') {
    return `${base} For project discussions: explain the problem being solved, your role, trade-offs, and lessons learned without inventing outcomes or metrics.`;
  }

  return `${base} Keep the response concise, clear, and suitable for a live interview.`;
}

function buildInterviewUserMessage({ prompt, session = {} }) {
  const sessionName = session.name || 'Interview session';
  const sessionRole = session.role || 'Not specified';
  const sessionCompany = session.company || 'Not specified';
  const sessionMode = normalizeInterviewMode(session.mode || session.interviewType || 'general');
  const sessionBackground = session.background || session.description || 'Not specified';
  const sessionJobDescription = session.jobDescription || 'Not specified';

  const context = [
    `Session: ${sessionName}`,
    `Role: ${sessionRole}`,
    `Company: ${sessionCompany}`,
    `Mode: ${sessionMode}`,
    `Background: ${sessionBackground}`,
    `Job description: ${sessionJobDescription}`,
  ].join(' | ');

  return `${context}\n\nUser request: ${prompt}`;
}

module.exports = {
  MODE_DEFINITIONS,
  buildInterviewSystemPrompt,
  buildInterviewUserMessage,
  normalizeInterviewMode,
};
