# AI Interview Bot

An AI-powered interview platform that generates personalized technical interview questions from a candidate's resume, evaluates answers in real-time using OpenAI, and produces a structured final report.

---

## 🏗️ Architecture

```
AI_bot/
├── backend/          ← FastAPI + PostgreSQL + OpenAI
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/      (candidate, interview)
│   │   ├── schemas/     (candidate, interview)
│   │   ├── routers/     (candidates, interviews, reports, admin)
│   │   ├── services/    (resume_parser, question_gen, evaluator, report_gen)
│   │   └── utils/       (pdf_export)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/         ← Next.js 14 + Tailwind CSS
│   ├── app/
│   │   ├── page.tsx                ← Registration page
│   │   ├── interview/page.tsx      ← Interview page
│   │   └── report/page.tsx         ← Report page
│   ├── lib/api.ts
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## ⚡ Quick Start (Docker — Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- OpenAI API key

### 1. Set up environment

```bash
cd backend
copy .env.example .env
```

Edit `backend/.env` and add your **OpenAI API key**:
```
OPENAI_API_KEY=sk-your-key-here
```

### 2. Start all services

```bash
cd AI_bot
docker-compose up --build
```

### 3. Open the app

| Service  | URL                       |
|----------|---------------------------|
| Frontend | http://localhost:3000     |
| Backend API | http://localhost:8000  |
| API Docs | http://localhost:8000/docs |

---

## 🛠️ Local Development (Without Docker)

### Backend

**Requirements:** Python 3.11+, PostgreSQL running locally

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Set up environment
copy .env.example .env
# Edit .env → set DATABASE_URL and OPENAI_API_KEY

# Run backend
uvicorn app.main:app --reload --port 8000
```

### Frontend

**Requirements:** Node.js 18+

```bash
cd frontend

# Install dependencies
npm install

# Set up environment
copy .env.local.example .env.local   # or edit .env.local directly

# Run frontend
npm run dev
```

Frontend runs at **http://localhost:3000**

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL async URL | `postgresql+asyncpg://postgres:postgres@localhost:5432/ai_interview` |
| `OPENAI_API_KEY` | OpenAI secret key | `sk-...` |
| `OPENAI_MODEL` | GPT model to use | `gpt-4o-mini` |
| `UPLOAD_DIR` | Resume upload folder | `uploads` |
| `MAX_FILE_SIZE_MB` | Max resume size | `10` |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g. `http://localhost:8000`) |

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/candidates/register` | Upload resume, register candidate |
| `GET` | `/api/candidates/{id}/status` | Poll question generation status |
| `GET` | `/api/interviews/{id}/questions` | Get all generated questions |
| `POST` | `/api/interviews/{id}/answer` | Submit answer → get evaluation |
| `GET` | `/api/reports/{id}` | Generate/get final report |
| `GET` | `/api/reports/{id}/pdf` | Download report as PDF |
| `GET` | `/api/admin/candidates` | List all candidates (admin) |
| `GET` | `/health` | Health check |

Full interactive docs: **http://localhost:8000/docs**

---

## 🎯 Interview Flow

```
Registration Page
    ↓ (upload resume → form submit)
Loading Screen
    ↓ (backend parses resume, generates 12 questions via OpenAI)
Interview Page  ← one question at a time, 90s timer
    ↓ (submit each answer → OpenAI evaluates in real-time)
Report Page
    ↓
PDF Download
```

---

## 📊 Question Types (12 total)

| Type | Count | Description |
|------|-------|-------------|
| Technical | 5 | Skills and tools from resume |
| Project Deep-Dive | 3 | Specific projects listed |
| Behavioral | 2 | Work history and situations |
| Logical/Problem Solving | 2 | Relevant to their tech stack |

---

## 📋 Database Schema

```sql
-- candidates
id, name, mobile, position, resume_path, resume_text,
total_score, report_json, status, created_at, updated_at

-- interviews
id, candidate_id (FK), question_order, question_type,
question, answer, technical_score, clarity_score,
depth_score, communication_score, feedback, created_at
```

---

## ✅ Production Checklist

- [ ] Set strong `POSTGRES_PASSWORD` in docker-compose
- [ ] Set real `OPENAI_API_KEY`
- [ ] Set `NEXT_PUBLIC_API_URL` to your domain in frontend
- [ ] Use a reverse proxy (nginx) in front of both services
- [ ] Enable HTTPS (Let's Encrypt / Certbot)
- [ ] Set up regular database backups
- [ ] Add rate limiting to the API
