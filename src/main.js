/**
 * CodeJudge AI — Main Application
 * Dual-mode (Builder / Judge) pipeline with gamification.
 * Guided storytelling UI: user sees only the current step + next action.
 */

// ===== Resilience Level System =====
const LEVELS = [
  { min: 0, max: 39, name: 'Fragile', emoji: '💀', color: '#ff4444' },
  { min: 40, max: 59, name: 'Unstable', emoji: '⚠️', color: '#ffaa00' },
  { min: 60, max: 74, name: 'Surviving', emoji: '🧠', color: '#3b82f6' },
  { min: 75, max: 89, name: 'Resilient', emoji: '⚡', color: '#a855f7' },
  { min: 90, max: 100, name: 'Production Ready', emoji: '🚀', color: '#39e75f' },
];

function getLevel(score) {
  return LEVELS.find(l => score >= l.min && score <= l.max) || LEVELS[0];
}

// ===== State =====
const state = {
  currentStep: parseInt(localStorage.getItem('codejudge-step') || '0'),
  mode: localStorage.getItem('codejudge-mode') || 'participant', // 'participant' | 'judge'
  projectInfo: JSON.parse(localStorage.getItem('codejudge-project') || 'null'),
  attackResults: JSON.parse(localStorage.getItem('codejudge-attacks') || '[]'),
  review: JSON.parse(localStorage.getItem('codejudge-review') || 'null'),
  score: JSON.parse(localStorage.getItem('codejudge-score') || 'null'),
  leaderboardEntry: null,
  leaderboard: [],
  streak: parseInt(localStorage.getItem('codejudge-streak') || '0'),
  lastScore: parseInt(localStorage.getItem('codejudge-last-score') || '0'),
  hardModeSurvived: false,
  githubToken: localStorage.getItem('codejudge-github-token') || null,
};

function saveState() {
  localStorage.setItem('codejudge-step', state.currentStep);
  localStorage.setItem('codejudge-mode', state.mode);
  localStorage.setItem('codejudge-project', JSON.stringify(state.projectInfo));
  localStorage.setItem('codejudge-attacks', JSON.stringify(state.attackResults));
  localStorage.setItem('codejudge-review', JSON.stringify(state.review));
  localStorage.setItem('codejudge-score', JSON.stringify(state.score));
}

// Listen for GitHub Token from Popup
window.addEventListener('message', (event) => {
  if (event.data.type === 'github-token') {
    state.githubToken = event.data.token;
    localStorage.setItem('codejudge-github-token', event.data.token);
    updateAuthUI();
  }
});

const SCREEN_IDS = [
  'screen-landing', 'screen-processing', 'screen-xray', 'screen-attack',
  'screen-failures', 'screen-fix',
  'screen-score', 'screen-leaderboard',
];

// ===== DOM Refs =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== Theme Toggle =====
function initTheme() {
  const toggle = $('#theme-toggle');
  const icon = toggle.querySelector('.theme-icon');
  const savedTheme = localStorage.getItem('codejudge-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  icon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('codejudge-theme', next);
    icon.textContent = next === 'dark' ? '🌙' : '☀️';
  });
}

// ===== Mode Toggle =====
function initModeToggle() {
  const btns = $$('.mode-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
      updateModeUI();
    });
  });
  updateModeUI();
}

function updateModeUI() {
  const tagline = $('#landing-tagline');
  const description = $('#landing-description');
  const btnText = $('#judge-btn-text');

  if (state.mode === 'participant') {
    tagline.textContent = "Let's see if your project survives reality.";
    description.textContent = 'Submit → See failures → Get fixes → Re-test → Improve score';
    btnText.textContent = 'Judge My Project';
    document.body.classList.remove('judge-mode');
    document.body.classList.add('builder-mode');
  } else {
    tagline.textContent = 'Evaluate projects quickly and fairly.';
    description.textContent = 'Paste project → See summary → See weaknesses → Get structured verdict → Compare scores';
    btnText.textContent = 'Evaluate Project';
    document.body.classList.remove('builder-mode');
    document.body.classList.add('judge-mode');
  }
}

function initAuth() {
  const loginBtn = $('#github-login-btn');
  const logoutBtn = $('#github-logout-btn');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const width = 600, height = 700;
      const left = (window.innerWidth / 2) - (width / 2);
      const top = (window.innerHeight / 2) - (height / 2);
      window.open('/api/auth/github', 'GitHub Login', `width=${width},height=${height},left=${left},top=${top}`);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      state.githubToken = null;
      localStorage.removeItem('codejudge-github-token');
      updateAuthUI();
    });
  }

  updateAuthUI();
}

