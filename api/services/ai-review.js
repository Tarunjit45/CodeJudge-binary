import OpenAI from 'openai';

/**
 * AI Review Engine.
 * Supports: Google Gemini (free), OpenAI GPT-4, or smart mock fallback.
 * Priority: GEMINI_API_KEY > OPENAI_API_KEY > Mock
 */
export async function generateReview(projectInfo, attackResults) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const grokKey = process.env.GROK_API_KEY;

  const prompt = buildPrompt(projectInfo, attackResults);

  // Try OpenRouter first if provided
  if (openRouterKey && openRouterKey.trim() !== '') {
    console.log('🤖 Using OpenRouter for review');
    try {
      const review = await callOpenRouter(openRouterKey, prompt);
      if (grokKey && grokKey.trim() !== '') {
        review.roast = await callGrokRoast(grokKey, projectInfo, attackResults);
      }
      return review;
    } catch (err) {
      console.error('OpenRouter error, trying fallback:', err.message);
    }
  }

  // Try Gemini second
  if (geminiKey && geminiKey.trim() !== '') {
    console.log('🤖 Using Google Gemini for review');
    try {
      const review = await callGemini(geminiKey, prompt);
      if (grokKey && grokKey.trim() !== '') {
        review.roast = await callGrokRoast(grokKey, projectInfo, attackResults);
      }
      return review;
    } catch (err) {
      console.error('Gemini error, trying fallback:', err.message);
    }
  }

  // Then try OpenAI
  if (openaiKey && openaiKey.trim() !== '') {
    console.log('🤖 Using OpenAI for review');
    try {
      const review = await callOpenAI(openaiKey, prompt);
      if (grokKey && grokKey.trim() !== '') {
        review.roast = await callGrokRoast(grokKey, projectInfo, attackResults);
      }
      return review;
    } catch (err) {
      console.error('OpenAI error, falling back to mock:', err.message);
    }
  }

  console.log('⚠ No AI API key set — using smart mock review engine');
  const review = generateMockReview(projectInfo, attackResults);

  // Apply Grok roast if key is available, even for mock results
  if (grokKey && grokKey.trim() !== '') {
    try {
      review.roast = await callGrokRoast(grokKey, projectInfo, attackResults);
    } catch (err) {
      console.error('Grok roast failed:', err.message);
    }
  }

  return review;
}

/**
 * Build the review prompt from REAL analysis data.
 */
