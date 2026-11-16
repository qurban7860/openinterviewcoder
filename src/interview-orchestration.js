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

function buildInterviewSuggestions({
  mode = 'general',
  role = '',
  company = '',
  background = '',
  jobDescription = '',
} = {}) {
  const normalizedMode = normalizeInterviewMode(mode || 'general');
  const candidateRole = role ? role.trim() : 'the role';
  const candidateCompany = company ? company.trim() : 'the company';
  const experienceBit = background ? background.trim() : 'your recent experience';
  const requirementsBit = jobDescription ? jobDescription.trim() : 'the key responsibilities';

  const baseSuggestions = [
    `Walk me through how your background in ${experienceBit} connects to ${candidateRole} at ${candidateCompany}.`,
    `What are the most important trade-offs or risks to consider for ${candidateRole} work at ${candidateCompany}?`,
    `How would you prioritize the top responsibilities from ${requirementsBit} in a real project?`,
  ];

  if (normalizedMode === 'coding-interview') {
    return [
      `Clarify the requirements for this coding problem and explain your approach before writing code for ${candidateRole}.`,
      `What edge cases or performance constraints should we discuss for this implementation?`,
      `How would you test this solution and explain the complexity trade-offs?`,
    ];
  }

  if (normalizedMode === 'system-design') {
    return [
      `Design the core architecture for a system that supports ${requirementsBit.toLowerCase()} with clear scalability and reliability trade-offs.`,
      `What are the most important components, APIs, and failure modes in this design?`,
      `How would you observe, test, and evolve this architecture as traffic and requirements grow?`,
    ];
  }

  if (normalizedMode === 'behavioral') {
    return [
      `Tell me about a time when ${experienceBit.toLowerCase()} influenced a decision you made in a team setting.`,
      `Describe a conflict or trade-off you handled well and how you measured success.`,
      `How do you adapt your communication style when working across teams with different priorities?`,
    ];
  }

  if (normalizedMode === 'project-discussion') {
    return [
      `Walk me through a project where ${experienceBit.toLowerCase()} shaped the final design and delivery plan.`,
      `What trade-offs did you make in this project, and what would you do differently now?`,
      `How did you validate success and learn from the risks or bottlenecks in this work?`,
    ];
  }

  return baseSuggestions;
}

function buildInterviewFocusAreas({
  mode = 'general',
  role = '',
  company = '',
  jobDescription = '',
} = {}) {
  const normalizedMode = normalizeInterviewMode(mode || 'general');
  const candidateRole = role ? role.trim() : 'this role';
  const candidateCompany = company ? company.trim() : 'this company';
  const requirements = jobDescription ? jobDescription.trim() : 'the key responsibilities and constraints.';

  const focusByMode = {
    'coding-interview': [
      `${candidateRole} problem-solving: define the requirement and confirm the constraints before coding.`,
      `${candidateCompany} interview lens: explain your approach, complexity, and trade-offs clearly.`,
      `Quality check: talk through edge cases, tests, and how you would improve the solution.`,
    ],
    'system-design': [
      `${candidateRole} architecture focus: map the core requirements and scope before proposing components.`,
      `${candidateCompany} reliability lens: discuss scalability, failure modes, and observability trade-offs.`,
      `System fit: explain API contracts, data flow, caching, and how the design evolves over time.`,
    ],
    behavioral: [
      `${candidateRole} story framing: use STAR structure and ground every example in real outcomes.`,
      `${candidateCompany} team alignment: explain how you work with stakeholders, mentors, and cross-functional peers.`,
      `Leadership focus: show how you make decisions, learn fast, and improve processes.`,
    ],
    'project-discussion': [
      `${candidateRole} project narrative: connect the problem, your decisions, and the actual trade-offs.`,
      `${candidateCompany} impact lens: quantify outcomes carefully and be honest about constraints.`,
      `Reflection focus: explain what went well, what changed, and what you would improve next.`,
    ],
    general: [
      `${candidateRole} at ${candidateCompany}: connect your background to the core requirements of the opportunity.`,
      `Key requirements: ${requirements}.`,
      `Conversation strategy: answer directly, give examples, and keep the structure crisp.`,
    ],
  };

  return focusByMode[normalizedMode] || focusByMode.general;
}

function buildInterviewReadinessSummary({
  mode = 'general',
  role = '',
  company = '',
  background = '',
  jobDescription = '',
} = {}) {
  const normalizedMode = normalizeInterviewMode(mode || 'general');
  const definition = MODE_DEFINITIONS[normalizedMode] || MODE_DEFINITIONS.general;
  const roleText = role ? role.trim() : 'role not specified';
  const companyText = company ? company.trim() : 'company not specified';
  const backgroundText = background ? background.trim() : 'your background';
  const jobText = jobDescription ? jobDescription.trim() : 'the role requirements';

  return [
    `${definition.title} mode is active for ${roleText} at ${companyText}.`,
    `Current focus: ${backgroundText.slice(0, 120)}${backgroundText.length > 120 ? '…' : ''}`,
    `Key requirement signal: ${jobText.slice(0, 140)}${jobText.length > 140 ? '…' : ''}`,
  ].join(' ');
}

function buildInterviewChecklist({
  mode = 'general',
  role = '',
  company = '',
} = {}) {
  const normalizedMode = normalizeInterviewMode(mode || 'general');
  const roleText = role ? role.trim() : 'this role';
  const companyText = company ? company.trim() : 'this company';

  const checklistByMode = {
    'coding-interview': [
      `${roleText} at ${companyText}: clarify the requirements and confirm the constraints before coding.`,
      'Explain your approach, trade-offs, and the key data structures or algorithms you would choose.',
      'Walk through complexity, edge cases, and how you would test the solution under real constraints.',
    ],
    'system-design': [
      `${roleText} at ${companyText}: define the problem, assumptions, and success metrics before proposing an architecture.`,
      'Map the main components, APIs, data flow, and failure modes in a clear system view.',
      'Discuss scalability, reliability, observability, and how the design would evolve over time.',
    ],
    behavioral: [
      `${roleText} at ${companyText}: anchor each answer in a real example and keep the structure crisp and credible.`,
      'Show ownership, decision-making, learning, and collaboration with specific examples and metrics.',
      'Discuss trade-offs, conflicts, and how you adapted to drive better outcomes for the team.',
    ],
    'project-discussion': [
      `${roleText} at ${companyText}: frame the problem, your contribution, and the technical trade-offs accurately.`,
      'Explain what the system was built to solve, the key constraints, and the metrics or outcomes you observed.',
      'Be honest about risks, assumptions, and the lessons you would apply in a future version.',
    ],
    general: [
      `${roleText} at ${companyText}: answer directly, tie your examples to the role, and stay concrete.`,
      'Use the opportunity to clarify the problem, provide a concise structure, and keep the conversation moving.',
      'Finish with the key decision, trade-off, or learning that makes your answer memorable.',
    ],
  };

  return checklistByMode[normalizedMode] || checklistByMode.general;
}

module.exports = {
  MODE_DEFINITIONS,
  buildInterviewChecklist,
  buildInterviewFocusAreas,
  buildInterviewReadinessSummary,
  buildInterviewSuggestions,
  buildInterviewSystemPrompt,
  buildInterviewUserMessage,
  normalizeInterviewMode,
};