function updateAuthUI() {
  const loginBtn = $('#github-login-btn');
  const logoutBtn = $('#github-logout-btn');
  const status = $('#github-status');

  if (state.githubToken) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'flex';
    if (status) {
      status.textContent = 'Token Connected (Deep Scan Enabled)';
      status.style.color = 'var(--success)';
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (status) {
      status.textContent = 'Limited Scan (Public only)';
      status.style.color = 'var(--text-dim)';
    }
  }
}
// ===== Pipeline Progress Bar =====
function updatePipelineBar(step) {
  $$('.pipeline-step').forEach((el, i) => {
    el.classList.remove('active', 'completed');
    if (i < step) el.classList.add('completed');
    if (i === step) el.classList.add('active');
  });

  $$('.pipeline-connector').forEach((el, i) => {
    if (i < step) {
      el.style.background = 'var(--accent-dim)';
    } else {
      el.style.background = 'var(--connector-color)';
    }
  });
}

// ===== Screen Transitions =====
function showScreen(index) {
  const screens = $$('.screen');
  screens.forEach((s, i) => {
    if (i === index) {
      s.classList.add('active');
      s.style.animation = 'none';
      s.offsetHeight;
      s.style.animation = 'screenIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    } else {
      s.classList.remove('active');
    }
  });
  state.currentStep = index;
  updatePipelineBar(index);

  // Hide mode toggle after landing
  const modeContainer = $('#mode-toggle-container');
  if (index > 0) {
    modeContainer.style.opacity = '0';
    modeContainer.style.pointerEvents = 'none';
  } else {
    modeContainer.style.opacity = '1';
    modeContainer.style.pointerEvents = 'auto';
  }
}

// ===== Step 0: Submit =====
function initLanding() {
  const input = $('#url-input');
  const customConfigInput = $('#custom-config-input');
  const btn = $('#judge-btn');
  const error = $('#input-error');

  fetchLeaderboardCount();

  const handleSubmit = async () => {
    const url = input.value.trim();
    const customConfig = customConfigInput?.value?.trim() || '';
    error.textContent = '';

    if (!url) {
      error.textContent = 'Please enter a URL';
      return;
    }

    if (!url.match(/^https?:\/\/.+/)) {
      error.textContent = 'Please enter a valid URL starting with http:// or https://';
      return;
    }

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Submitting…';

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          customConfig,
          githubToken: state.githubToken
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      state.projectInfo = data;
      saveState();
      renderXRay();
      goToStep(2); // → X-Ray Screen
    } catch (err) {
      error.textContent = err.message;
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = state.mode === 'judge' ? 'Evaluate Project' : 'Judge My Project';
    }
  };

  btn.addEventListener('click', handleSubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });

  const viewLbBtn = $('#view-leaderboard-btn');
  if (viewLbBtn) {
    viewLbBtn.addEventListener('click', async () => {
      goToStep(7);
      const res = await fetch('/api/leaderboard');
      state.leaderboard = await res.json();
      renderLeaderboard();
    });
  }

  const startChaosBtn = $('#start-chaos-btn');
  if (startChaosBtn) {
    startChaosBtn.addEventListener('click', () => {
      goToStep(1); // → Show processing logs
      runProcessing();
    });
  }
}

