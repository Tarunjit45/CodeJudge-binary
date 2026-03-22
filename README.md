<p align="center">
  <img src="https://img.shields.io/badge/CodeJudge-AI-39e75f?style=for-the-badge&labelColor=0b0b0b&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzM5ZTc1ZiI+PHBhdGggZD0iTTEyIDJMMyA3djEwbDkgNSA5LTVWN2wtOS01em0wIDIuMThsNi45MSAzLjgzTDEyIDE5LjgyIDUuMDkgOC4wMUwxMiA0LjE4eiIvPjwvc3ZnPg==" alt="CodeJudge AI" />
  <br/>
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-Vanilla_JS-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Google-Gemini_AI-4285F4?style=flat-square&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenAI-GPT--4-412991?style=flat-square&logo=openai&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
</p>

# &lt;CodeJudge AI/&gt;

> **"Let's see if your project survives reality."**

An AI-powered hackathon judge simulator that analyzes real GitHub repositories and live URLs — attacks them, exposes weaknesses, generates brutal-but-useful feedback, calculates a resilience score, and ranks projects on a leaderboard with a shareable result card.

**Not a dashboard. Not a tool. A live judging experience.**

---

## 🎯 What It Does

CodeJudge AI takes a GitHub repo URL or live app URL and runs it through a **9-step judging pipeline**:

```
Submit ▶ Analyze ▶ Attack ▶ Fail ▶ Review ▶ Fix ▶ Score ▶ Rank ▶ Share
```

Each step auto-transitions to the next with smooth animations. The user experiences their project being tested, judged, and exposed in real time.

### For GitHub Repos
- Fetches **real file tree** via GitHub API
- Parses actual `package.json` for dependency analysis
- Detects **real quality signals**: test frameworks (Jest/Mocha/Vitest), CI platforms (GitHub Actions/Travis), security packages (helmet, express-rate-limit, zod), TypeScript, Docker, linting, etc.
- Analyzes commit activity, open bugs, and license status

### For Live URLs
- Makes **real HTTP requests** to probe the target
- Tests HTTPS encryption, security headers (CSP, HSTS, X-Frame-Options)
- Benchmarks response time across multiple requests
- Checks CORS policy, 404 handling, and HTTP method restrictions

---

## 🔗 Pipeline Flow

The entire UX follows a strict linear pipeline. Only one action is visible at a time. The user is always guided forward.

| Step | Screen | What Happens |
|------|--------|-------------|
| 1. **Submit** | Landing | User pastes a GitHub URL or live app URL |
| 2. **Analyze** | Processing | Real-time logs showing actual analysis steps (file tree fetching, dependency scanning, quality signal detection) |
| 3. **Attack** | Attack Grid | Each check appears one-by-one via SSE streaming with ✅/❌ status, category, and evidence |
| 4. **Fail** | Failure Report | Failed checks listed with severity, endpoint, and status codes |
| 5. **Review** | Brutal Review | AI-generated roast + reality check with specific issues from the analysis |
| 6. **Fix** | Fix & Prevent | Actionable fix steps (specific packages/tools) + system-level prevention + impact assessment |
| 7. **Score** | Resilience Score | Animated score circle (0-100) with breakdown: Stability, Error Handling, Structure |
| 8. **Rank** | Leaderboard | Ranked list of all judged projects, current user highlighted |
| 9. **Share** | Share Card | Downloadable image card with score, roast, top fix, and rank |

---

## 🏗 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Vite + Vanilla JS | Zero-framework, full CSS control, fast HMR |
| **Styling** | Pure CSS | Custom properties, dark/light themes, glassmorphism, animations |
| **Backend** | Node.js + Express | REST API with SSE streaming for real-time attack results |
| **AI Engine** | Google Gemini / OpenAI GPT-4 | Generates brutal reviews from real analysis data |
| **GitHub Data** | GitHub REST API v3 | File tree, README, package.json, languages, commits |
| **Share Card** | html2canvas | Client-side image generation for downloadable result cards |
| **Storage** | JSON file | Simple leaderboard persistence (no database needed) |

---

## 📂 Project Structure

