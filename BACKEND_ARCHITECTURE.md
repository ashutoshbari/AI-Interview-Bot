# 🏗️ Backend Architecture — AI Interview Bot v2.0

> Production-ready FastAPI backend for the AI Interview Practice Platform.

---

## 📁 Project Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI app entry point, CORS, routers
│   ├── config.py                  # Pydantic Settings (env vars)
│   ├── database.py                # SQLAlchemy async engine + Base
│   ├── models/
│   │   ├── candidate.py           # Candidate DB model
│   │   ├── interview.py           # Interview Q&A DB model
│   │   └── otp_verification.py    # OTP session model
│   ├── routers/
│   │   ├── candidates.py          # Registration, OTP, profile
│   │   ├── interviews.py          # ★ Core interview flow (FIXED)
│   │   ├── reports.py             # Report generation + PDF
│   │   └── admin.py               # Admin panel routes
│   ├── schemas/
│   │   └── interview.py           # Pydantic request/response models
│   ├── services/
│   │   ├── evaluator.py           # AI answer evaluation
│   │   ├── question_gen.py        # Dynamic question generation
│   │   ├── report_gen.py          # ★ Enhanced final report (UPDATED)
│   │   ├── transcriber.py         # Audio → text (Gemini backend)
│   │   ├── tts_service.py         # ★ NEW: Text → female voice MP3
│   │   ├── resume_parser.py       # PDF/DOCX → text
│   │   ├── email_service.py       # SMTP email notifications
│   │   ├── otp_service.py         # OTP generation + delivery
│   │   └── health_check.py        # AI provider connectivity test
│   └── utils/
│       ├── ai_utils.py            # OpenAI/Gemini safe call wrapper
│       └── pdf_export.py          # ReportLab PDF generation
├── requirements.txt
├── .env                           # Environment config
└── Dockerfile
```

---

## 🔌 API Reference

### Base URL
- **Development**: `http://localhost:8000`
- **Production**: `https://your-app.onrender.com`

---

### 👤 Candidates

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/candidates/register` | Register + upload resume |
| `GET` | `/api/candidates/{id}` | Get candidate profile |
| `POST` | `/api/candidates/{id}/send-otp` | Send OTP to email + SMS |
| `POST` | `/api/candidates/{id}/verify-otp` | Verify 6-digit OTP |

**Register (FormData)**:
```
name: string
email: string
mobile: string
position: string
resume: File (PDF/DOCX, max 10MB)
```

**Response**:
```json
{ "id": 42, "name": "Jane Smith", "status": "NOT_STARTED" }
```

---

### 🎙️ Interviews — Core Flow

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/interviews/{id}/questions` | Get current active question |
| `POST` | `/api/interviews/{id}/answer` | Submit answer, get next question |
| `GET` | `/api/interviews/{id}/next-question` | **NEW** Fallback polling for next Q |
| `POST` | `/api/interviews/{id}/clarify` | Two-way AI conversation |
| `POST` | `/api/interviews/{id}/finish` | **Submit & complete interview** |
| `GET` | `/api/interviews/{id}/suggestions` | **NEW** AI coaching suggestions |
| `POST` | `/api/interviews/tts` | **NEW** Text → female voice MP3 |
| `POST` | `/api/interviews/transcribe` | Audio file → text (fallback) |
| `GET` | `/api/interviews/{id}/records` | Full Q&A transcript |

#### POST `/api/interviews/{id}/answer`
**Request**:
```json
{ "question_order": 3, "answer": "I would approach this by..." }
```
**Response**:
```json
{
  "technical_score": 8.2,
  "clarity_score": 7.8,
  "depth_score": 7.5,
  "communication_score": 8.0,
  "feedback": "Good technical coverage. Add concrete examples.",
  "next_question": {
    "question_order": 4,
    "question_type": "technical",
    "stage": "technical",
    "question": "How would you handle race conditions in..."
  },
  "interview_complete": false
}
```
> **Critical Fix**: `next_question` is always returned in-response. No page refresh needed.

#### POST `/api/interviews/tts`
**Request**:
```json
{ "text": "Could you walk me through your experience with distributed systems?" }
```
**Response**: `audio/mpeg` binary stream (play directly in browser)