// ===== X-Ray Analysis Rendering =====
function renderXRay() {
  const info = state.projectInfo;
  const sig = info.qualitySignals || {};

  // 1. Architecture
  const arch = $('#xray-arch');
  arch.innerHTML = `
    <div class="xray-feature-item"><div class="xray-dot"></div> Frontend: ${sig.frontendFramework || (sig.isSPA ? 'Modern SPA' : 'Static/Vanilla')}</div>
    <div class="xray-feature-item"><div class="xray-dot"></div> Styling: ${sig.stylingType || (sig.isTailwind ? 'Tailwind CSS' : 'Standard CSS')}</div>
    <div class="xray-feature-item"><div class="xray-dot"></div> Backend: ${sig.backendFramework || (info.language === 'JavaScript' ? 'Node.js + Express' : info.language)}</div>
    <div class="xray-feature-item"><div class="xray-dot"></div> Total Files: ${info.totalFiles || 'Unknown'}</div>
  `;

  // 2. Features
  const features = $('#xray-features');
  features.innerHTML = '';
  const featureList = [
    { cond: sig.hasAuth, label: 'Authentication System' },
    { cond: sig.hasDatabase, label: 'Database Operations' },
    { cond: sig.hasRoutes, label: 'API-based Routing' },
    { cond: sig.hasTests, label: 'Testing Suite' },
    { cond: sig.hasCI, label: 'CI/CD Pipeline' },
    { cond: sig.hasDocker, label: 'Containerized (Docker)' }
  ].filter(f => f.cond);

  if (featureList.length === 0) featureList.push({ cond: true, label: 'Standard Codebase' });

  featureList.forEach(f => {
    const div = document.createElement('div');
    div.className = 'xray-feature-item';
    div.innerHTML = `<div class="xray-dot"></div> ${f.label}`;
    features.appendChild(div);
  });

  // 3. Risk Mapping
  const risks = $('#xray-risks');
  risks.innerHTML = '';
  const riskList = [];
  const projectType = info.language || 'application';

  if (!sig.hasTests) riskList.push(`Zero ${projectType} test units detected (Flying blind)`);
  if (!sig.hasCI) riskList.push(`Manual deployment risk: No ${sig.ciPlatform || 'CI/CD'} pipeline`);
  if (!sig.hasLinter) riskList.push(`${projectType} static analysis missing (Linter absent)`);
  if (!sig.hasEnvExample) riskList.push('Missing environment variable templates (.env.example)');
  if (!sig.hasTypescript && info.language === 'JavaScript') riskList.push('Untyped JavaScript logic (High runtime risk)');

  if (riskList.length === 0) riskList.push(`Low structural risk for ${info.name}`);

  riskList.forEach(r => {
    const div = document.createElement('div');
    div.className = 'xray-feature-item risk-item';
    div.innerHTML = `<div class="xray-dot"></div> ${r}`;
    risks.appendChild(div);
  });

  // 4. Timeline Truth
  const timeline = $('#xray-timeline');
  timeline.innerHTML = '';
  if (info.authenticity) {
    const auth = info.authenticity;
    const scoreClass = auth.score > 80 ? 'success' : auth.score > 50 ? 'warning' : 'danger';

    timeline.innerHTML = `
      <div class="auth-score-mini ${scoreClass}">
        Score: ${auth.score}/100 
        <small>(${auth.verdict})</small>
      </div>
      <div class="xray-feature-item"><div class="xray-dot"></div> Created: ${new Date(info.createdAt).toLocaleDateString()}</div>
      <div class="xray-feature-item"><div class="xray-dot"></div> First Commit: ${info.firstCommitDate ? new Date(info.firstCommitDate).toLocaleDateString() : 'N/A'}</div>
      <div class="xray-feature-item"><div class="xray-dot"></div> Commits in hackathon: ${auth.stats.hackathonCommitCount}</div>
      ${auth.flags.map(f => `
        <div class="xray-feature-item flag-item ${f.severity}">
          <div class="xray-dot"></div> <strong>${f.type}:</strong> ${f.message}
          <div class="flag-details">${f.details}</div>
        </div>
      `).join('')}
    `;
  } else {
    timeline.innerHTML = '<div class="xray-feature-item">Waiting for deep timeline probe…</div>';
  }
}

async function fetchLeaderboardCount() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    $('#stat-judged').textContent = data.length;
  } catch {
    // ignore
  }
}

// ===== Step 1: Analyze (Processing) =====
function runProcessing() {
  const container = $('#log-container');
  const projectName = $('#processing-project-name');
  container.innerHTML = '';
  projectName.textContent = state.projectInfo.fullName || state.projectInfo.name;

  const q = state.projectInfo.qualitySignals || {};
  const isLive = !/github\.com/i.test(state.projectInfo.url || '');

  const logs = isLive ? [
    `Connecting to ${state.projectInfo.name}…`,
    `Target: ${state.projectInfo.url}`,
    'Testing HTTPS encryption…',
    'Scanning security headers (CSP, HSTS, X-Frame-Options)…',
    'Probing common API endpoints…',
    'Benchmarking response time (3 requests)…',
    'Checking CORS policy…',
    'Testing HTTP method restrictions…',
    'Checking 404 error handler…',
    'Compiling real probe results…',
    'All probes complete. Launching attacks…',
  ] : [
    `Connecting to GitHub API…`,
    `Repo: ${state.projectInfo.fullName || state.projectInfo.name}`,
    `Main language: ${state.projectInfo.language} (${Object.keys(state.projectInfo.languageBytes || {}).join(', ')})`,
    `Social signals: ${state.projectInfo.stars} ⭐ | ${state.projectInfo.forks} 🍴`,
    `Scanning tree… ${state.projectInfo.totalFiles || '?'} files discovered`,
    `Reading package definitions… ${(state.projectInfo.dependencies || []).length} deps, ${(state.projectInfo.devDependencies || []).length} dev deps`,
    `Tests: ${q.hasTests ? `✅ Found (${q.testFramework || 'detected'})` : `❌ No ${state.projectInfo.language} tests found`}`,
    `CI/CD: ${q.hasCI ? `✅ ${q.ciPlatform}` : `❌ No ${state.projectInfo.name || 'project'} pipeline`}`,
    `Security Middleware: helmet=${q.hasHelmet ? '✅' : '❌'} | rate-limit=${q.hasRateLimit ? '✅' : '❌'} | validation=${q.hasValidation ? '✅' : '❌'}`,
    `Docker: ${q.hasDocker ? '✅' : '❌'} | TypeScript: ${q.hasTypescript ? '✅' : '❌'} | Linter: ${q.hasLinter ? '✅' : '❌'}`,
    `Project Genesis: ${state.projectInfo.firstCommitDate ? new Date(state.projectInfo.firstCommitDate).toDateString() : 'Unknown'}`,
    `Recent activity: ${state.projectInfo.recentCommits || 0} commits in last 30 days`,
    'Analysis complete. Launching attacks…',
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i < logs.length) {
      const line = document.createElement('div');
      line.className = 'log-line';
      const time = new Date().toLocaleTimeString();
      line.innerHTML = `<span class="log-time">[${time}]</span><span class="log-prefix">▶</span>${logs[i]}`;
      container.appendChild(line);
      container.scrollTop = container.scrollHeight;
      i++;
    } else {
      clearInterval(interval);
      setTimeout(() => {
        goToStep(3); // → Attack
        runChaosSimulation();
      }, 800);
    }
  }, 500);
}

