/**
 * GitHub Deep Analysis Service.
 * Fetches real repository data: metadata, README, file tree, package.json,
 * and detects actual quality signals (tests, CI, Docker, security configs).
 */
export async function fetchGitHubRepo(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL. Expected format: https://github.com/owner/repo');
  }

  const owner = encodeURIComponent(match[1]);
  const repo = encodeURIComponent(match[2].replace(/\.git$/, ''));
  const headers = { 
    'Accept': 'application/vnd.github.v3+json', 
    'User-Agent': 'CodeJudge-AI-Scanner',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  // --- 1. Fetch repo metadata ---
  let repoRes;
  try {
    repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  } catch (err) {
    console.error(`[GitHub] Network error fetching repo ${owner}/${repo}:`, err);
    throw new Error('Connection to GitHub API failed (Network error)');
  }

  if (!repoRes.ok) {
    const errorData = await repoRes.json().catch(() => ({ message: 'Unknown error' }));
    console.error(`[GitHub] API Error ${repoRes.status}:`, errorData);
    throw new Error(`GitHub API error: ${repoRes.status} — ${errorData.message}`);
  }
  const repoData = await repoRes.json();

  // --- 2. Fetch README ---
  let readme = '';
  try {
    const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers });
    if (readmeRes.ok) {
      const readmeData = await readmeRes.json();
      readme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
    }
  } catch {
    readme = '';
  }

  // --- 3. Fetch languages ---
  let languages = {};
  try {
    const langRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers });
    if (langRes.ok) {
      languages = await langRes.json();
    }
  } catch { /* ignore */ }

  // --- 4. Fetch file tree (top level + key subdirectories) ---
  let fileTree = [];
  let qualitySignals = {
    hasTests: false,
    hasCI: false,
    hasDocker: false,
    hasLinter: false,
    hasSecurityPolicy: false,
    hasContributing: false,
    hasLicense: false,
    hasEnvExample: false,
    hasPackageJson: false,
    hasTypescript: false,
    hasGitignore: false,
    hasPrettier: false,
    hasEditorconfig: false,
    hasChangelog: false,
    testFramework: null,
    ciPlatform: null,
    packageManager: null,
  };

  try {
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`,
      { headers }
    );
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      fileTree = (treeData.tree || [])
        .filter(f => f.type === 'blob')
        .map(f => f.path);

      // Deep quality signal detection from REAL file tree
      qualitySignals = analyzeFileTree(fileTree);
    }
  } catch { /* ignore */ }

  // --- 5. Fetch package.json (if exists) for real dependency analysis ---
  let packageJson = null;
  let dependencies = [];
  let devDependencies = [];

  if (qualitySignals.hasPackageJson) {
    try {
      const pkgRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/package.json`,
        { headers }
      );
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json();
        packageJson = JSON.parse(Buffer.from(pkgData.content, 'base64').toString('utf-8'));
        dependencies = Object.keys(packageJson.dependencies || {});
        devDependencies = Object.keys(packageJson.devDependencies || {});

        // Detect test framework from real dependencies
        if (devDependencies.includes('jest') || dependencies.includes('jest')) qualitySignals.testFramework = 'Jest';
        else if (devDependencies.includes('mocha')) qualitySignals.testFramework = 'Mocha';
        else if (devDependencies.includes('vitest')) qualitySignals.testFramework = 'Vitest';
        else if (devDependencies.includes('cypress')) qualitySignals.testFramework = 'Cypress';
        else if (devDependencies.includes('playwright')) qualitySignals.testFramework = 'Playwright';

        // Detect security packages
        qualitySignals.hasHelmet = dependencies.includes('helmet');
        qualitySignals.hasRateLimit = dependencies.includes('express-rate-limit') || dependencies.includes('rate-limiter-flexible');
        qualitySignals.hasCors = dependencies.includes('cors');
        qualitySignals.hasValidation = dependencies.includes('joi') || dependencies.includes('zod') || dependencies.includes('yup') || dependencies.includes('express-validator');
        qualitySignals.hasErrorHandler = dependencies.includes('express-async-errors') || dependencies.includes('http-errors');

        // Package manager
        if (fileTree.includes('pnpm-lock.yaml')) qualitySignals.packageManager = 'pnpm';
        else if (fileTree.includes('yarn.lock')) qualitySignals.packageManager = 'yarn';
        else if (fileTree.includes('package-lock.json')) qualitySignals.packageManager = 'npm';
      }
    } catch { /* ignore */ }
  }

  // --- 6. Fetch full commit history & recent commits ---
  let recentCommits = 0;
  let totalCommits = 0;
  let firstCommitDate = null;
  let lastCommitDate = null;
  
  try {
    // A) Fetch total commits and first commit date
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      { headers }
    );
    if (commitRes.ok) {
      const commits = await commitRes.json();
      if (commits.length > 0) {
        lastCommitDate = commits[0].commit?.author?.date || commits[0].commit?.committer?.date;
        
        const linkHeader = commitRes.headers.get('link');
        if (linkHeader && linkHeader.includes('last')) {
          const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
          if (lastMatch) {
            totalCommits = parseInt(lastMatch[1], 10);
            
            // Fetch the last page to get the earliest commit
            const firstCommitRes = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1&page=${totalCommits}`,
              { headers }
            );
            if (firstCommitRes.ok) {
              const firstCommitData = await firstCommitRes.json();
              if (firstCommitData.length > 0) {
                firstCommitDate = firstCommitData[0].commit?.author?.date || firstCommitData[0].commit?.committer?.date;
              }
            }
          }
        } else {
          totalCommits = 1;
          firstCommitDate = lastCommitDate;
        }
      }
    }

    // B) Fetch recent commits (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&per_page=1`,
      { headers }
    );
    if (recentRes.ok) {
      const recentLinkHeader = recentRes.headers.get('link');
      if (recentLinkHeader && recentLinkHeader.includes('last')) {
        const lastMatch = recentLinkHeader.match(/page=(\d+)>; rel="last"/);
        recentCommits = lastMatch ? parseInt(lastMatch[1]) : 1;
      } else {
        const recentData = await recentRes.json();
        recentCommits = recentData.length;
      }
    }
  } catch { /* ignore */ }

  // --- 7. Fetch open issues/PRs for health signal ---
  let openBugs = 0;
  try {
    const issueRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=open&labels=bug&per_page=1`,
      { headers }
    );
    if (issueRes.ok) {
      const linkHeader = issueRes.headers.get('link');
      if (linkHeader && linkHeader.includes('last')) {
        const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
        openBugs = lastMatch ? parseInt(lastMatch[1]) : 0;
      } else {
        openBugs = (await issueRes.json()).length;
      }
    }
  } catch { /* ignore */ }

  return {
    name: repoData.name,
    fullName: repoData.full_name,
    description: repoData.description || '(No description)',
    language: repoData.language || 'Unknown',
    languages: Object.keys(languages),
    languageBytes: languages,
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    openIssues: repoData.open_issues_count,
    openBugs,
    createdAt: repoData.created_at,
    updatedAt: repoData.updated_at,
    defaultBranch: repoData.default_branch,
    hasWiki: repoData.has_wiki,
    license: repoData.license?.spdx_id || 'None',
    readme: readme.substring(0, 6000),
    url,
    totalFiles: fileTree.length,
    fileTree: fileTree.slice(0, 200), // send first 200 files for analysis
    qualitySignals,
    dependencies,
    devDependencies,
    recentCommits,
    totalCommits,
    firstCommitDate,
    lastCommitDate,
    scripts: packageJson?.scripts ? Object.keys(packageJson.scripts) : [],
  };
}

/**
 * Analyze the real file tree for quality signals.
 */
function analyzeFileTree(files) {
  const signals = {
    hasTests: false,
    hasCI: false,
    hasDocker: false,
    hasLinter: false,
    hasSecurityPolicy: false,
    hasContributing: false,
    hasLicense: false,
    hasEnvExample: false,
    hasPackageJson: false,
    hasTypescript: false,
    hasGitignore: false,
    hasPrettier: false,
    hasEditorconfig: false,
    hasChangelog: false,
    testFramework: null,
    ciPlatform: null,
    packageManager: null,
    testFileCount: 0,
  };

  for (const f of files) {
    const lower = f.toLowerCase();

    // Test detection
    if (lower.includes('test') || lower.includes('spec') || lower.includes('__tests__')) {
      signals.hasTests = true;
      if (lower.endsWith('.test.js') || lower.endsWith('.test.ts') || lower.endsWith('.spec.js') || lower.endsWith('.spec.ts')) {
        signals.testFileCount++;
      }
    }

    // CI detection
    if (lower.startsWith('.github/workflows/')) { signals.hasCI = true; signals.ciPlatform = 'GitHub Actions'; }
    if (lower === '.travis.yml') { signals.hasCI = true; signals.ciPlatform = 'Travis CI'; }
    if (lower === '.circleci/config.yml') { signals.hasCI = true; signals.ciPlatform = 'CircleCI'; }
    if (lower === '.gitlab-ci.yml') { signals.hasCI = true; signals.ciPlatform = 'GitLab CI'; }
    if (lower === 'jenkinsfile') { signals.hasCI = true; signals.ciPlatform = 'Jenkins'; }

    // Docker
    if (lower === 'dockerfile' || lower === 'docker-compose.yml' || lower === 'docker-compose.yaml') {
      signals.hasDocker = true;
    }

    // Linter
    if (lower === '.eslintrc' || lower === '.eslintrc.js' || lower === '.eslintrc.json' || lower === '.eslintrc.yml' || lower === 'eslint.config.js' || lower === 'eslint.config.mjs') {
      signals.hasLinter = true;
    }

    // Other quality indicators
    if (lower === 'security.md' || lower === '.github/security.md') signals.hasSecurityPolicy = true;
    if (lower === 'contributing.md') signals.hasContributing = true;
    if (lower === 'license' || lower === 'license.md' || lower === 'license.txt') signals.hasLicense = true;
    if (lower === '.env.example' || lower === '.env.sample') signals.hasEnvExample = true;
    if (lower === 'package.json') signals.hasPackageJson = true;
    if (lower === 'tsconfig.json') signals.hasTypescript = true;
    if (lower === '.gitignore') signals.hasGitignore = true;
    if (lower === '.prettierrc' || lower === '.prettierrc.json' || lower === '.prettierrc.js' || lower === 'prettier.config.js') signals.hasPrettier = true;
    if (lower === '.editorconfig') signals.hasEditorconfig = true;
    if (lower === 'changelog.md' || lower === 'history.md') signals.hasChangelog = true;
  }

  return signals;
}
