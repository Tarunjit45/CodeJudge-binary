/**
 * CodeJudge AI — Main Application
 * Pipeline state machine controlling the 9-step judging flow.
 */

// ===== State =====
const state = {
  currentStep: 0,
  projectInfo: null,
  attackResults: [],
  review: null,
  score: null,
  leaderboardEntry: null,
  leaderboard: [],
};

const STEPS = [
  'submit', 'analyze', 'attack', 'fail',
  'review', 'fix', 'score', 'rank', 'share',
];

const SCREEN_IDS = [
  'screen-landing', 'screen-processing', 'screen-attack',
  'screen-failures', 'screen-review', 'screen-fix',
  'screen-score', 'screen-leaderboard', 'screen-share',
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

// ===== Pipeline Progress Bar =====
function updatePipelineBar(step) {
  $$('.pipeline-step').forEach((el, i) => {
    el.classList.remove('active', 'completed');
    if (i < step) el.classList.add('completed');
    if (i === step) el.classList.add('active');
  });

  // Update connectors
  $$('.pipeline-connector').forEach((el, i) => {
    if (i < step) {
      el.style.background = 'var(--accent-dim)';
      el.style.setProperty('--connector-done', '1');
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
      s.offsetHeight; // trigger reflow
      s.style.animation = 'screenIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    } else {
      s.classList.remove('active');
    }
  });
  state.currentStep = index;
  updatePipelineBar(index);
}

// ===== Step 0: Submit =====
function initLanding() {
  const input = $('#url-input');
  const customConfigInput = $('#custom-config-input');
  const btn = $('#judge-btn');
  const error = $('#input-error');

  // Update stat count
  fetchLeaderboardCount();

  const handleSubmit = async () => {
    const url = input.value.trim();
    const customConfig = customConfigInput?.value?.trim() || '';
    error.textContent = '';

    if (!url) {
      error.textContent = 'Please enter a URL';
      return;
    }

    // Basic URL validation
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
        body: JSON.stringify({ url, customConfig }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      state.projectInfo = data;
      goToStep(1); // → Analyze
    } catch (err) {
      error.textContent = err.message;
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Judge My Project';
    } finally {
      // Logic for log injection later
    }
  };

  btn.addEventListener('click', handleSubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
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
    'All probes complete. Showing results…',
  ] : [
    `Connecting to GitHub API…`,
    `Found: ${state.projectInfo.fullName || state.projectInfo.name}`,
    `Language: ${state.projectInfo.language} | Stars: ${state.projectInfo.stars} ⭐`,
    `Fetching file tree… ${state.projectInfo.totalFiles || '?'} files found`,
    `Reading package.json… ${(state.projectInfo.dependencies || []).length} deps, ${(state.projectInfo.devDependencies || []).length} dev deps`,
    `Tests: ${q.hasTests ? `✅ Found (${q.testFramework || 'detected'})` : '❌ No test files found'}`,
    `CI/CD: ${q.hasCI ? `✅ ${q.ciPlatform}` : '❌ No pipeline configured'}`,
    `Security: helmet=${q.hasHelmet ? '✅' : '❌'} | rate-limit=${q.hasRateLimit ? '✅' : '❌'} | validation=${q.hasValidation ? '✅' : '❌'}`,
    `Docker: ${q.hasDocker ? '✅' : '❌'} | TypeScript: ${q.hasTypescript ? '✅' : '❌'} | Linter: ${q.hasLinter ? '✅' : '❌'}`,
    `Genesis Commit: ${state.projectInfo.firstCommitDate ? new Date(state.projectInfo.firstCommitDate).toDateString() : 'Unknown'}`,
    `Recent activity: ${state.projectInfo.recentCommits || 0} commits in last 30 days`,
    'Analysis complete. Running checks…',
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
      setTimeout(() => goToStep(2), 800); // → Attack
    }
  }, 500);
}

// ===== Step 2: Attack =====
function runAttack() {
  const grid = $('#attack-grid');
  const summary = $('#attack-summary');
  grid.innerHTML = '';
  summary.style.display = 'none';

  // SSE stream from backend
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
          showAttackSummary(summary);
          setTimeout(() => goToStep(3), 2000); // → Failures
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

// ===== Step 3: Failure Detection =====
function showFailures() {
  const list = $('#failures-list');
  const verdict = $('#failures-verdict');
  list.innerHTML = '';

  const failures = state.attackResults.filter(a => !a.passed);
  const breakpointBanner = $('#breakpoint-banner');

  if (failures.length === 0) {
    breakpointBanner.style.display = 'none';
    verdict.innerHTML = '🎉 <strong>Impressive!</strong> Your project survived all attacks. But the review might still be brutal…';
  } else {
    // Breakpoint Highlight (FIX 5)
    const firstFail = failures[0];
    breakpointBanner.style.display = 'block';
    breakpointBanner.innerHTML = `
      <div class="breakpoint-title">🚨 BREAKPOINT DETECTED</div>
      <div class="breakpoint-desc">Your app fails <strong>FIRST</strong> at <code>${firstFail.endpoint}</code> due to <strong>${firstFail.name}</strong>.</div>
    `;

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
    verdict.innerHTML = `💀 <strong>${failures.length} vulnerabilities</strong> detected. Your project has ${failures.length === 1 ? 'a weak spot' : 'serious weak spots'}.`;
  }

  // Auto-advance after showing failures
  setTimeout(() => runReview(), 3000);
}

// ===== Step 4 & 5: Review & Fix =====
async function runReview() {
  goToStep(4); // → Review

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
    state.review = data.review;
    state.score = data.score;

    renderReview();
  } catch (err) {
    console.error('Review failed:', err);
  }
}

