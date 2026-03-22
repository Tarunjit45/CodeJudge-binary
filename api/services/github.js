/**
 * GitHub Deep Analysis Service.
 * Fetches real repository data: metadata, README, file tree, package.json,
 * and detects actual quality signals (tests, CI, Docker, security configs).
 */
export async function fetchGitHubRepo(url, userToken = null) {
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

  const activeToken = userToken || process.env.GITHUB_TOKEN;
  if (activeToken) {
    headers['Authorization'] = `token ${activeToken}`;
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
      
      console.log(`[GitHub] File tree fetched: ${fileTree.length} files found.`);
      qualitySignals = analyzeFileTree(fileTree);
    } else {
      console.warn(`[GitHub] Recursive tree fetch failed (${treeRes.status}). Falling back to root contents.`);
      // Fallback: Fetch root contents if recursive tree fails (common for huge repos)
      const rootRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });
      if (rootRes.ok) {
        const rootData = await rootRes.json();
        fileTree = rootData.map(f => f.path);
        qualitySignals = analyzeFileTree(fileTree);
      }
    }
  } catch (err) {
    console.error('[GitHub] Error fetching file tree:', err.message);
  }

  // --- 5. New: Fetch actual code snippets if authorized for deeper analysis ---
  let keyFilesContent = "";
  if (activeToken) {
    try {
      // Broaden search: Focus on source files in common directories or with common extensions
      const priorityExtensions = ['.js', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.php', '.cpp', '.c', '.cs', '.rb'];
      const noiseFolders = ['node_modules', 'dist', 'build', 'out', 'vendor', '.next', '.git'];

      const keyFiles = fileTree.filter(path => {
        const lower = path.toLowerCase();
        const hasPriorityExt = priorityExtensions.some(ext => lower.endsWith(ext));
        const isInNoise = noiseFolders.some(folder => lower.includes(folder));
        
        // Priority 1: Main entry points
        const isMain = ['index.js', 'app.js', 'main.js', 'server.js', 'index.ts', 'main.py', 'index.tsx', 'main.go', 'main.rs'].includes(lower);
        
        // Priority 2: Logic directories
        const isLogicDir = path.startsWith('api/') || path.startsWith('src/') || path.startsWith('lib/') || path.startsWith('app/') || path.startsWith('backend/');
        
        return !isInNoise && (isMain || (isLogicDir && hasPriorityExt));
      })
      .sort((a, b) => {
        // Sort to get entry points first, then others
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aIsEntry = ['index', 'app', 'main', 'server'].some(n => aLower.includes(n));
        const bIsEntry = ['index', 'app', 'main', 'server'].some(n => bLower.includes(n));
        if (aIsEntry && !bIsEntry) return -1;
        if (!aIsEntry && bIsEntry) return 1;
        return a.length - b.length; // prefer shorter paths (usually more central)
      })
      .slice(0, 10); // Increase limit to 10 files for better analysis

      for (const path of keyFiles) {
        const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
          keyFilesContent += `\n--- FILE: ${path} ---\n${content.substring(0, 3000)}\n`; // Increase snippet size
        }
      }
      console.log(`[GitHub] Deep scan complete. Fetched ${keyFiles.length} files. Total code length: ${keyFilesContent.length} chars.`);
    } catch (err) {
      console.warn('[GitHub] Failed to fetch deep code snippets:', err.message);
    }
  }

  // --- 6. Fetch package.json (if exists) for real dependency analysis ---
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

  // --- 7. Fetch full commit history & timeline details ---
  let recentCommits = 0;
  let totalCommits = 0;
  let firstCommitDate = null;
  let lastCommitDate = null;
  let commits = [];
  let pushEvents = [];

  try {
    // A) Fetch total commits and first commit date
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=30`, // Fetch up to 30 for analysis
      { headers }
    );
    if (commitRes.ok) {
      const commitsData = await commitRes.json();
      if (commitsData.length > 0) {
        lastCommitDate = commitsData[0].commit?.author?.date || commitsData[0].commit?.committer?.date;
        commits = commitsData.map(c => ({
          sha: c.sha,
          message: c.commit.message,
          date: c.commit.author?.date || c.commit.committer?.date,
          authorDate: c.commit.author?.date,
          committerDate: c.commit.committer?.date,
          author: c.commit.author?.name,
        }));

        const linkHeader = commitRes.headers.get('link');
        if (linkHeader && linkHeader.includes('last')) {
          const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
          if (lastMatch) {
            totalCommits = parseInt(lastMatch[1], 10) * 1; // base on per_page? No, GitHub pagination is tricky. 
            // Better to assume per_page matches.
            // Actually, we'll use the page count for total estimate.
            totalCommits = parseInt(lastMatch[1], 10) * tokensPerPage(linkHeader) || 0;

            // Fetch the last page to get the earliest commit
            const firstCommitRes = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1&page=${lastMatch[1]}`,
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
          totalCommits = commitsData.length;
          firstCommitDate = commitsData[commitsData.length - 1].commit?.author?.date;
        }
      }
    }

    // B) Fetch recent pushes from Events (very hard to fake)
    const eventRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/events?per_page=30`,
      { headers }
    );
    if (eventRes.ok) {
      const eventData = await eventRes.json();
      pushEvents = eventData
        .filter(e => e.type === 'PushEvent')
        .map(e => ({
          id: e.id,
          pushedAt: e.created_at,
          actor: e.actor.login,
          commits: e.payload.commits?.length || 0
        }));
    }

    // C) Fetch recent commits (last 30 days) count
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const countRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&per_page=1`,
      { headers }
    );
    if (countRes.ok) {
      const countLinkHeader = countRes.headers.get('link');
      if (countLinkHeader && countLinkHeader.includes('last')) {
        const lastMatch = countLinkHeader.match(/page=(\d+)>; rel="last"/);
        recentCommits = lastMatch ? parseInt(lastMatch[1]) : 1;
      } else {
        const countData = await countRes.json();
        recentCommits = countData.length;
      }
    }
  } catch (err) {
    console.warn('[GitHub] Timeline fetch error:', err.message);
  }

  // helper to get per_page from link header
  function tokensPerPage(link) {
    const match = link.match(/per_page=(\d+)/);
    return match ? parseInt(match[1]) : 30;
  }

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
    sourceCode: keyFilesContent,
    url,
    totalFiles: fileTree.length,
    fileTree: fileTree.slice(0, 200), // send first 200 files for analysis
    qualitySignals: {
      ...qualitySignals,
      frontendFramework: (() => {
        const allDeps = [...(dependencies || []), ...(devDependencies || [])];
        if (allDeps.includes('next')) return 'Next.js (Fullstack)';
        if (allDeps.includes('nuxt')) return 'Nuxt.js (Fullstack)';
        if (allDeps.includes('react')) return 'React';
        if (allDeps.includes('vue')) return 'Vue';
        if (allDeps.includes('svelte')) return 'Svelte';
        if (allDeps.includes('@angular/core')) return 'Angular';
        if (allDeps.includes('vite')) return 'Vite-powered';
        if (allDeps.includes('astro')) return 'Astro (SSG/SSR)';
        if (allDeps.includes('solid-js')) return 'Solid.js';
        return 'Standard/Vanilla';
      })(),
      backendFramework: (() => {
        const allDeps = [...(dependencies || []), ...(devDependencies || [])];
        const content = (readme || '').toLowerCase();

        // Node.js frameworks
        if (allDeps.includes('express')) return 'Express.js';
        if (allDeps.includes('fastify')) return 'Fastify';
        if (allDeps.includes('@nestjs/core')) return 'NestJS';
        if (allDeps.includes('koa')) return 'Koa.js';
        if (allDeps.includes('hapi')) return 'Hapi.js';

        // Python frameworks (checking README context or common file indicators if needed, though deps are best)
        if (/fastapi/i.test(content)) return 'FastAPI';
        if (/flask/i.test(content)) return 'Flask';
        if (/django/i.test(content)) return 'Django';

        // Return language default if no specific framework found
        if (repoData.language === 'JavaScript' || repoData.language === 'TypeScript') return 'Node.js Server';
        return repoData.language || 'Generic API';
      })(),
      isTailwind: qualitySignals.isTailwind || (dependencies || []).some(d => d.includes('tailwind')),
      stylingType: (() => {
        const allDeps = [...(dependencies || []), ...(devDependencies || [])];
        if (allDeps.includes('tailwindcss')) return 'Tailwind CSS';
        if (allDeps.includes('sass') || allDeps.includes('node-sass')) return 'SASS/SCSS';
        if (allDeps.includes('styled-components')) return 'Styled Components';
        if (allDeps.includes('emotion') || allDeps.includes('@emotion/react')) return 'Emotion';
        if (allDeps.includes('bootstrap')) return 'Bootstrap UI';
        if (allDeps.includes('vbulletin')) return 'MUI (Material UI)';
        if (allDeps.includes('ant-design')) return 'Ant Design';
        return 'Standard CSS/Vanilla';
      })(),
      hasAuth: qualitySignals.hasAuth || (dependencies || []).some(d => d.includes('auth') || d.includes('passport') || d.includes('jwt') || d.includes('clerk') || d.includes('auth0')),
      hasDatabase: qualitySignals.hasDatabase || (dependencies || []).some(d => d.includes('mongoose') || d.includes('prisma') || d.includes('sequelize') || d.includes('pg') || d.includes('redis') || d.includes('firebase'))
    },
    dependencies,
    devDependencies,
    recentCommits,
    totalCommits,
    firstCommitDate,
    lastCommitDate,
    commits,
    pushEvents,
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
    hasAuth: false,
    hasDatabase: false,
    hasRoutes: false,
    isSPA: false,
    isTailwind: false,
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

    // Feature detection based on file names
    if (lower.includes('auth') || lower.includes('login') || lower.includes('passport') || lower.includes('jwt') || lower.includes('clerk')) signals.hasAuth = true;
    if (lower.includes('mongoose') || lower.includes('prisma') || lower.includes('sequelize') || lower.includes('db.config') || lower.includes('database')) signals.hasDatabase = true;
    if (lower.includes('/routes/') || lower.includes('/api/') || lower.includes('controller')) signals.hasRoutes = true;
    if (lower.includes('tailwind.config')) signals.isTailwind = true;
  }

  return signals;
}