// ===== Step 3: Attack =====
function runChaosSimulation() {
  const grid = $('#attack-grid');
  const summary = $('#attack-summary');
  grid.innerHTML = '';
  summary.style.display = 'none';

  fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectInfo: state.projectInfo }),
  }).then(async (response) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = JSON.parse(line.replace('data: ', ''));

        if (data.type === 'attack') {
          renderAttackCard(data.result, grid);
        } else if (data.type === 'complete') {
          state.attackResults = data.results;
          saveState();
          showAttackSummary(summary);
          setTimeout(() => goToStep(4), 2000); // → Breakpoint
        }
      }
    }
  });
}

function renderAttackCard(result, container) {
  const card = document.createElement('div');
  card.className = `attack-card ${result.passed ? 'passed' : 'failed'}`;
  card.style.animationDelay = `${container.children.length * 0.1}s`;

  card.innerHTML = `
    <span class="attack-status">${result.passed ? '✅' : '❌'}</span>
    <div class="attack-info">
      <div class="attack-name">${result.name}</div>
      <div class="attack-endpoint">${result.endpoint}</div>
      <div class="attack-detail">${result.details}</div>
    </div>
    <span class="attack-timing">${result.isSimulated ? `<span style="opacity:0.5; font-size:0.7em; margin-right:4px;">sim. latency</span>` : ''}${result.responseTime}ms</span>
  `;
  container.appendChild(card);
}

function showAttackSummary(summary) {
  const passed = state.attackResults.filter(a => a.passed).length;
  const failed = state.attackResults.length - passed;
  $('#attacks-passed').textContent = passed;
  $('#attacks-failed').textContent = failed;
  summary.style.display = 'flex';
}

// ===== Step 3: Breakpoint + Failures + Review (consolidated) =====
function showFailures() {
  const list = $('#failures-list');
  const verdict = $('#failures-verdict');
  list.innerHTML = '';

  const failures = state.attackResults.filter(a => !a.passed);
  const breakpointBanner = $('#breakpoint-banner');
  const realityShock = $('#reality-shock');
  const subtitle = $('#failures-subtitle');

  if (state.mode === 'judge') {
    subtitle.textContent = "Here's where this project breaks";
  } else {
    subtitle.textContent = "Here's where your project broke";
  }

  if (failures.length === 0) {
    breakpointBanner.style.display = 'none';
    realityShock.style.display = 'block';
    $('#shock-answer').textContent = '✅ LIKELY YES';
    $('#shock-answer').style.color = 'var(--success)';
    $('#shock-subtext').textContent = '(strong foundation detected)';
    verdict.innerHTML = '🎉 <strong>Impressive!</strong> ' + (state.mode === 'judge' ? 'This project survived all attacks.' : 'Your project survived all attacks. But the review might still be brutal…');
    state.hardModeSurvived = true;
  } else {
    const firstFail = failures[0];
    breakpointBanner.style.display = 'block';
    breakpointBanner.innerHTML = `
      <div class="breakpoint-title">🚨 BREAKPOINT DETECTED</div>
      <div class="breakpoint-desc">${state.mode === 'judge' ? 'This app' : 'Your app'} fails <strong>FIRST</strong> at <code>${firstFail.endpoint}</code> due to <strong>${firstFail.name}</strong>.</div>
    `;

    // Reality Shock
    realityShock.style.display = 'block';
    $('#shock-answer').textContent = '❌ NO';
    $('#shock-answer').style.color = 'var(--error)';
    $('#shock-subtext').textContent = '(current state)';

    failures.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'failure-item';
      item.style.animationDelay = `${i * 0.15}s`;
      item.innerHTML = `
        <span class="failure-icon">❌</span>
        <div>
          <div class="failure-endpoint">${f.endpoint}</div>
          <div class="failure-desc">${f.name} — ${f.description}</div>
        </div>
        <span class="failure-code">${f.statusCode}</span>
      `;
      list.appendChild(item);
    });
    verdict.innerHTML = `💀 <strong>${failures.length} vulnerabilities</strong> detected. ${state.mode === 'judge' ? 'This project has' : 'Your project has'} ${failures.length === 1 ? 'a weak spot' : 'serious weak spots'}.`;
    state.hardModeSurvived = false;
  }

  // Now fetch the review
  runReview();
}