function renderReview() {
  // Roast
  $('#roast-text').textContent = state.review.roast;

  // Custom Verdict / Manual Test output
  if (state.review.customVerdict && state.review.customVerdict.trim() !== '') {
    $('#custom-verdict-card').style.display = 'block';
    $('#custom-verdict-text').textContent = state.review.customVerdict;
  } else {
    $('#custom-verdict-card').style.display = 'none';
  }

  // Issues
  const issuesList = $('#issues-list');
  issuesList.innerHTML = '';
  state.review.issues.forEach(issue => {
    const li = document.createElement('li');
    li.textContent = issue;
    issuesList.appendChild(li);
  });

  // Add continue button
  addNextButton($('.review-wrapper'), 'See Fix & Prevention →', () => {
    goToStep(5); // → Fix
    renderFix();
  });
}

function renderFix() {
  // Fixes
  const fixList = $('#fix-list');
  fixList.innerHTML = '';
  state.review.fixes.forEach(fix => {
    const li = document.createElement('li');
    li.textContent = fix;
    fixList.appendChild(li);
  });

  // Prevention
  const preventList = $('#prevent-list');
  preventList.innerHTML = '';
  state.review.prevention.forEach(prev => {
    const li = document.createElement('li');
    li.textContent = prev;
    preventList.appendChild(li);
  });

  // Impact
  $('#impact-text').textContent = state.review.impact;

  // Before vs After (FIX 3)
  if (state.review.topFixBefore && state.review.topFixAfter) {
    $('#before-after-card').style.display = 'block';
    $('#top-fix-before').textContent = state.review.topFixBefore;
    $('#top-fix-after').textContent = state.review.topFixAfter;
  } else {
    $('#before-after-card').style.display = 'none';
  }

  // Add continue button
  addNextButton($('.fix-wrapper'), 'See My Score →', () => {
    goToStep(6); // → Score
    renderScore();
  });
}

// ===== Step 6: Score =====
function renderScore() {
  const score = state.score;
  const scoreValue = $('#score-value');
  const scoreRing = $('#score-ring');

  // Animated count-up
  let current = 0;
  const target = score.total;
  const duration = 2000;
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    current = Math.round(eased * target);
    scoreValue.textContent = current;

    // Update ring
    const circumference = 553;
    const offset = circumference - (circumference * (current / 100));
    scoreRing.style.strokeDashoffset = offset;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);

  // Breakdown bars (delayed for effect)
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

  // Continue button
  addNextButton($('.score-wrapper'), 'See Leaderboard →', () => {
    goToStep(7); // → Leaderboard
    submitToLeaderboard();
  });
}

// ===== Step 7: Leaderboard =====
async function submitToLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: state.projectInfo.name,
        score: state.score.total,
        roast: state.review.roast,
        topFix: state.review.fixes[0],
        url: state.projectInfo.url,
      }),
    });
    state.leaderboardEntry = await res.json();

    // Fetch full leaderboard
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

    row.innerHTML = `
      <span class="${rankClass}">${rankDisplay}</span>
      <span class="lb-name">${entry.name}${isCurrent ? ' (you)' : ''}</span>
      <span class="lb-score">${entry.score}/100</span>
    `;
    table.appendChild(row);
  });

  // Continue button
  addNextButton($('.leaderboard-wrapper'), 'Get Share Card →', () => {
    goToStep(8); // → Share
    renderShareCard();
  });
}

// ===== Step 8: Share =====
function renderShareCard() {
  const entry = state.leaderboardEntry;
  const score = state.score;

  $('#share-badge').textContent = score.total >= 70 ? 'RESILIENT' : score.total >= 40 ? 'FRAGILE' : 'CRITICAL';
  $('#share-score-num').textContent = score.total;
  $('#share-roast').textContent = state.review.roast;
  $('#share-fix-text').textContent = state.review.fixes[0];
  $('#share-rank').textContent = `Rank #${entry.rank} of ${entry.total}`;

  // Download button
  $('#share-download-btn').addEventListener('click', downloadShareCard);

  // Copy button
  $('#share-copy-btn').addEventListener('click', () => {
    const text = `🏆 CodeJudge AI Result\n\n📊 Score: ${score.total}/100\n🔥 "${state.review.roast}"\n🛠 Top Fix: ${state.review.fixes[0]}\n📈 Rank: #${entry.rank} of ${entry.total}\n\nJudge your project at codejudge.ai`;
    navigator.clipboard.writeText(text).then(() => {
      const btn = $('#share-copy-btn');
      btn.textContent = '✅ Copied!';
      setTimeout(() => btn.textContent = '📋 Copy to Clipboard', 2000);
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
    // Use html2canvas from CDN
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
  showScreen(index);

  // Auto-trigger step logic
  switch (index) {
    case 1: runProcessing(); break;
    case 2: runAttack(); break;
    case 3: showFailures(); break;
    // Steps 4-8 are triggered by user or auto after previous
  }
}

function addNextButton(container, text, onClick) {
  // Remove existing next button
  const existing = container.querySelector('.next-step-btn');
  if (existing) existing.remove();

  const btn = document.createElement('button');
  btn.className = 'next-step-btn';
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  container.appendChild(btn);
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLanding();
  showScreen(0);
});
