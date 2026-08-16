# ASHVANCE TECH — Smart Interview AI

> 🚀 **Intelligent Hiring. Smarter Interviews.**  
> Official Enterprise AI Candidate Assessment, Adaptive Voice Interviewing & Real-time Scorecard Platform by **ASHVANCE TECH**.

[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)](https://frontend-nine-tau-65.vercel.app/)

---

## 🌟 Overview & Brand Identity

**ASHVANCE TECH presents Smart Interview AI** — an autonomous hiring and technical evaluation platform. Candidates receive a secure, one-click invitation link, complete an identity-verified technical voice interview, and receive a multi-dimensional assessment report with PDF export.

### Key Highlights
- 🔐 **Public Secure Deep Links**: Tokenized invitation links (`/interview/[token]` and `/report/[token]`) obfuscate candidate database IDs and enforce expiration guards.
- 📱 **Mobile-First Responsive UX**: Dedicated mobile navigation drawer, safe-area inset management (`env(safe-area-inset-bottom)`), notch/dynamic island compatibility, and 48px+ touch targets on iOS Safari and Android Chrome.
- 🎙️ **Autonomous Conversational Voice Loop**: Zero-click turn-taking: AI speaks question via TTS → Speech recognition auto-listens → 2.4s natural silence auto-submits → AI evaluates and delivers follow-up.
- 🛑 **Real-time Interruption / Barge-in**: Candidate speech immediately halts AI audio playback to ensure a natural interview cadence.
- 🌓 **Dual Luxury Theme Engine**: Persistent Dark Mode (*Deep Navy / Midnight / Electric Cyan*) and Light Mode (*Soft White / Cool Navy / High-contrast Blue*).
- 📊 **Executive Assessment PDF**: ReportLab generated corporate PDF reports with official ASHVANCE TECH branding, composite score gauges, strength analysis, and upskilling roadmaps.
- 📨 **Corporate Email Automation**: Exactly two strict, non-spam automated email pipelines (OTP verification and Executive Assessment with PDF attachment).

---

## 🏗️ Production Architecture

```text
  Candidate (Mobile / Desktop)
              │
              ▼
   Vercel Frontend (Next.js 14)
   [https://frontend-nine-tau-65.vercel.app]
              │
              ▼ (CORS Authenticated / REST API)
   Production Backend (FastAPI / Uvicorn)
              │
    ┌─────────┼─────────────────────┐
    │         │                     │
    ▼         ▼                     ▼
AI Engine   SQLite / Postgres    STT / TTS
(Gemini /   (Async SQLAlchemy)  (Voice Pipeline)
 Ollama)
    │
    ▼
ReportLab PDF Generation ➔ SMTP Email Automation (PDF Attached)
```

---

## 📋 Interview State Machine

The interview orchestrator enforces a 7-stage state machine:

1. **`greeting`** — Introduction, role calibration, and welcome.
2. **`background`** — Candidate journey, core stack, and project highlights.
3. **`project_deep_dive`** — Architecture breakdown and production challenges.
4. **`technical`** — Core computer science concepts, distributed systems, and coding patterns.
5. **`problem_solving`** — Real-time engineering trade-offs, debugging, and failover design.
6. **`behavioral`** — Cross-functional leadership, sprint deadlines, and conflict resolution.
7. **`candidate_questions`** — Candidate closing inquiries and next steps.

---

## 🚀 Live Demo & Deployments

- **Production Frontend (Vercel):** [https://frontend-nine-tau-65.vercel.app](https://frontend-nine-tau-65.vercel.app)
- **GitHub Repository:** [ashutoshbari/AI-Interview-Bot](https://github.com/ashutoshbari/AI-Interview-Bot)

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js**: v18.17+ or v20+
- **Python**: v3.11+
- **Git**

### 1. Clone Repository
```bash
git clone https://github.com/ashutoshbari/AI-Interview-Bot.git
cd AI-Interview-Bot
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
# source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Run FastAPI dev server
uvicorn app.main:app --reload --port 8000
```
Backend API docs available at: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)
| Variable | Description | Required | Example |
|---|---|---|---|
| `GEMINI_API_KEY` | Google Gemini AI API key | Yes | `AIzaSy...` |
| `DATABASE_URL` | Async SQLAlchemy Database URL | Yes | `sqlite+aiosqlite:///./ai_interview.db` |
| `MAIL_USERNAME` | SMTP sender username | Yes | `recruitment@ashvance.tech` |
| `MAIL_PASSWORD` | SMTP app password | Yes | `your_16_char_app_password` |
| `MAIL_FROM` | Sender address | Yes | `recruitment@ashvance.tech` |
| `MAIL_SERVER` | SMTP host | Yes | `smtp.gmail.com` |
| `MAIL_PORT` | SMTP port | Yes | `587` |
| `FRONTEND_URL` | Allowed CORS origins (comma-separated) | Yes (prod) | `https://frontend-nine-tau-65.vercel.app` |

### Frontend (`frontend/.env.local`)
| Variable | Description | Default (Local) |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Production Backend API Endpoint | `http://127.0.0.1:8000` |

---

## 📱 Mobile-First Testing Matrix

| Platform | Browser | Tested Capabilities | Status |
|---|---|---|---|
| **iOS** (iPhone 14/15) | Safari | Mobile Drawer, Dynamic Island, SpeechRecognition, PDF Open | ✅ Passed |
| **iOS** (iPhone) | Chrome | Viewport scaling, Touch targets, Dark/Light switch | ✅ Passed |
| **Android** | Chrome | Continuous STT, Hands-free turn-taking, Responsive gauges | ✅ Passed |
| **Android** | Samsung Internet | OTP auto-advance, Audio synthesis, PDF streaming | ✅ Passed |
| **Desktop** | Chrome / Edge | Full 1440px multi-column studio, Proctoring monitor | ✅ Passed |

---

## 📄 License & Copyright

© ASHVANCE TECH. All rights reserved.  
Smart Interview AI is a trademark of ASHVANCE TECH.