// ===== Review (runs in background while failures are shown) =====
async function runReview() {
  try {
    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectInfo: state.projectInfo,
        attackResults: state.attackResults,
      }),
    });

    const data = await res.json();
    console.log('[AI Review] Received structured analysis:', data);
    state.review = data.review;
    state.score = data.score;
    saveState();

    renderReviewInline();
  } catch (err) {
    console.error('Review failed:', err);
  }
}

function renderReviewInline() {
  // Roast
  $('#roast-text').textContent = state.review.roast;

  // Custom Verdict
  if (state.review.customVerdict && state.review.customVerdict.trim() !== '') {
    $('#custom-verdict-card').style.display = 'block';
    $('#custom-verdict-text').textContent = state.review.customVerdict;
  } else {
    $('#custom-verdict-card').style.display = 'none';
  }

  // Issues
  const issuesList = $('#issues-list');
  issuesList.innerHTML = '';
  const issues = Array.isArray(state.review.issues) ? state.review.issues : [];

  issues.forEach(issue => {
    const li = document.createElement('li');
    li.className = 'issue-item-new';

    if (typeof issue === 'object') {
      const sevClass = (issue.severity || 'high').toLowerCase();
      li.innerHTML = `
        <div class="issue-header">
          <span class="issue-sev sev-${sevClass}">${issue.severity || 'HIGH'}</span>
          <span class="issue-title">${issue.title}</span>
        </div>
        <div class="issue-desc">${issue.description}</div>
        <div class="issue-evidence"><strong>Evidence:</strong> ${issue.evidence}</div>
      `;
    } else {
      li.textContent = issue;
    }
    issuesList.appendChild(li);
  });

  // Judge mode: structured verdict
  if (state.mode === 'judge') {
    const judgeCard = $('#judge-verdict-card');
    judgeCard.style.display = 'block';
    const body = $('#judge-verdict-body');
    const totalPassed = state.attackResults.filter(a => a.passed).length;
    const totalFailed = state.attackResults.length - totalPassed;
    const level = getLevel(state.score.total);

    body.innerHTML = `
      <div class="judge-row"><span class="judge-label">Project</span><span class="judge-val">${state.projectInfo.fullName || state.projectInfo.name}</span></div>
      <div class="judge-row"><span class="judge-label">Score</span><span class="judge-val" style="color:${level.color}">${state.score.total}/100</span></div>
      <div class="judge-row"><span class="judge-label">Level</span><span class="judge-val">${level.emoji} ${level.name}</span></div>
      <div class="judge-row"><span class="judge-label">Tests Passed</span><span class="judge-val">${totalPassed}/${state.attackResults.length}</span></div>
      <div class="judge-row"><span class="judge-label">Critical Issues</span><span class="judge-val" style="color:var(--error)">${state.score.stats.criticalFails}</span></div>
      <div class="judge-row"><span class="judge-label">Verdict</span><span class="judge-val">${state.score.total >= 75 ? '✅ Recommend' : state.score.total >= 50 ? '⚠️ Needs Work' : '❌ Not Ready'}</span></div>
    `;
  }

  // Continue button
  addNextButton($('.failures-wrapper'), state.mode === 'judge' ? 'See Detailed Fixes →' : 'Show Me How To Fix This →', () => {
    goToStep(5); // → Fix
    renderFix();
  });
}