```
CodeJudge-binary/
├── api/                        # Express backend (Vercel ready)
│   ├── index.js                # Server entry (port 3001)
│   ├── routes/
│   │   └── api.js              # API routes with SSE streaming
│   ├── services/
│   │   ├── github.js           # GitHub API: file tree, deps, quality signals
│   │   ├── chaos.js            # Real analysis engine (code + HTTP probing)
│   │   ├── ai-review.js        # Gemini / OpenAI / smart mock review
│   │   ├── scoring.js          # Weighted scoring (stability, security, structure)
│   │   └── leaderboard.js      # File-persisted leaderboard
│   └── data/
│       └── leaderboard.json    # Leaderboard storage
├── src/                        # Frontend (Vite root)
│   ├── index.html              # Single page with 9 screen sections
│   ├── main.js                 # Pipeline state machine + all screen logic
│   └── style.css               # Complete design system (650+ lines)
├── .env                        # API keys (Gemini / OpenAI)
├── .gitignore
├── package.json
└── vite.config.js              # Vite config with API proxy
```

---

## ⚙️ How It Works (Deep Dive)

### 1. GitHub Analysis Engine (`server/services/github.js`)

When a GitHub URL is submitted, the backend makes **6 parallel API calls**:

| API Call | Data Extracted |
|----------|---------------|
| `GET /repos/{owner}/{repo}` | Name, description, stars, forks, language, license |
| `GET /repos/{owner}/{repo}/readme` | Full README content (Base64 decoded) |
| `GET /repos/{owner}/{repo}/languages` | Language breakdown (bytes per language) |
| `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` | **Complete file tree** — every file in the repo |
| `GET /repos/{owner}/{repo}/contents/package.json` | Real dependencies & devDependencies |
| `GET /repos/{owner}/{repo}/commits?since=30d` | Recent commit activity |

The file tree is then analyzed for **quality signals**:

```
Quality Signal Detection:
├── Tests:     __tests__/, *.test.js, *.spec.ts → testFramework (Jest/Mocha/Vitest/Cypress)
├── CI/CD:     .github/workflows/ → GitHub Actions | .travis.yml → Travis CI
├── Docker:    Dockerfile, docker-compose.yml
├── Linting:   .eslintrc*, eslint.config.*
├── Security:  SECURITY.md, helmet, express-rate-limit, zod/joi/yup
├── TypeScript: tsconfig.json
├── Env Safety: .env.example + .gitignore
└── Standards:  CONTRIBUTING.md, CHANGELOG.md, .editorconfig, .prettierrc
```

### 2. Chaos / Analysis Engine (`server/services/chaos.js`)

**For GitHub Repos** — 10 evidence-based code checks:

| Check | What It Tests | How |
|-------|--------------|-----|
| Test Coverage | Does the project have automated tests? | Scans file tree for test files, detects framework from package.json |
| CI/CD Pipeline | Is there continuous integration? | Checks for .github/workflows, .travis.yml, etc. |
| Security Middleware | Are security headers set? | Looks for `helmet` in dependencies |
| Rate Limiting | Is there DDoS protection? | Looks for `express-rate-limit` in dependencies |
| Input Validation | Is user input sanitized? | Looks for `zod`, `joi`, `yup`, `express-validator` |
| Error Handling | Are errors caught properly? | Checks for `express-async-errors`, `http-errors` |
| Containerization | Is deployment containerized? | Checks for Dockerfile |
| Type Safety | Are types enforced? | Checks for TypeScript (tsconfig.json) |
| Env Security | Are secrets protected? | Verifies .env isn't committed, .gitignore exists |
| Dependency Health | Is the project maintained? | Checks recent commit count and dependency count |

**For Live URLs** — 10 real HTTP probes:

| Probe | What It Does |
|-------|-------------|
| Connectivity | Makes GET request, measures response time |
| HTTPS Check | Verifies TLS encryption |
| Security Headers | Checks CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| 404 Handler | Requests non-existent page, expects custom 404 |
| API Endpoints | Probes /api, /api/health, /api/status |
| Response Time | Averages 3 requests, flags >2s as slow |
| CORS Policy | Sends OPTIONS with spoofed Origin, checks `Access-Control-Allow-Origin` |
| Method Check | Sends DELETE to root, checks method filtering |

### 3. AI Review Engine (`server/services/ai-review.js`)

The review engine has **3 tiers** (tries in order):

1. **Google Gemini** (free) — `gemini-2.0-flash` via `generativelanguage.googleapis.com`
2. **OpenAI GPT-4** (paid) — via OpenAI SDK
3. **Smart Mock** — Generates contextual reviews from real analysis data

