# ⚖️ CodeJudge AI — Automated Code Evaluation & Online Judge Platform

[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/)
[![Express](https://img.shields.io/badge/Backend-Express%20Node-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> [!NOTE]
> **Fork Notice:** This repository is a fork of `harshita-agarwal05/CodeJudge-binary` maintained and enhanced by [@Tarunjit45](https://github.com/Tarunjit45).

**CodeJudge AI** is an automated code execution, test-case verification, and algorithmic assessment platform. Featuring an in-browser code editor, real-time code evaluation API, automated test-case runner, and leaderboard tracking.

---

## ✨ Features

* 💻 **Multi-Language Execution API:** Evaluates user-submitted algorithms against hidden edge-case test suites.
* ⏱️ **Time & Memory Limit Enforcement:** Detects infinite loops, segmentation faults, and memory limits.
* 📊 **Automated Score Calculation:** Itemized test passing rates and runtime benchmarks.
* 🚀 **Full-Stack Concurrent Dev:** Pre-configured `concurrently` script running Vite client and Express server simultaneously.

---

## 📁 Repository Structure

```text
CodeJudge-binary/
├── api/                # Express backend & code execution runner
├── src/                # Vite React client (Code Editor, Problem View, Output Console)
├── test-db.js          # Test case database verification script
├── upload-db.js        # Problem & solution seeding utility
├── package.json        # Concurrent scripts & dependencies
├── vercel.json         # Deployment configuration
├── LICENSE             # MIT License
└── README.md
```

---

## 🚀 Quick Start

### 1. Installation
```bash
git clone https://github.com/Tarunjit45/CodeJudge-binary.git
cd CodeJudge-binary

npm install
```

### 2. Launch Development Servers
```bash
npm run dev
```

Runs client at [http://localhost:5173](http://localhost:5173) and API server at [http://localhost:5000](http://localhost:5000).

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
