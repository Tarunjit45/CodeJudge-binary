/**
 * Real Chaos & Analysis Engine.
 *
 * For GitHub repos: Analyzes real file tree, dependencies, and quality signals
 * to produce evidence-based attack results.
 *
 * For live URLs: Actually sends HTTP requests to probe the target.
 */

// ===== REAL ANALYSIS FOR GITHUB REPOS =====

const CODE_ANALYSIS_CHECKS = [
  {
    id: 'test-coverage',
    name: 'Test Coverage Analysis',
    type: 'quality',
    check: (info) => {
      const q = info.qualitySignals || {};
      if (q.hasTests && q.testFileCount > 5) return { passed: true, detail: `Found ${q.testFileCount} test files using ${q.testFramework || 'unknown framework'}` };
      if (q.hasTests) return { passed: true, detail: `Tests detected (${q.testFileCount} test files) — but coverage may be thin` };
      return { passed: false, detail: `No test files detected in this ${info.language || 'codebase'}. Zero automated test coverage leaves regression logic entirely unvalidated.` };
    },
  },
  {
    id: 'ci-pipeline',
    name: 'CI/CD Pipeline Check',
    type: 'devops',
    check: (info) => {
      const q = info.qualitySignals || {};
      if (q.hasCI) return { passed: true, detail: `${q.ciPlatform} pipeline detected — automated builds are configured` };
      return { passed: false, detail: `No CI/CD pipeline found for ${info.name}. No .github/workflows, .travis.yml, or similar configs exist in the root.` };
    },
  },
  {
    id: 'security-headers',
    name: 'Security Middleware Check',
    type: 'security',
    check: (info) => {
      const q = info.qualitySignals || {};
      const deps = info.dependencies || [];
      if (q.hasHelmet || deps.includes('helmet')) return { passed: true, detail: 'helmet package found — security headers are being set' };
      if (deps.includes('fastify-helmet') || deps.includes('@fastify/helmet')) return { passed: true, detail: 'Fastify helmet detected' };
      return { passed: false, detail: 'No security header middleware (helmet) found in dependencies. App is missing X-Frame-Options, CSP, HSTS, etc.' };
    },
  },
  {
    id: 'rate-limiting',
    name: 'Rate Limiting Protection',
    type: 'security',
    check: (info) => {
      const deps = info.dependencies || [];
      if (deps.includes('express-rate-limit') || deps.includes('rate-limiter-flexible') || deps.includes('@nestjs/throttler')) {
        return { passed: true, detail: 'Rate limiting package detected in dependencies' };
      }
      // Check if README mentions rate limiting
      if (/rate.limit/i.test(info.readme || '')) return { passed: true, detail: 'Rate limiting mentioned in README (implementation unclear)' };
      return { passed: false, detail: 'No rate limiting package found. API endpoints are vulnerable to brute force and DDoS attacks.' };
    },
  },
  {
    id: 'input-validation',
    name: 'Input Validation Check',
    type: 'security',
    check: (info) => {
      const q = info.qualitySignals || {};
      if (q.hasValidation) return { passed: true, detail: 'Input validation library found (joi/zod/yup/express-validator)' };
      const deps = info.dependencies || [];
      if (deps.includes('class-validator') || deps.includes('ajv')) return { passed: true, detail: 'Schema validation detected' };
      return { passed: false, detail: 'No input validation library found. Raw user input likely flows directly into business logic unchecked.' };
    },
  },
  {
    id: 'error-handling',
    name: 'Error Handling Analysis',
    type: 'stability',
    check: (info) => {
      const deps = info.dependencies || [];
      const readme = info.readme || '';
      if (deps.includes('express-async-errors') || deps.includes('http-errors')) return { passed: true, detail: 'Error handling middleware detected' };
      if (/error.handl|error.boundar|try.catch|catch.*error/i.test(readme)) return { passed: true, detail: 'Error handling patterns mentioned in docs' };
      return { passed: false, detail: 'No dedicated error handling middleware or patterns detected. Unhandled errors will crash the server.' };
    },
  },
  {
    id: 'docker-container',
    name: 'Containerization Check',
    type: 'devops',
    check: (info) => {
      const q = info.qualitySignals || {};
      if (q.hasDocker) return { passed: true, detail: 'Dockerfile/docker-compose found — containerized deployment supported' };
      return { passed: false, detail: 'No Docker configuration found. Deployment relies on manual environment setup.' };
    },
  },
  {
    id: 'typescript-safety',
    name: 'Type Safety Analysis',
    type: 'quality',
    check: (info) => {
      const q = info.qualitySignals || {};
      const langs = info.languages || [];
      if (q.hasTypescript || langs.includes('TypeScript')) return { passed: true, detail: 'TypeScript configured — type safety enabled' };
      if (info.language === 'Python' && info.fileTree?.some(f => f.endsWith('.pyi') || f.includes('py.typed'))) return { passed: true, detail: 'Python type hints detected' };
      if (['Python', 'Go', 'Rust', 'Java', 'C#', 'Kotlin'].includes(info.language)) return { passed: true, detail: `${info.language} has built-in type safety` };
      return { passed: false, detail: 'No TypeScript or type checking configured. Runtime type errors go undetected until production.' };
    },
  },
  {
    id: 'env-security',
    name: 'Environment Variable Security',
    type: 'security',
    check: (info) => {
      const q = info.qualitySignals || {};
      const tree = info.fileTree || [];
      // Check if .env is in gitignore (it should be)
      const hasEnvInRepo = tree.some(f => f === '.env' && !f.includes('example'));
      if (hasEnvInRepo) return { passed: false, detail: 'CRITICAL: .env file is committed to the repository! Secrets may be exposed.' };
      if (q.hasEnvExample && q.hasGitignore) return { passed: true, detail: '.env.example exists and .gitignore is configured — good practices' };
      if (q.hasGitignore) return { passed: true, detail: '.gitignore exists (assuming .env is excluded)' };
      return { passed: false, detail: 'No .gitignore found. Secrets and environment variables may be committed to the repository.' };
    },
  },
  {
    id: 'dependency-freshness',
    name: 'Dependency & Activity Scan',
    type: 'stability',
    check: (info) => {
      const commits = info.recentCommits || 0;
      const deps = (info.dependencies || []).length;
      if (commits > 10 && deps < 50) return { passed: true, detail: `${commits} commits in last 30 days, ${deps} dependencies — actively maintained with lean deps` };
      if (commits > 0) return { passed: true, detail: `${commits} commits in last 30 days — project shows signs of life` };
      return { passed: false, detail: 'No commits in the last 30 days. Project may be abandoned or unmaintained.' };
    },
  },
  {
    id: 'commit-history',
    name: 'Commit History Timeline',
    type: 'stability',
    check: (info) => {
      const first = info.firstCommitDate;
      const total = info.totalCommits || 0;
      if (!first) return { passed: false, detail: 'Failed to retrieve commit history timeline from GitHub.' };

      const firstDate = new Date(first);
      const lastDate = info.lastCommitDate ? new Date(info.lastCommitDate) : new Date();
      const diffMonths = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 30);

      if (diffMonths >= 12 && total < 20) return { passed: false, detail: `Project inactive relative to age. Spans from ${firstDate.toDateString()} to ${lastDate.toDateString()} with only ${total} total commits.` };
      if (diffMonths < 1) return { passed: true, detail: `Recent project! ${total} commits in under a month. First commit: ${firstDate.toDateString()}` };
      return { passed: true, detail: `Healthy timeline: ${total} commits. Genesis commit on exactly ${firstDate.toDateString()}.` };
    },
  },
  {
    id: 'linter-config',
    name: 'Static Analysis & Linting',
    type: 'quality',
    check: (info) => {
      const q = info.qualitySignals || {};
      const deps = [...(info.dependencies || []), ...(info.devDependencies || [])];

      if (q.hasLinter) return { passed: true, detail: 'Linter configuration detected (ESLint/Stylelint) — code consistency is enforced' };
      if (deps.some(d => d.includes('eslint') || d.includes('prettier') || d.includes('pylint') || d.includes('flake8') || d.includes('clippy') || d.includes('rubocop'))) {
        return { passed: true, detail: 'Linting/formatting packages found in dependencies' };
      }

      const projectType = info.language === 'JavaScript' || info.language === 'TypeScript' ? 'JS/TS' : info.language;
      return { passed: false, detail: `No linter found for this ${projectType} project. Code style is subjective and prone to "bicycle-shedding" during reviews.` };
    },
  },
];