function renderFix() {
  const fixList = $('#fix-list');
  fixList.innerHTML = '';

  const fixes = Array.isArray(state.review.fixes) ? state.review.fixes : [];
  fixes.forEach(fix => {
    const li = document.createElement('li');
    li.className = 'rich-fix-item';

    if (typeof fix === 'object') {
      li.innerHTML = `
        <div class="fix-item-main">
          <div class="fix-item-top">
            <span class="fix-item-label">WHAT</span>
            <strong class="fix-item-title">${fix.title}</strong>
          </div>
          <div class="fix-item-row">
            <span class="fix-item-label">WHERE</span>
            <code class="fix-item-path">${fix.where}</code>
          </div>
          <div class="fix-item-row">
            <span class="fix-item-label">HOW</span>
            <p class="fix-item-desc">${fix.how}</p>
          </div>
          ${fix.code ? `
            <div class="fix-item-code">
              <pre><code>${fix.code}</code></pre>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      li.textContent = fix;
    }
    fixList.appendChild(li);
  });

  const preventList = $('#prevent-list');
  preventList.innerHTML = '';
  const preps = Array.isArray(state.review.prevention) ? state.review.prevention : [];
  preps.forEach(p => {
    const li = document.createElement('li');
    li.className = 'rich-prevent-item';

    if (typeof p === 'object') {
      li.innerHTML = `
        <div class="prevent-item-main">
          <div class="prevent-item-top">
            <span class="prevent-badge">INNOVATION</span>
            <strong class="prevent-title">${p.feature}</strong>
          </div>
          <p class="prevent-desc">${p.description}</p>
          <div class="prevent-benefit">🚀 ${p.benefit}</div>
          ${p.codeSnippet ? `
            <div class="prevent-code">
              <pre><code>${p.codeSnippet}</code></pre>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      li.textContent = p;
    }
    preventList.appendChild(li);
  });

  $('#impact-text').textContent = state.review.impact;

  // Before vs After
  if (state.review.topFixBefore && state.review.topFixAfter) {
    $('#before-after-card').style.display = 'block';
    $('#top-fix-before').textContent = state.review.topFixBefore;
    $('#top-fix-after').textContent = state.review.topFixAfter;
  } else {
    $('#before-after-card').style.display = 'none';
  }

  addNextButton($('.fix-wrapper'), 'See My Score →', () => {
    goToStep(6); // → Score
    renderScore();
  });
}

// ===== Step 5: Score + Level + Badges =====
function renderScore() {
  const score = state.score;
  const scoreValue = $('#score-value');
  const scoreRing = $('#score-ring');
  const level = getLevel(score.total);

  // Level display
  const levelBadge = $('#level-badge');
  const levelEmoji = $('#level-emoji');
  const levelName = $('#level-name');
  levelEmoji.textContent = level.emoji;
  levelName.textContent = level.name;
  levelBadge.style.borderColor = level.color;
  levelBadge.style.boxShadow = `0 0 30px ${level.color}44, 0 0 60px ${level.color}22`;

  // Score ring color
  scoreRing.style.stroke = level.color;
  scoreRing.style.filter = `drop-shadow(0 0 12px ${level.color})`;

  // Animated count-up
  let current = 0;
  const target = score.total;
  const duration = 2000;
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    current = Math.round(eased * target);
    scoreValue.textContent = current;
    scoreValue.style.color = level.color;

    const circumference = 553;
    const offset = circumference - (circumference * (current / 100));
    scoreRing.style.strokeDashoffset = offset;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);

  // Breakdown bars
  setTimeout(() => {
    $('#stability-value').textContent = score.breakdown.stability + '%';
    $('#stability-bar').style.width = score.breakdown.stability + '%';
  }, 800);
  setTimeout(() => {
    $('#errorhandling-value').textContent = score.breakdown.errorHandling + '%';
    $('#errorhandling-bar').style.width = score.breakdown.errorHandling + '%';
  }, 1200);
  setTimeout(() => {
    $('#structure-value').textContent = score.breakdown.structure + '%';
    $('#structure-bar').style.width = score.breakdown.structure + '%';
  }, 1600);

  // Stats
  $('#score-stats').innerHTML = `
    <span>⚔️ ${score.stats.totalAttacks} attacks</span>
    <span>✅ ${score.stats.passedAttacks} passed</span>
    <span>❌ ${score.stats.failedAttacks} failed</span>
    <span>🔴 ${score.stats.criticalFails} critical</span>
  `;

  // === GAMIFICATION ===

  // Streak system
  if (score.total > state.lastScore && state.lastScore > 0) {
    state.streak++;
  } else if (state.lastScore > 0 && score.total <= state.lastScore) {
    state.streak = 0;
  }
  state.lastScore = score.total;
  localStorage.setItem('codejudge-streak', state.streak.toString());
  localStorage.setItem('codejudge-last-score', state.lastScore.toString());

  if (state.streak > 0) {
    const streakDisplay = $('#streak-display');
    streakDisplay.style.display = 'flex';
    $('#streak-text').textContent = `Improvement Streak: +${state.streak} 🔥`;
  }

  // Hard Mode Badge — Chaos Survivor
  const badgesRow = $('#badges-row');
  badgesRow.innerHTML = '';
  if (state.hardModeSurvived) {
    badgesRow.style.display = 'flex';
    const badge = document.createElement('div');
    badge.className = 'badge chaos-survivor';
    badge.innerHTML = '🏆 <span>Chaos Survivor</span>';
    badgesRow.appendChild(badge);
  }

  // Judge Confidence Score (judge mode)
  if (state.mode === 'judge') {
    const confDisplay = $('#confidence-display');
    confDisplay.style.display = 'block';

    const testWeight = (score.stats.passedAttacks / Math.max(1, score.stats.totalAttacks)) * 40;
    const commitWeight = Math.min(30, (state.projectInfo.recentCommits || 0) * 3);
    const stabilityWeight = (score.breakdown.stability / 100) * 30;
    const confidence = Math.round(Math.min(100, testWeight + commitWeight + stabilityWeight));

    $('#confidence-value').textContent = confidence + '%';
    $('#confidence-bar-fill').style.width = confidence + '%';
    $('#confidence-basis').textContent = `Based on: ${score.stats.passedAttacks}/${score.stats.totalAttacks} tests passed · ${state.projectInfo.recentCommits || 0} recent commits · ${score.breakdown.stability}% stability`;
  }

  // Continue button
  addNextButton($('.score-wrapper'), 'See Leaderboard →', () => {
    goToStep(7); // → Leaderboard
    submitToLeaderboard();
  });
}