**Frontend implementation**:
```typescript
const playTTS = async (text: string) => {
  try {
    const res = await fetch(`${API_BASE}/api/interviews/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('TTS unavailable');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  } catch {
    // Fallback: Web Speech API with female voice
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.15;
    utterance.rate = 0.92;
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find(v =>
      v.name.includes('Samantha') || v.name.includes('Karen') ||
      v.name.includes('Victoria') || v.lang === 'en-GB'
    ) || voices[0];
    speechSynthesis.speak(utterance);
  }
};
```

#### GET `/api/interviews/{id}/suggestions`
**Response**:
```json
{
  "overall_score": 78.5,
  "verdict": "Hire",
  "verdict_reason": "Jane showed strong technical depth with solid communication skills.",
  "top_strengths": [
    { "title": "System Design", "detail": "Correctly identified CAP theorem tradeoffs in Q5" }
  ],
  "growth_areas": [
    { "title": "Testing Strategy", "detail": "Lacked concrete methodology for unit vs integration testing" }
  ],
  "quick_wins": ["Use STAR format", "Add metrics to answers", "Practice pacing"],
  "coaching_roadmap": [
    {
      "week": "Week 1-2",
      "focus": "System Design",
      "action": "Study CAP theorem, DB sharding, caching patterns",
      "resource": "Designing Data-Intensive Applications — Martin Kleppmann"
    }
  ],
  "interview_style_tips": [
    "Structure answers: Problem → Approach → Trade-offs → Result",
    "Use concrete numbers (e.g., '40% latency reduction')",
    "Pause and think aloud before diving into answer"
  ],
  "encouragement": "Excellent effort Jane! Your technical foundation is solid — keep refining and you'll ace the real interview."
}
```

---

### 📊 Reports

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/reports/{id}` | Generate/retrieve full scorecard |
| `GET` | `/api/reports/{id}/pdf` | Download PDF report |

---

## 🔄 Interview State Machine

```
                    POST /register
                         ↓
                   [NOT_STARTED]
                         ↓
              GET /questions (1st call)
                         ↓
                   [IN_PROGRESS]
                    ↙         ↘
          Answer Q1..N         POST /finish (manual)
          POST /answer               ↓
               ↓               [COMPLETED]
          next_question              ↓
          in response           GET /report
               ↓            GET /suggestions
       len(history) >= 15
               ↓
         interview_complete=true
               ↓
           [COMPLETED]
```

---

## 🧠 AI Provider Chain

All AI calls go through `openai_safe_call()` in `utils/ai_utils.py`:

```
Request
  → GeminiProvider (primary, free tier)
  → OpenAIProvider (fallback if key configured)
  → MockProvider   (graceful offline fallback)
```

**Services using AI**:

| Service | Model | Purpose |
|---------|-------|---------|
| `question_gen.py` | Gemini 2.5 Flash | Generate next adaptive question |
| `evaluator.py` | Gemini 2.5 Flash | Score + feedback per answer |
| `report_gen.py` | Gemini 2.5 Flash | Final scorecard generation |
| `interviews.py` (clarify) | Gemini 2.5 Flash | Two-way conversation |
| `interviews.py` (suggestions) | Gemini 2.5 Flash | Coaching roadmap |
| `transcriber.py` | Gemini 2.5 Flash | Audio → text (backend fallback) |
| `tts_service.py` | gTTS + Gemini | Text → female voice MP3 |

---

## 🎙️ Voice Architecture

### TTS (Text-to-Speech) — Female Voice
```
Frontend clicks "Play Voice"
         ↓
POST /api/interviews/tts { text }
         ↓
tts_service.py → gTTS(lang='en', tld='co.uk')
                        ↓ (British English = sweet female tone)
              Returns MP3 bytes
                        ↓
Frontend: new Audio(blob_url).play()
                        ↓ (if TTS fails)
Fallback: speechSynthesis API
          pitch=1.15, rate=0.92
          voice: Samantha/Karen/Victoria/en-GB
```

