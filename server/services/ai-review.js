import OpenAI from 'openai';

/**
 * AI Review Engine.
 * Supports: Google Gemini (free), OpenAI GPT-4, or smart mock fallback.
 * Priority: GEMINI_API_KEY > OPENAI_API_KEY > Mock
 */
export async function generateReview(projectInfo, attackResults) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const prompt = buildPrompt(projectInfo, attackResults);

  // Try Gemini first (free tier available)
  if (geminiKey && geminiKey.trim() !== '') {
    console.log('🤖 Using Google Gemini for review');
    try {
      return await callGemini(geminiKey, prompt);
    } catch (err) {
      console.error('Gemini error, trying fallback:', err.message);
    }
  }

  // Then try OpenAI
  if (openaiKey && openaiKey.trim() !== '') {
    console.log('🤖 Using OpenAI for review');
    try {
      return await callOpenAI(openaiKey, prompt);
    } catch (err) {
      console.error('OpenAI error, falling back to mock:', err.message);
    }
  }

  console.log('⚠ No AI API key set — using smart mock review engine');
  return generateMockReview(projectInfo, attackResults);
}

/**
 * Build the review prompt from REAL analysis data.
 */
function buildPrompt(projectInfo, attackResults) {
  const failedAttacks = attackResults.filter(a => !a.passed);
  const passedAttacks = attackResults.filter(a => a.passed);
  const q = projectInfo.qualitySignals || {};

  return `You are "CodeJudge AI", a brutally honest hackathon judge. You have REAL data from analyzing this project — use it. Be specific, not generic.

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

README (first 3000 chars):
${(projectInfo.readme || '(No README)').substring(0, 3000)}

Respond in this EXACT JSON format (no markdown, no code blocks, just raw JSON):
{
  "roast": "One devastating witty sentence about this SPECIFIC project based on the real findings above",
  "issues": ["Specific issue 1 with evidence", "Specific issue 2 with evidence", "Specific issue 3", "Specific issue 4", "Specific issue 5"],
  "fixes": ["Specific fix 1 with exact package/tool names", "Specific fix 2", "Specific fix 3", "Specific fix 4", "Specific fix 5"],
  "prevention": ["System-level improvement 1", "System-level improvement 2", "System-level improvement 3"],
  "impact": "2-3 sentences about why the specific failing checks matter in production"
}

RULES:
- Reference real data: actual dependencies, actual file counts, actual missing tools
- Don't say "the project" — use the project name "${projectInfo.name}"
- Every issue must cite evidence from the analysis above
- Every fix must name a specific package, tool, or action`;
}

// ===== GEMINI API =====
async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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
    if (!q.hasTests) issues.push('No test files found in the repository — zero automated test coverage');
    if (!q.hasCI) issues.push('No CI/CD pipeline configured — code changes go unvalidated');
    if (!q.hasDocker) issues.push('No containerization — deployment requires manual environment setup');
    if (!q.hasLinter) issues.push('No linter configured — code style and quality are unchecked');
    if (!q.hasTypescript && projectInfo.language === 'JavaScript') issues.push('No TypeScript — silent type errors will hit production');
  }

  // Build fixes from real missing items
  const fixes = [];
  if (!q.hasTests) fixes.push(`Add ${projectInfo.language === 'Python' ? 'pytest' : 'vitest or jest'} with at least one test per module — start with the critical paths`);
  if (!q.hasCI) fixes.push('Create .github/workflows/ci.yml with lint, test, and build steps — takes 5 minutes via GitHub Actions starter templates');
  if (!q.hasHelmet && (projectInfo.dependencies || []).includes('express')) fixes.push('Install helmet (npm i helmet) and add app.use(helmet()) — one line for 11 security headers');
  if (!q.hasRateLimit) fixes.push('Add express-rate-limit: const limiter = rateLimit({ windowMs: 15*60*1000, max: 100 }); app.use(limiter)');
  if (!q.hasValidation) fixes.push('Install zod (npm i zod) and validate all request bodies — z.object({...}).parse(req.body) catches bad input at the edge');
  if (fixes.length < 5) {
    fixes.push('Add structured error handling with http-errors: throw createError(404, "Not Found") instead of raw Error()');
    fixes.push('Set up pre-commit hooks with husky + lint-staged to catch issues before they reach the repository');
  }

  const prevention = [
    q.hasCI ? 'Enhance CI pipeline with security scanning (Snyk/CodeQL) and performance benchmarks' : 'Set up CI/CD with GitHub Actions — automate linting, testing, and deployment',
    'Implement structured logging (pino for Node.js, structlog for Python) with request correlation IDs',
    'Add pre-merge checks: require passing tests + code review + no security alerts before any merge',
  ];

  const impact = failedAttacks.length > 5
    ? `With ${failedAttacks.length} failed checks, ${name} has systematic gaps across ${[...new Set(failedAttacks.map(a => a.type))].join(', ')}. In production, these compound — one missing rate limit + one missing input validation = a very bad day.`
    : `${name} has ${failedAttacks.length} weak points, primarily in ${[...new Set(failedAttacks.map(a => a.type))].join(' and ')}. These are fixable, but left unaddressed, even moderate traffic or a basic security scan would expose them.`;

  return {
    roast,
    issues: issues.slice(0, 5),
    fixes: fixes.slice(0, 5),
    prevention: prevention.slice(0, 3),
    impact,
  };
}
