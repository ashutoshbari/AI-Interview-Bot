# 🚀 AI Interview Bot (v2.0) - Local & Hybrid AI

A production-grade AI-powered interview platform that generates personalized technical interviews from candidate resumes, evaluates responses in real-time, and provides automated feedback via email.

---

## 🌟 Key Features

- **🧠 Local AI Inference**: Integrated with **Ollama (llama3)** to run the entire backend for free on your local machine.
- **🛡️ Hybrid Fallback**: Automatically switches to **Google Gemini** if your local AI service is offline, ensuring 100% uptime.
- **📧 Automated Email System**: Syncs candidate progress with beautifully formatted HTML emails for registration, interview completion (score & feedback), and reminders.
- **📈 Real-time Status Tracking**: Monitor interview lifecycles with statuses: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, and `FAILED`.
- **✍️ Voice & Text**: Supports real-time transcription for a natural chat+voice interview experience.
- **📊 Precise Reporting**: Generates detailed PDF reports with technical, clarity, and communication scores.

---

## 🏗️ Technical Architecture

### **Backend: FastAPI (Python)**
- **Async Processing**: Fast performance with background task handling for emails and AI evaluations.
- **Database**: SQLite (default) for zero-config portable storage.
- **Inference Engines**: Ollama (Primary) / Google Gemini (Fallback).
- **Communication**: SMTP/Gmail/SendGrid for automated notifications.

### **Frontend: Next.js (React)**
- **Tailwind CSS**: Modern, premium dark-mode aesthetics.
- **Framer Motion**: Smooth micro-animations and transitions.
- **Real-time UI**: Dynamic loading states and status tracking.

---

## 🛠️ Setup Instructions

### 1. Requirements
- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com) (Optional but recommended for free local AI)

### 2. Configure Local AI (Ollama)
Install Ollama and pull the Llama3 model:
```bash
ollama run llama3
```

### 3. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `/backend`:
```env
# AI Providers
GEMINI_API_KEY=your_key_here
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Email (SMTP)
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_FROM=your_email@gmail.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📡 API Reference & Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/candidates/register` | Register & start (Status: `NOT_STARTED`) |
| `GET`  | `/api/interviews/questions` | Fetch questions (Status -> `IN_PROGRESS`) |
| `GET`  | `/api/reports/{id}` | Finalize & score (Status -> `COMPLETED`) |
| `POST` | `/api/admin/mark-failed/{id}` | Mark as stagnant (Status -> `FAILED`) |

---

## 🎯 Automated Email Workflows

1. **Registration**: Dynamic "Welcome" email sent upon resume upload.
2. **Completion**: Professional Results email sent including:
    - Overall Score (0-10)
    - Detailed Technical Feedback
    - Key Improvement Suggestions
3. **Reminders**: Admin-triggered reminders for incomplete interviews.

---

## ✅ Deployment Checklist

- [x] Run `ollama run llama3` for free inference.
- [x] Configure SMTP in `.env` for email automation.
- [x] Set `GEMINI_API_KEY` for 100% uptime fallback.
- [x] Check backend logs for real-time status tracking updates.

---

Developed with ❤️ using FastAPI, Next.js, and local Llama3.