// ===== Step 6: Leaderboard =====
async function submitToLeaderboard() {
  try {
    const level = getLevel(state.score.total);
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: state.projectInfo.name,
        score: state.score.total,
        roast: state.review.roast,
        topFix: state.review.fixes[0],
        url: state.projectInfo.url,
        level: level.name,
        levelEmoji: level.emoji,
        badge: state.hardModeSurvived ? 'Chaos Survivor 🏆' : '',
        fullReview: state.review,
        attackResults: state.attackResults
      }),
    });
    state.leaderboardEntry = await res.json();

    const lbRes = await fetch('/api/leaderboard');
    state.leaderboard = await lbRes.json();

    renderLeaderboard();
  } catch (err) {
    console.error('Leaderboard error:', err);
  }
}

function renderLeaderboard() {
  const table = $('#leaderboard-table');
  table.innerHTML = '';

  state.leaderboard.forEach((entry, i) => {
    const row = document.createElement('div');
    const isCurrent = entry.id === state.leaderboardEntry.id;
    row.className = `leaderboard-row ${isCurrent ? 'current' : ''}`;
    row.style.animationDelay = `${i * 0.1}s`;

    const rankDisplay = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
    const rankClass = entry.rank <= 3 ? 'lb-rank lb-rank-medal' : 'lb-rank';

    const entryLevel = getLevel(entry.score);

    row.innerHTML = `
      <span class="${rankClass}">${rankDisplay}</span>
      <span class="lb-name">${entry.name}${isCurrent ? ' (you)' : ''}</span>
      <span class="lb-level">${entryLevel.emoji} ${entryLevel.name}</span>
      <span class="lb-score">${entry.score}/100</span>
      ${entry.badge ? `<span class="lb-badge">${entry.badge}</span>` : ''}
    `;

    row.addEventListener('click', () => openProjectDashboard(entry.id));
    table.appendChild(row);
  });

  // Prepare share card
  renderShareCard();
}

// ===== Share Card (hidden, for download) =====
function renderShareCard() {
  const entry = state.leaderboardEntry;
  const score = state.score;
  const level = getLevel(score.total);

  $('#share-badge').textContent = level.name.toUpperCase();
  $('#share-score-num').textContent = score.total;
  $('#share-level').textContent = `${level.emoji} ${level.name}`;
  $('#share-roast').textContent = state.review.roast;
  $('#share-fix-text').textContent = state.review.fixes[0];
  $('#share-rank').textContent = `Rank #${entry.rank} of ${entry.total}`;

  // Download button
  $('#share-download-btn').addEventListener('click', downloadShareCard);

  // Copy button
  $('#share-copy-btn').addEventListener('click', () => {
    const text = `🏆 CodeJudge AI Result\n\n📊 Score: ${score.total}/100\n${level.emoji} Level: ${level.name}\n🔥 "${state.review.roast}"\n🛠 Top Fix: ${state.review.fixes[0]}\n📈 Rank: #${entry.rank} of ${entry.total}${state.hardModeSurvived ? '\n🏆 Badge: Chaos Survivor' : ''}\n\nJudge your project at codejudge.ai`;
    navigator.clipboard.writeText(text).then(() => {
      const btn = $('#share-copy-btn');
      btn.textContent = '✅ Copied!';
      setTimeout(() => btn.textContent = '📋 Copy Result', 2000);
    });
  });

  // Restart button
  $('#restart-btn').addEventListener('click', () => {
    window.location.reload();
  });
}

