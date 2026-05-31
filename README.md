# AI Interview Bot

> 🤖 A production-ready AI-powered interview platform with resume parsing, OTP verification, real-time question generation, anti-cheat monitoring, and detailed performance reports.

---

## 🚀 Live Demo

- **Frontend:** [Deployed on Vercel]
- **Backend:** [Deployed on Render]

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind/Vanilla CSS |
| Backend | FastAPI, Python 3.11 |
| Database | SQLite (aiosqlite) |
| AI | Google Gemini 2.5 Flash |
| Email | Gmail SMTP |
| Auth | OTP Verification (Email) |

---

## ✨ Features

- 📄 Resume upload & AI parsing (PDF/DOCX)
- 🔐 Multi-factor OTP verification (Email)
- 🤖 Dynamic AI question generation (role-specific)
- 🎯 Stage-based interview flow (Greeting → Experience → Scenario → Project → Technical → Behavioral)
- 🕐 Time-aware greeting (Good Morning / Afternoon / Evening)
- 🎙️ Voice Mode (Record & transcribe answers)
- 📊 Live scoring per answer (Technical, Clarity, Depth, Communication)
- ⏩ Auto-advance to next question
- 🚨 Anti-cheat monitoring (tab-switch + copy-paste detection)
- 📈 Final report with Upskilling Resources
- 📧 Beautiful HTML email notifications

---

## 🔧 Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # Mac/Linux

pip install -r requirements.txt
cp .env.example .env       # Fill in your keys
uvicorn app.main:app --reload
# Runs on http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
# Create .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
# Runs on http://localhost:3000
```

---

## 🌍 Deploy to Production (Free)

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ai-interview-bot.git
git push -u origin main
```

### Step 2 — Deploy Backend on Render (Free)
1. Go to [https://render.com](https://render.com) → Sign up
2. Click **New → Web Service**
3. Connect your GitHub repo → Select the **`backend`** folder as Root Directory
4. Set:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Runtime:** Python 3.11
5. Add Environment Variables:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   MAIL_USERNAME=Ashutoshbariofficial@gmail.com
   MAIL_PASSWORD=enzkuvdcqfosykib
   MAIL_FROM=Ashutoshbariofficial@gmail.com
   MAIL_SERVER=smtp.gmail.com
   MAIL_PORT=587
   DATABASE_URL=sqlite+aiosqlite:///./ai_interview.db
   FRONTEND_URL=https://your-app.vercel.app
   ```
6. Click **Create Web Service**
7. Copy your backend URL (e.g. `https://ai-interview-bot.onrender.com`)

### Step 3 — Deploy Frontend on Vercel (Free)
1. Go to [https://vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **Add New → Project**
3. Import your GitHub repo → Set **Root Directory** to `frontend`
4. Add Environment Variable:
   ```
   NEXT_PUBLIC_API_URL=https://ai-interview-bot.onrender.com
   ```
5. Click **Deploy**
6. Your app is live at `https://your-app.vercel.app` 🎉

### Step 4 — Update CORS on Backend
Go back to Render → Environment Variables → Add:
```
FRONTEND_URL=https://your-app.vercel.app
```
Then click **Manual Deploy → Deploy Latest Commit**

---

## 🔑 Environment Variables Reference

### Backend (.env)
| Variable | Description | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | ✅ |
| `MAIL_USERNAME` | Gmail address for sending emails | ✅ |
| `MAIL_PASSWORD` | Gmail App Password (16-char) | ✅ |
| `MAIL_FROM` | Sender email (same as username) | ✅ |
| `FRONTEND_URL` | Vercel frontend URL for CORS | ✅ (prod) |
| `TWILIO_ACCOUNT_SID` | Twilio SID for SMS OTP | Optional |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | Optional |
| `TWILIO_FROM_NUMBER` | Twilio phone number | Optional |

### Frontend (.env.local)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (localhost or Render URL) |

---

## 📁 Project Structure

```
AI_bot/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy models
│   │   ├── routers/         # API endpoints
│   │   ├── services/        # AI, OTP, Email logic
│   │   ├── schemas/         # Pydantic schemas
│   │   └── main.py          # FastAPI app entry point
│   ├── requirements.txt
│   ├── render.yaml          # Render deployment config
│   └── .env                 # Local environment variables
└── frontend/
    ├── app/
    │   ├── page.tsx          # Registration
    │   ├── verify/           # OTP verification
    │   ├── interview/        # Interview session
    │   └── report/           # Final report
    ├── vercel.json           # Vercel deployment config
    └── .env.local            # Local environment variables
```

---

## 📄 License
MIT © Ashutosh Bari