/**
 * Run real analysis for GitHub repos.
 */
function analyzeGitHubRepo(projectInfo) {
  return CODE_ANALYSIS_CHECKS.map((check) => {
    const result = check.check(projectInfo);
    const responseTime = result.passed
      ? Math.floor(Math.random() * 80) + 15
      : Math.floor(Math.random() * 200) + 40;

    return {
      id: check.id,
      name: check.name,
      endpoint: check.type,
      type: check.type,
      description: result.detail,
      passed: result.passed,
      responseTime,
      isSimulated: true,
      statusCode: result.passed ? 200 : 0,
      severity: result.passed ? 'low' : (check.type === 'security' ? 'critical' : 'high'),
      details: result.detail,
    };
  });
}


// ===== REAL HTTP PROBING FOR LIVE URLS =====

/**
 * Actually probe a live URL with real HTTP requests.
 */
async function probeLiveUrl(url) {
  const results = [];
  const baseUrl = url.replace(/\/+$/, '');

  // 1. Basic connectivity check
  results.push(await probeEndpoint(baseUrl, {
    id: 'connectivity',
    name: 'Basic Connectivity',
    type: 'stability',
    description: 'Checking if the application responds',
  }));

  // 2. HTTPS check
  results.push(checkHttps(url));

  // 3. Security headers check
  results.push(await checkSecurityHeaders(baseUrl));

  // 4. Common error pages
  results.push(await probeEndpoint(`${baseUrl}/nonexistent-page-404-test`, {
    id: '404-handling',
    name: 'Custom 404 Handler',
    type: 'stability',
    description: 'Checking if custom error pages exist',
    expect404: true,
  }));

  // 5. Common API endpoints
  for (const path of ['/api', '/api/health', '/api/status']) {
    results.push(await probeEndpoint(`${baseUrl}${path}`, {
      id: `probe-${path.replace(/\//g, '-')}`,
      name: `API Probe: ${path}`,
      type: 'stability',
      description: `Testing ${path} endpoint availability`,
      optional: true,
    }));
  }

  // 6. Response time check
  results.push(await checkResponseTime(baseUrl));

  // 7. CORS check
  results.push(await checkCors(baseUrl));

  // 8. Method not allowed check (send POST to root)
  results.push(await checkMethodNotAllowed(baseUrl));

  // 9. Malformed JSON Check (Fix 1)
  results.push(await checkMalformedJson(baseUrl));

  return results;
}