async function downloadShareCard() {
  const card = $('#share-card');

  try {
    if (!window.html2canvas) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      document.head.appendChild(script);
      await new Promise((resolve) => { script.onload = resolve; });
    }

    const canvas = await window.html2canvas(card, {
      backgroundColor: '#0e0e0e',
      scale: 2,
      useCORS: true,
    });

    const link = document.createElement('a');
    link.download = `codejudge-${state.projectInfo.name}-${state.score.total}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Screenshot failed:', err);
    alert('Could not generate image. Try a manual screenshot instead.');
  }
}

// ===== Helpers =====
function goToStep(index) {
  state.currentStep = index;
  saveState();
  showScreen(index);

  switch (index) {
    case 1: runProcessing(); break;
    case 2: runAttack(); break;
    case 3: showFailures(); break;
    // Steps 4-6 are triggered by user clicks
  }
}

function addNextButton(container, text, onClick) {
  const existing = container.querySelector('.next-step-btn');
  if (existing) existing.remove();

  const btn = document.createElement('button');
  btn.className = 'next-step-btn';
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  container.appendChild(btn);
}

// ===== Project Dashboard Modal =====
async function openProjectDashboard(id) {
  const modal = $('#dashboard-modal');
  const loader = $('#dashboard-loading');
  const body = $('#dashboard-body');

  modal.classList.remove('hidden');
  loader.classList.remove('hidden');
  body.classList.add('hidden');

  try {
    const res = await fetch(`/api/project/${id}`);
    const project = await res.json();

    if (!res.ok) throw new Error(project.error);

    // Populate Header
    $('#db-project-name').textContent = project.name;
    $('#db-project-url').textContent = project.url;

    const level = getLevel(project.score);
    $('#db-level-emoji').textContent = level.emoji;
    $('#db-level-name').textContent = level.name;
    $('#db-level-badge').style.borderColor = level.color;
    $('#db-level-badge').style.color = level.color;

    // Populate Metrics
    $('#db-score-num').textContent = project.score;
    $('#db-score-num').style.color = level.color;
    $('#db-roast-text').textContent = project.roast;

    // Populate Attacks
    const attacksGrid = $('#db-attacks-grid');
    attacksGrid.innerHTML = '';
    (project.attackResults || []).forEach(res => {
      const card = document.createElement('div');
      card.className = `attack-card ${res.passed ? 'passed' : 'failed'}`;
      card.innerHTML = `
        <span class="attack-status">${res.passed ? '✅' : '❌'}</span>
        <div class="attack-info">
          <div class="attack-name">${res.name}</div>
          <div class="attack-timing">${res.responseTime}ms</div>
        </div>
      `;
      attacksGrid.appendChild(card);
    });

    // Populate AI Review
    const review = project.fullReview || {};

    const issuesList = $('#db-issues-list');
    issuesList.innerHTML = '';
    (review.issues || []).forEach(iss => {
      const li = document.createElement('li');
      li.textContent = iss;
      issuesList.appendChild(li);
    });

    const fixesList = $('#db-fixes-list');
    fixesList.innerHTML = '';
    (review.fixes || []).forEach(fix => {
      const li = document.createElement('li');
      li.textContent = fix;
      fixesList.appendChild(li);
    });

    const preventList = $('#db-prevent-list');
    preventList.innerHTML = '';
    (review.prevention || []).forEach(prev => {
      const li = document.createElement('li');
      li.textContent = prev;
      preventList.appendChild(li);
    });

    loader.classList.add('hidden');
    body.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load dashboard:', err);
    alert('Failed to load project details.');
    modal.classList.add('hidden');
  }
}

function initDashboardModal() {
  const modal = $('#dashboard-modal');
  const closeBtns = [$('#modal-close'), $('#modal-close-icon')];

  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  });

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }
  });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initModeToggle();
  initAuth();
  initLanding();
  initDashboardModal();

  // Restore State
  if (state.currentStep > 0 && state.projectInfo) {
    if (state.projectInfo) renderXRay();
    if (state.review) {
      renderReviewInline();
      renderFix();
      renderScore ? renderScore() : null;
    }
    showScreen(state.currentStep);
  } else {
    showScreen(0);
  }
});