function buildPrompt(projectInfo, attackResults) {
  const failedAttacks = attackResults.filter(a => !a.passed);
  const passedAttacks = attackResults.filter(a => a.passed);
  const q = projectInfo.qualitySignals || {};

  return `You are "CodeJudge AI", a brutally honest hackathon judge. You have REAL data from analyzing this project — use it. Be specific, not generic.
  
  CRITICAL RULE: Avoid generic "No linter", "No tests", or "No CI/CD" boilerplate if there are MORE interesting architectural failures (like bad error handling, security gaps, or dependency issues) reported in the ANALYSIS RESULTS. If you must report a missing tool, explain EXACTLY why it matters for this SPECIFIC project (e.g. "Because this is a ${projectInfo.language} fintech app, the lack of ${q.hasLinter ? 'linter' : 'validation'} is catastrophic").

PROJECT:
- Name: ${projectInfo.name}
- Description: ${projectInfo.description}
- Primary Language: ${projectInfo.language}
- All Languages: ${projectInfo.languages?.join(', ') || 'Unknown'}
- Stars: ${projectInfo.stars || 0} | Forks: ${projectInfo.forks || 0}
- License: ${projectInfo.license}
- Total Files: ${projectInfo.totalFiles || 'Unknown'}
- Dependencies: ${(projectInfo.dependencies || []).slice(0, 20).join(', ') || 'none'}
- Dev Dependencies: ${(projectInfo.devDependencies || []).slice(0, 15).join(', ') || 'none'}
- NPM Scripts: ${(projectInfo.scripts || []).join(', ') || 'none'}
- First Commit: ${projectInfo.firstCommitDate || 'Unknown'}
- Last Commit: ${projectInfo.lastCommitDate || 'Unknown'}
- Total Commits: ${projectInfo.totalCommits || 'Unknown'}
- Recent Commits (30d): ${projectInfo.recentCommits || 0}

QUALITY SIGNALS (real code analysis):
- Tests: ${q.hasTests ? `YES (${q.testFramework || 'unknown framework'}, ${q.testFileCount || 0} test files)` : 'NO tests found'}
- CI/CD: ${q.hasCI ? `YES (${q.ciPlatform})` : 'NO CI/CD pipeline'}
- Docker: ${q.hasDocker ? 'YES' : 'NO'}
- TypeScript: ${q.hasTypescript ? 'YES' : 'NO'}
- Linter: ${q.hasLinter ? 'YES' : 'NO'}
- Security middleware (helmet): ${q.hasHelmet ? 'YES' : 'NO'}
- Rate limiting: ${q.hasRateLimit ? 'YES' : 'NO'}
- Input validation: ${q.hasValidation ? 'YES' : 'NO'}
- .env.example: ${q.hasEnvExample ? 'YES' : 'NO'}
- Security policy: ${q.hasSecurityPolicy ? 'YES' : 'NO'}

ANALYSIS RESULTS (${failedAttacks.length}/${attackResults.length} checks FAILED):
${failedAttacks.map(a => `❌ ${a.name}: ${a.details}`).join('\n')}
${passedAttacks.map(a => `✅ ${a.name}: ${a.details}`).join('\n')}

---
INSTRUCTIONS FOR FINDING VULNERABILITIES:
   - NEVER give generic "add a linter" or "write comments" advice.
   - You MUST analyze the REAL SOURCE CODE SNIPPETS provided below.
   - Specifically look for:
     - **Logical Loopholes**: Can a user bypass an auth check? Is there a race condition? Can someone manipulate state?
     - **Security Vulnerabilities**: SQL injection, XSS, insecure storage, or leaked tokens in the code.
     - **Business Logic Flaws**: Flaws in how the core app logic works (e.g., spending more credits than available).
   - For every issue, cite the file name and the specific logical flaw found in the code.
   - If no source code is provided, roast them for having an "opaque" project.

---
REAL SOURCE CODE SNIPPETS (deep analysis):
${projectInfo.sourceCode || '(No source code provided / Unauthorized)'}

METADATA:
- Project Name: ${projectInfo.name}
- Total Commits: ${projectInfo.totalCommits || 0}
- Timeline Integrity: ${projectInfo.authenticity?.verdict || 'Unknown'} (Authenticity Score: ${projectInfo.authenticity?.score || 0}/100)
- AI Detection: ${projectInfo.authenticity?.aiDetection?.confidence || 0}% confidence (${projectInfo.authenticity?.aiDetection?.reason || 'N/A'})
- Detected Stack: Frontend=${q.frontendFramework}, Backend=${q.backendFramework}, DB=${q.hasDatabase ? 'Yes' : 'No'}
- Quality Checks: Tests=${q.hasTests}, CI/CD=${q.hasCI}, Docker=${q.hasDocker}

---
Output MUST be a JSON array of issues:
[
  {
    "id": "loophole-1",
    "type": "logic", 
    "severity": "critical", 
    "title": "Logic Flaw: [Brief title]",
    "description": "Expose the exact loophole here. Be brutal.",
    "evidence": "Found in [file]: [describe code pattern]",
    "fix": "Specific code fix"
  }
]
README (first 3000 chars):
${(projectInfo.readme || '(No README)').substring(0, 3000)}

Respond in this EXACT JSON format (no markdown, no code blocks, just raw JSON):
{
  "roast": "One devastating witty sentence about this SPECIFIC project based on the real findings above",
  "issues": [
    {
       "type": "Logic Loophole",
       "severity": "CRITICAL",
       "title": "Auth Bypass Vulnerability",
       "description": "Full explanation of the loophole found in the logic code.",
       "evidence": "Citing specific file and code pattern from the source snippets"
    }
  ],
  "fixes": [
    {
      "title": "Short title of fix",
       "issue": "What is being fixed",
       "how": "Step-by-step implementation guide",
       "where": "Suggested file path or component name",
       "code": "One-line or short block of code for this fix"
    }
  ],
  "prevention": [
    {
      "feature": "Name of innovative feature",
      "description": "How this feature improves the project",
      "benefit": "Why this makes it stand out in a hackathon",
      "codeSnippet": "Example implementation code"
    }
  ],
  "impact": "2-3 sentences about why the specific failing checks matter in production",
  "topFixBefore": "3-5 lines of EXACT VULNERABLE/MISSING CODE (referencing the actual project name or context)",
  "topFixAfter": "3-5 lines of PRODUCTION-GRADE OPTIMIZED CODE that implements the fix with best practices",
  "customVerdict": "Concise verdict on the judge's custom instruction."
}

RULES:
- Provide exactly 3 detailed fixes and 2 innovative prevention features.
- Reference real data: actual dependencies, actual file counts, actual missing tools
- Don't say "the project" — use the project name "${projectInfo.name}"
- Every issue must cite evidence from the analysis above, including SPECIFIC LINE NUMBERS or VULNERABLE LOGIC from the provided source code snippets.
- Use the provided REAL SOURCE CODE to find critical loopholes: auth bypasses, race conditions, unsanitized inputs, or logical flaws.
- Every fix must name a specific package, tool, or action with implementation context
- In "prevention", suggest at least ONE highly innovative feature that leverages the project's tech stack (e.g. 'Add real-time collaboration using Socket.io' if it's a dashboard)${projectInfo.customConfig
      ? `\n\n🚨 JUDGE'S CUSTOM INSTRUCTION AND CONFIG 🚨\nThe Master Judge explicitly demanded to manually test/analyze this: "${projectInfo.customConfig}". \nYOU ABSOLUTELY MUST write the result of this manual test inside the "customVerdict" JSON field!`
      : ''
    }`;
}

// ===== GEMINI API =====
async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1200,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  // Clean up: remove markdown code fences if present
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

// ===== OPENAI API =====
async function callOpenAI(apiKey, prompt) {
  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 1200,
  });

  const content = response.choices[0].message.content;
  const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

// ===== OPENROUTER API =====
async function callOpenRouter(apiKey, prompt) {
  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey
  });

  const response = await openai.chat.completions.create({
    model: 'google/gemini-flash-latest',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 1200,
  });

  const content = response.choices[0].message.content;
  const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

/**
 * callGrokRoast (using Groq OpenAI-compatible API)
 * Specifically generates a witty, devastating roast.
 */
async function callGrokRoast(apiKey, info, attackResults) {
  const openai = new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: apiKey
  });

  const failed = attackResults.filter(a => !a.passed);
  const prompt = `You are a brutally honest, witty, and devastating hackathon judge named "Grok". 
   Your job is to write ONE short, punchy, and hilarious roast sentence about the project "${info.name}".
   
   CONTEXT:
   - Project Name: ${info.name}
   - Description: ${info.description}
   - Language: ${info.language}
   - Quality: ${failed.length} checks failed out of ${attackResults.length}
   - Major Fails: ${failed.map(a => a.name).join(', ')}
   
   Write a single devastating sentence. Be specific to the context above. No intro, no quotes, just the roast.`;

  console.log('🔥 Using Groq (Grok mode) for the roast');
  const response = await openai.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 1.0,
    max_tokens: 100,
  });

  return response.choices[0].message.content.trim().replace(/^"|"$/g, '');
}

// ===== SMART MOCK FALLBACK =====
function generateMockReview(projectInfo, attackResults) {
  const failedAttacks = attackResults.filter(a => !a.passed);
  const passedAttacks = attackResults.filter(a => a.passed);
  const name = projectInfo.name || 'this project';
  const q = projectInfo.qualitySignals || {};

  // Build contextual roast from real data
  let roast;
  if (failedAttacks.length === 0) {
    roast = `${name} passed every check — either it's genuinely solid or I need harder tests. Don't get cocky though, ${projectInfo.stars || 0} stars doesn't mean production-ready.`;
  } else if (!q.hasTests && !q.hasCI) {
    roast = `${name} has zero tests and no CI pipeline — it's not a project, it's a prayer. ${failedAttacks.length} checks failed because nobody bothered to check anything.`;
  } else if (failedAttacks.some(a => a.type === 'security')) {
    roast = `${name} is a security audit's worst nightmare — ${failedAttacks.filter(a => a.type === 'security').length} security checks failed. Anyone with a browser and 10 minutes could ruin your day.`;
  } else {
    roast = `${name} failed ${failedAttacks.length} out of ${attackResults.length} checks. With ${(projectInfo.dependencies || []).length} dependencies and ${projectInfo.totalFiles || '?'} files, you'd think someone would've noticed.`;
  }

  // Build issues from real analysis
  const issues = failedAttacks.slice(0, 5).map(a => a.details);
  if (issues.length < 5) {
    const projectType = projectInfo.language || 'application';
    if (!q.hasTests) issues.push(`The ${name} codebase is flying blind with zero automated test coverage. Regression bugs in ${projectType} logic will only be found by angry users.`);
    if (!q.hasCI) issues.push(`No CI/CD pipeline detected. Changes to this ${projectType} project are flying manually, risking "works on my machine" syndrome.`);
    if (!q.hasDocker) issues.push(`Architecture lacks containerization. Deployment for ${name} remains a manual, error-prone environment setup chore.`);
    if (!q.hasLinter) issues.push(`Static analysis is absent. Without a linter, ${name}'s ${projectType} source code is likely a goldmine for subtle syntax traps.`);
    if (!q.hasTypescript && projectInfo.language === 'JavaScript') issues.push(`Plain JavaScript detected. Without type safety, ${name} is at the mercy of runtime 'undefined' crashes.`);
  }

  // Build fixes from real missing items
  const fixes = [];
  if (!q.hasTests) fixes.push({
    title: "Implement Core Testing",
    issue: "Zero automated test coverage",
    how: `Add ${projectInfo.language === 'Python' ? 'pytest' : 'vitest'} to the pipeline`,
    where: "tests/core.test.js",
    code: "test('should work', () => { expect(1).toBe(1); });"
  });
  if (!q.hasRateLimit) fixes.push({
    title: "Add DoS Protection",
    issue: "API is vulnerable to brute-force and DoS",
    how: "Apply express-rate-limit middleware",
    where: "api/index.js",
    code: "app.use(rateLimit({ windowMs: 15*60*1000, max: 100 }));"
  });
  if (!q.hasHelmet) fixes.push({
    title: "Secure HTTP Headers",
    issue: "Missing 11 standard security headers",
    how: "Install and mount the Helmet middleware",
    where: "api/index.js",
    code: "const helmet = require('helmet'); app.use(helmet());"
  });

  const prevention = [
    {
      feature: "Real-time Observability",
      description: "Live dashboard tracking system health and errors using OpenTelemetry",
      benefit: "Reduces Mean Time to Recovery (MTTR) by 80%",
      codeSnippet: "const sdk = new NodeSDK({ traceExporter: new ConsoleSpanExporter() });"
    },
    {
      feature: "Redis Distributed Caching",
      description: "Implement a look-aside cache for heavy database queries",
      benefit: "Reduces database load by 90% during traffic spikes",
      codeSnippet: "await redis.set(key, JSON.stringify(data), 'EX', 3600);"
    }
  ];

  const impact = failedAttacks.length > 5
    ? `With ${failedAttacks.length} failed checks, ${name} has systematic gaps across ${[...new Set(failedAttacks.map(a => a.type))].join(', ')}. In production, these compound — one missing rate limit + one missing input validation = a very bad day.`
    : `${name} has ${failedAttacks.length} weak points, primarily in ${[...new Set(failedAttacks.map(a => a.type))].join(' and ')}. These are fixable, but left unaddressed, even moderate traffic or a basic security scan would expose them.`;

  // Mock Before/After for the first fix
  let topFixBefore = `// Current State\napp.use('/', router);\n// No middleware configured`;
  let topFixAfter = `// Secured State\nconst helmet = require('helmet');\n\napp.use(helmet());\napp.use('/', router);`;

  if (!q.hasTests) {
    topFixBefore = `// In ${projectInfo.name}/api/index.js\napp.post('/register', (req, res) => {\n  db.users.save(req.body);\n  res.send('Done');\n});`;
    topFixAfter = `// Fully tested and validated version\nimport { z } from 'zod';\nconst UserSchema = z.object({ email: z.string().email() });\n\napp.post('/register', validate(UserSchema), (req, res) => {\n  db.users.save(req.body);\n  res.status(201).json({ success: true });\n});`;
  }

  return {
    roast,
    issues: issues.slice(0, 5),
    fixes: fixes.slice(0, 5),
    prevention: prevention.slice(0, 3),
    impact,
    topFixBefore,
    topFixAfter,
    customVerdict: projectInfo.customConfig ? `MOCK RESPONSE TO MANUAL TEST: You requested testing for "${projectInfo.customConfig}". Mock analysis shows this component is fragile and requires extensive refactoring to pass standard safety benchmarks.` : ''
  };
}