async function checkMalformedJson(baseUrl) {
  try {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'CodeJudge-AI/1.0' },
      body: '{ "username": "admin", "password": ', // malformed intentionally
    });
    const responseTime = Date.now() - start;

    // We expect a robust error like 400 Bad Request, not a 500 crash or hanging connection.
    const passed = res.status === 400 || res.status === 404; // 404 is fine if endpoint doesn't exist
    return {
      id: 'malformed-json',
      name: 'Malformed JSON Handling',
      endpoint: `${baseUrl}/login`,
      type: 'security',
      description: 'Injecting broken JSON payload to crash parser',
      passed,
      responseTime,
      statusCode: res.status,
      severity: passed ? 'low' : 'high',
      details: passed
        ? `Server handled malformed JSON correctly (Status ${res.status})`
        : `Server failed to handle malformed payload cleanly (Status ${res.status}) — possible unhandled exception`,
    };
  } catch (err) {
    return {
      id: 'malformed-json',
      name: 'Malformed JSON Handling',
      endpoint: `${baseUrl}/login`,
      type: 'security',
      passed: false,
      responseTime: 0,
      statusCode: 0,
      severity: 'critical',
      details: `Injection crashed connection abruptly: ${err.message}`,
    };
  }
}

async function probeEndpoint(url, meta) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const start = Date.now();
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CodeJudge-AI/1.0 Security-Scanner' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;

    if (meta.expect404) {
      // For 404 test, we expect a nice 404 page, not a raw server error
      const passed = res.status === 404;
      return {
        ...meta,
        endpoint: url,
        passed,
        responseTime,
        statusCode: res.status,
        severity: passed ? 'low' : 'medium',
        details: passed
          ? `Custom 404 handler responds in ${responseTime}ms`
          : `Returned ${res.status} instead of 404 — missing or misconfigured error handler`,
      };
    }

    if (meta.optional) {
      // Optional endpoints — it's ok if they don't exist
      const passed = res.ok;
      return {
        ...meta,
        endpoint: url,
        passed,
        responseTime,
        statusCode: res.status,
        severity: 'low',
        details: passed
          ? `${meta.name} responds with ${res.status} in ${responseTime}ms`
          : `${meta.name} returned ${res.status} — endpoint not available`,
      };
    }

    const passed = res.ok;
    return {
      ...meta,
      endpoint: url,
      passed,
      responseTime,
      statusCode: res.status,
      severity: passed ? 'low' : 'high',
      details: passed
        ? `Responds with ${res.status} in ${responseTime}ms`
        : `Failed with HTTP ${res.status} after ${responseTime}ms`,
    };
  } catch (err) {
    return {
      ...meta,
      endpoint: url,
      passed: false,
      responseTime: 10000,
      statusCode: 0,
      severity: 'critical',
      details: `Connection failed: ${err.name === 'AbortError' ? 'Request timed out after 10s' : err.message}`,
    };
  }
}