The AI prompt includes:
- Actual dependency list from package.json
- Real quality signals (test framework, CI platform, missing packages)
- Every check result with evidence
- First 3000 chars of README

Output format:
```json
{
  "roast": "One devastating witty line referencing real findings",
  "issues": ["5 specific issues with evidence from analysis"],
  "fixes": ["5 actionable fixes naming exact packages/tools"],
  "prevention": ["3 system-level improvements"],
  "impact": "Why these specific failures matter in production"
}
```

### 4. Scoring Engine (`server/services/scoring.js`)

Score = **0 to 100**, calculated from 3 weighted categories:

| Category | Weight | Based On |
|----------|--------|----------|
| **Stability** | 35% | Check pass rate (passed / total × 100) |
| **Error Handling** | 35% | Severity-weighted penalties: critical=−20, high=−12, medium=−5 |
| **Structure** | 30% | Real quality signals: tests (+15), CI (+12), Docker (+8), TypeScript (+8), linter (+7), license (+5), security policy (+5), .env.example (+5), contributing (+3), CHANGELOG (+2), etc. |

### 5. Frontend Pipeline (`src/main.js`)

The frontend is a **state machine** with 9 states. Key features:

- **SSE Streaming**: Attack results stream in real-time via `ReadableStream` API
- **Animated Transitions**: Each screen animates in with `cubic-bezier(0.16, 1, 0.3, 1)` easing
- **Diamond Progress Bar**: Pipeline nodes use `clip-path: polygon()` for diamond shapes with glow effects
- **Score Animation**: SVG ring `stroke-dashoffset` animated via `requestAnimationFrame` with ease-out cubic
- **html2canvas**: Share card rendered client-side, downloaded as PNG

---

## 🎨 Design System

### Dark Theme (Default)
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#0b0b0b` | Page background |
| `--accent` | `#39e75f` | Neon green — buttons, highlights, score |
| `--accent-glow` | `0 0 20px #39e75f55` | Glow effect on active elements |
| `--text-primary` | `#f0f0f0` | Primary text |
| `--error` | `#ff4444` | Failed checks, error borders |

### Light Theme
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#f8f9fc` | Page background |
| `--accent` | `#3b82f6` | Blue — buttons, highlights, score |
| `--text-primary` | `#1a1a2e` | Primary text |

Fonts: **Inter** (UI) + **JetBrains Mono** (code/technical data)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ installed
- (Optional) Google Gemini API key for AI reviews

### Setup

```bash
# Clone the repo
git clone https://github.com/Harshita2005-coder/CodeJudge-binary.git
cd CodeJudge-binary

# Install dependencies
npm install

# (Optional) Add your AI API key
# Open .env and add: GEMINI_API_KEY=your_key_here

# Start the dev server
npm run dev
```

Open **http://localhost:5173/** and paste any GitHub URL to start judging.

### Getting an AI API Key (Free)

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with Google
3. Click "Create API Key"
4. Paste into `.env` as `GEMINI_API_KEY=your_key`
5. Restart the server

> **Without an API key**, the app still works — the smart mock engine generates contextual reviews using real analysis data.

---

## 🔌 API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/submit` | POST | Accepts `{ url }`, returns project metadata + quality signals |
| `/api/analyze` | POST | Accepts `{ projectInfo }`, streams attack results via SSE |
| `/api/review` | POST | Accepts `{ projectInfo, attackResults }`, returns AI review + score |
| `/api/leaderboard` | GET | Returns sorted leaderboard array |
| `/api/leaderboard` | POST | Adds entry `{ name, score, roast, topFix, url }` |

### SSE Stream Format (`/api/analyze`)

```
data: {"type":"attack","result":{"id":"test-coverage","name":"Test Coverage Analysis","passed":true,"details":"..."}}

data: {"type":"attack","result":{"id":"security-headers","name":"Security Middleware Check","passed":false,"details":"..."}}

data: {"type":"complete","results":[...all results...]}
```

---

## 🧠 UX Rules

- ❌ No login required
- ❌ No complex settings
- ❌ No multi-page navigation
- ✅ One action per step
- ✅ Always guide forward
- ✅ Smooth transitions between every step
- ✅ Theme support (dark/light)

---

## 📜 License

MIT — do whatever you want with it.

---

<p align="center">
  <strong>&lt;CodeJudge AI/&gt;</strong> — Built to judge, roast, and improve.
</p>