### STT (Speech-to-Text) — Real-time Transcription
```
User clicks mic → SpeechRecognition API starts
                         ↓
         interimResults=true → words appear live
                         ↓
         User says "Stop" → final transcript ready
                         ↓
         User clicks "Submit Answer"
                         ↓
         POST /api/interviews/{id}/answer

(Fallback for Firefox/Safari)
         User records → MediaRecorder blob
                         ↓
         POST /api/interviews/transcribe (FormData audio)
                         ↓
         transcriber.py → Gemini multimodal → text
```

---

## 🗄️ Database Schema

### `candidates` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `name` | VARCHAR(255) | Candidate full name |
| `email` | VARCHAR(255) | Email for OTP + notifications |
| `mobile` | VARCHAR(20) | Phone for SMS OTP |
| `position` | VARCHAR(255) | Target role |
| `resume_path` | VARCHAR(500) | Uploaded file path |
| `resume_text` | TEXT | Extracted raw text |
| `resume_summary` | TEXT | AI-condensed JSON summary |
| `status` | VARCHAR(50) | NOT_STARTED / IN_PROGRESS / COMPLETED |
| `current_stage` | VARCHAR(50) | greeting / technical / behavioral… |
| `is_verified` | BOOLEAN | OTP verified flag |
| `total_score` | FLOAT | Final aggregate score |
| `report_json` | TEXT | Cached report JSON |
| `interview_start_time` | DATETIME | When interview started |
| `interview_end_time` | DATETIME | When interview ended |
| `tab_switch_count` | INTEGER | Anti-cheat: tab switches |
| `copy_paste_count` | INTEGER | Anti-cheat: paste attempts |

### `interviews` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `candidate_id` | INTEGER FK | → candidates.id |
| `question_order` | INTEGER | 1, 2, 3… |
| `question_type` | VARCHAR(50) | introduction/technical/behavioral… |
| `stage` | VARCHAR(50) | greeting/experience/technical… |
| `question` | TEXT | AI-generated question text |
| `answer` | TEXT | Candidate's answer (nullable = unanswered) |
| `technical_score` | FLOAT | 0-10 |
| `clarity_score` | FLOAT | 0-10 |
| `depth_score` | FLOAT | 0-10 |
| `communication_score` | FLOAT | 0-10 |
| `feedback` | TEXT | AI feedback per answer |
| `created_at` | DATETIME | Timestamp |

---

## 📧 Email Notifications

Events that trigger emails:

| Event | Recipient | Content |
|-------|-----------|---------|
| Registration | Candidate | Welcome + OTP code |
| Interview Started | Interviewer (HR) | Alert with name + position |
| Interview Completed | Candidate | Completion notice + score |
| Interview Completed | Interviewer (HR) | Alert with score + recommendation |
| Report Ready | Candidate | Full report summary |

Configure in `.env`:
```env
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=your_app_password    # Gmail App Password (not real password)
MAIL_FROM=your@gmail.com
INTERVIEWER_EMAIL=hr@company.com
```

---

## 🚀 Production Deployment (Render)

### 1. Push to GitHub

### 2. Create Render Web Service
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Root Directory**: `backend/`

### 3. Environment Variables on Render
```
DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key  (optional)
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=your_app_password
INTERVIEWER_EMAIL=hr@company.com
FRONTEND_URL=https://your-lovable-app.lovable.app
```

### 4. PostgreSQL (Render Free Tier)
Add Render PostgreSQL instance. Copy connection string → `DATABASE_URL`.

### 5. Frontend (Lovable)
Set in Lovable environment:
```
VITE_API_BASE=https://your-app.onrender.com
```

---

## 🔒 Security

- **OTP Verification**: All interview endpoints require `is_verified=True`
- **File Validation**: Resume upload checks MIME type + file extension + size limit
- **Anti-Cheat**: Tab switch and copy-paste counts tracked (via frontend events)
- **CORS**: Configured per `FRONTEND_URL` env var in production
- **Input Sanitization**: All text inputs truncated before AI prompt injection
- **Rate Limiting**: OTP resend has 60-second cooldown

---

## 🧪 Running Locally

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Health check: [http://localhost:8000/health](http://localhost:8000/health)