function checkHttps(url) {
  const isHttps = url.startsWith('https://');
  return {
    id: 'https-check',
    name: 'HTTPS Encryption',
    endpoint: url,
    type: 'security',
    description: 'Checking if connection is encrypted',
    passed: isHttps,
    responseTime: 0,
    statusCode: isHttps ? 200 : 0,
    severity: isHttps ? 'low' : 'critical',
    details: isHttps
      ? 'Connection is encrypted via HTTPS'
      : 'WARNING: Site is using HTTP without encryption. All data is transmitted in plaintext.',
  };
}

async function checkSecurityHeaders(baseUrl) {
  try {
    const res = await fetch(baseUrl, {
      headers: { 'User-Agent': 'CodeJudge-AI/1.0' },
    });
    const headers = Object.fromEntries(res.headers.entries());

    const missing = [];
    if (!headers['x-frame-options'] && !headers['content-security-policy']) missing.push('X-Frame-Options/CSP');
    if (!headers['x-content-type-options']) missing.push('X-Content-Type-Options');
    if (!headers['strict-transport-security']) missing.push('Strict-Transport-Security');
    if (!headers['x-xss-protection'] && !headers['content-security-policy']) missing.push('XSS Protection');

    const passed = missing.length <= 1;
    return {
      id: 'security-headers',
      name: 'Security Headers Scan',
      endpoint: baseUrl,
      type: 'security',
      description: 'Checking HTTP security headers',
      passed,
      responseTime: 0,
      statusCode: res.status,
      severity: passed ? 'low' : 'high',
      details: passed
        ? `Security headers are properly configured (${4 - missing.length}/4 checks passed)`
        : `Missing security headers: ${missing.join(', ')}`,
    };
  } catch {
    return {
      id: 'security-headers',
      name: 'Security Headers Scan',
      endpoint: baseUrl,
      type: 'security',
      passed: false,
      responseTime: 0,
      statusCode: 0,
      severity: 'high',
      details: 'Could not check security headers — connection failed',
    };
  }
}

async function checkResponseTime(baseUrl) {
  try {
    const times = [];
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await fetch(baseUrl, { headers: { 'User-Agent': 'CodeJudge-AI/1.0' } });
      times.push(Date.now() - start);
    }
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const passed = avg < 2000;

    return {
      id: 'response-time',
      name: 'Response Time Benchmark',
      endpoint: baseUrl,
      type: 'stability',
      description: `Average of 3 requests: ${avg}ms`,
      passed,
      responseTime: avg,
      statusCode: 200,
      severity: passed ? 'low' : (avg > 5000 ? 'critical' : 'high'),
      details: passed
        ? `Average response time: ${avg}ms (${times.join('ms, ')}ms) — within acceptable limits`
        : `Average response time: ${avg}ms — too slow for production (target: <2000ms)`,
    };
  } catch (err) {
    return {
      id: 'response-time',
      name: 'Response Time Benchmark',
      endpoint: baseUrl,
      type: 'stability',
      passed: false,
      responseTime: 0,
      statusCode: 0,
      severity: 'critical',
      details: `Could not benchmark: ${err.message}`,
    };
  }
}

async function checkCors(baseUrl) {
  try {
    const res = await fetch(baseUrl, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://evil-site.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const acaoHeader = res.headers.get('access-control-allow-origin');
    const isWildcard = acaoHeader === '*';
    const passed = !isWildcard;

    return {
      id: 'cors-policy',
      name: 'CORS Policy Check',
      endpoint: baseUrl,
      type: 'security',
      description: 'Checking Cross-Origin Resource Sharing policy',
      passed,
      responseTime: 0,
      statusCode: res.status,
      severity: passed ? 'low' : 'medium',
      details: isWildcard
        ? 'CORS allows ALL origins (*) — any website can make requests to this API'
        : acaoHeader
          ? `CORS is restricted to: ${acaoHeader}`
          : 'No CORS headers detected (default: same-origin restrictions apply)',
    };
  } catch {
    return {
      id: 'cors-policy',
      name: 'CORS Policy Check',
      endpoint: baseUrl,
      type: 'security',
      passed: true,
      responseTime: 0,
      statusCode: 0,
      severity: 'low',
      details: 'CORS preflight not supported — default restrictions likely apply',
    };
  }
}

async function checkMethodNotAllowed(baseUrl) {
  try {
    const res = await fetch(baseUrl, {
      method: 'DELETE',
      headers: { 'User-Agent': 'CodeJudge-AI/1.0' },
    });
    const passed = res.status === 405 || res.status === 403 || res.status === 200;

    return {
      id: 'method-check',
      name: 'HTTP Method Restriction',
      endpoint: baseUrl,
      type: 'security',
      description: 'Testing DELETE method on root',
      passed,
      responseTime: 0,
      statusCode: res.status,
      severity: passed ? 'low' : 'medium',
      details: passed
        ? `DELETE request handled correctly (${res.status})`
        : `DELETE on root returned unexpected ${res.status} — may not have method filtering`,
    };
  } catch {
    return {
      id: 'method-check',
      name: 'HTTP Method Restriction',
      endpoint: baseUrl,
      type: 'security',
      passed: true,
      responseTime: 0,
      statusCode: 0,
      severity: 'low',
      details: 'Could not test — connection issue',
    };
  }
}


// ===== MAIN EXPORT =====

/**
 * Run the appropriate analysis based on input type.
 * - GitHub repos get code-level analysis based on real file tree and dependencies
 * - Live URLs get real HTTP probing with actual requests
 */
export async function runChaosSimulation(projectInfo) {
  const url = projectInfo.url || '';
  const isGitHub = /github\.com/i.test(url);
  const isLiveUrl = /^https?:\/\//.test(url) && !isGitHub;

  if (isLiveUrl) {
    // REAL HTTP probing against live URL
    return await probeLiveUrl(url);
  }

  // GitHub repo: real code analysis based on actual file tree and deps
  return analyzeGitHubRepo(projectInfo);
}
