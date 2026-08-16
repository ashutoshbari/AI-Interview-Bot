# 🎨 Lovable AI Master UI Prompt — AI Interview Practice Platform v2.0

> **Instructions:** Copy the entire prompt below and paste it into [Lovable AI](https://lovable.dev) to generate the complete, production-ready frontend.

---

```markdown
# 🎯 Project: AI Interview Practice Platform

## Role & Mission
Build an ultra-premium, ultra-modern **AI Interview Practice Platform** — like practicing your job interview with a world-class senior female interviewer from Google or Meta. This is NOT a basic CRUD app. It must feel like a top-tier SaaS product that would cost $99/month.

Design philosophy: **Dark luxury + glassmorphism + micro-animations + voice-first interaction**

---

## 🎨 Visual Design System

### Color Palette
```
--bg-void: #060614
--bg-surface: #0d0d26
--bg-card: rgba(20, 20, 48, 0.72)
--border-glow: rgba(99, 102, 241, 0.25)
--primary: #4f46e5
--primary-glow: #7c3aed
--accent-cyan: #06b6d4
--accent-emerald: #10b981
--accent-amber: #f59e0b
--accent-rose: #f43f5e
--text-primary: #f1f5f9
--text-secondary: #94a3b8
--text-muted: #475569
```

### Typography (import from Google Fonts)
- **UI Font**: `Plus Jakarta Sans` (weights: 400, 500, 600, 700, 800)
- **Mono/Code Font**: `JetBrains Mono` (for scores, timers, Q numbers)
- **Display**: `Inter` for hero headings

### Card/Panel Style
```css
background: rgba(20, 20, 48, 0.72);
backdrop-filter: blur(20px);
border: 1px solid rgba(99, 102, 241, 0.2);
border-radius: 20px;
box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
```

### Animation Tokens
- Transition: `all 0.25s cubic-bezier(0.4, 0, 0.2, 1)`
- Hover lift: `transform: translateY(-2px)` + stronger glow shadow
- Glow pulse: `box-shadow: 0 0 20px rgba(79,70,229,0.6)`

---

## 📦 Tech Stack
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS + custom CSS variables above
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **State**: React Context + useState/useEffect
- **API**: Native fetch with custom hooks
- **Voice**: Web Speech API (SpeechSynthesis + SpeechRecognition — built into browser, zero libraries needed)

---

## 🧭 Page Architecture — 4 Screens

---

## SCREEN 1: Landing & Registration (`/`)

### Hero Section
- **Full viewport dark background** with animated radial gradient pulsing slowly (indigo → purple → void)
- **Floating particles** (20-30 tiny dots drifting upward, 5% opacity — subtle)
- **Badge** top center: `🟢 AI Neural Interviewer 2.0 · Live`  (pill shape, emerald dot pulsing)
- **H1**: "Master Your Interview. Land Your Dream Job." — gradient text (indigo → cyan)
- **Subheadline**: "Practice with an AI interviewer that thinks like Google's hiring committee. Real questions, real feedback, real growth."
- **3 Feature Pills** in a row: `🎙️ Voice AI Interview` · `⚡ Instant Feedback` · `📊 Personalized Report`

### Stepper Progress Banner
Show a 4-step progress indicator, always visible, step 1 active:
```
[1 Upload Resume] → [2 Verify Identity] → [3 AI Interview] → [4 Your Report]
```
Active step: indigo filled circle. Completed: emerald check. Future: muted outline.

### Registration Form Card (glassmorphic)
```
┌─────────────────────────────────────┐
│  🤖 Start Your AI Interview         │
│                                     │
│  Full Name          [____________]  │
│  Email Address      [____________]  │
│  Mobile Number      [____________]  │
│                                     │
│  Target Role:                       │
│  [Software Eng] [Frontend] [Backend]│
│  [Data Science] [DevOps]  [Mobile] │
│  [Custom Role ___________________]  │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  📎 Drop your resume here    │   │
│  │  PDF, DOC, DOCX · Max 10MB  │   │
│  │  [Browse Files]              │   │
│  └──────────────────────────────┘   │
│  ✅ resume_john_doe.pdf (142 KB)    │
│                                     │
│  [🚀 Begin AI Interview →]         │
└─────────────────────────────────────┘
```

**Role Selector**: Pill/chip buttons that glow indigo when selected. Clicking one fills the position field. "Custom Role" chip shows an inline text input.

**Resume Drop Zone**: 
- Dashed border, dashes animate on hover
- File drop changes to solid emerald border + checkmark + filename + size
- Error state: rose border + shake animation for wrong file type

**Submit Button**: 
- Full width, gradient indigo→purple, rounded-xl
- Loading state: spinner + "Analyzing your resume..."
- Hover: lift + glow pulse

### Feature Showcase (below form)
3 glassmorphic cards in a row:
1. **🎙️ Sweet Voice AI** — "Our AI interviewer speaks with a natural, warm voice. Like talking to a real senior engineer."
2. **🧠 Adaptive Intelligence** — "Questions adapt to your answers in real-time. Weak answer? She probes deeper. Strong? She challenges harder."
3. **📊 Instant Scorecard** — "Receive a hiring-grade scorecard with strengths, growth areas, and a personalized 4-week roadmap."

---

## SCREEN 2: Identity Verification (`/verify?id={candidateId}`)

### Layout
Centered card, same dark background with subtle indigo gradient sphere behind it.

### OTP Card (glassmorphic)
```
┌──────────────────────────────────────┐
│  🔐 Verify Your Identity             │
│                                      │
│  We sent a 6-digit code to           │
│  john@example.com & +91-98XXXXXXXX  │
│                                      │
│  [_] [_] [_]  [_] [_] [_]          │
│   ↑ Individual glowing input boxes   │
│                                      │
│  ⏱️ Resend in 0:45  [○○○○○○○○○○]   │
│       circular countdown ring        │
│                                      │
│  [⚡ Test Mode: Auto-fill 123456]   │
│                                      │
│  [✓ Verify & Start Interview →]     │
└──────────────────────────────────────┘
```

**6-Digit OTP Inputs**:
- 6 separate `<input maxLength={1}>` boxes (NOT one input)
- Auto-advance on type: typing digit in box 1 → cursor jumps to box 2
- Backspace: clears current, moves back to previous
- Paste support: pasting "123456" fills all 6 at once
- Focus state: `border: 1px solid #4f46e5; box-shadow: 0 0 12px rgba(79,70,229,0.5)`
- Correct: all turn emerald + checkmark animation
- Wrong: all shake left-right + turn rose

**Circular Countdown**:
- SVG circle, `stroke-dasharray` animating from full to empty over 60s
- When 0: "Resend Code" button appears with indigo glow

**Test Mode Button**: 
- Subtle ghost button (not prominent)
- Clicking fills all 6 boxes with `1,2,3,4,5,6` with a satisfying sequential animation

---

## SCREEN 3: AI Interview Room (`/interview?id={candidateId}`)

> This is the CORE screen. Make it feel like a professional video call studio.

### Layout Structure
```
┌────────────── TOP BAR ───────────────────┐
│ 🤖 AI Interview  |  Jane Smith  |  ⏱     │
│ [Greeting]→[Experience]→[Technical]→...  │
│ Progress: ████████░░░░ Q4 of 12          │
└──────────────────────────────────────────┘

┌───── LEFT: AI INTERVIEWER ────┐  ┌── RIGHT: CANDIDATE ──┐
│                               │  │                       │
│  [🤖 AI Avatar — animated     │  │  [🎤 Mic orb or       │
│   waveform bars when          │  │   text area]          │
│   speaking]                   │  │                       │
│                               │  │  📝 Transcription     │
│  "Question text here..."      │  │  preview (live)       │
│                               │  │                       │
│  [🔊 Play Voice]              │  │  [⏹ Stop] [✓ Submit]  │
│  [💬 Ask AI]                  │  │                       │
└───────────────────────────────┘  └───────────────────────┘

┌────────── FEEDBACK CARD (appears after submitting) ────────┐
│  Technical: ████████░░ 8.2   Clarity: ███████░░░ 7.1      │
│  Depth:     ████████░░ 7.8   Communication: ████████░ 8.0  │
│  💬 "Good technical coverage. Try adding a concrete example│
│       from a real project to strengthen the answer."       │
│  [→ Next Question] or [auto-advance in 4s ●●●●]           │
└─────────────────────────────────────────────────────────────┘
```

### Top Progress Bar
- Candidate name (left), stage chips in middle (active = indigo filled), timer (right)
- Stage chips: `Greeting` → `Experience` → `Scenario` → `Project` → `Technical` → `Behavioral`
- Progress bar: gradient fill animating width

### AI Interviewer Panel (Left)
**AI Avatar Area**:
- Circle with indigo/purple gradient background
- When AI is speaking: 5 animated vertical bars oscillating at different heights (like a music visualizer / waveform)
- When idle: subtle slow pulse on the circle

**Question Text**: 
- Large, readable, `font-size: 1.2rem`, `line-height: 1.8`
- Question number in mono font: `Q4`
- Question type badge: e.g., `[TECHNICAL]` in indigo pill

**Action Buttons**:
- `🔊 Play Voice` — ONLY plays AI voice when clicked (NOT auto-play). Calls backend `/api/interviews/tts` and plays returned MP3. While playing: button pulses + waveform animates.
- If backend TTS fails → fallback to `window.speechSynthesis` with these settings:
  ```js
  const utterance = new SpeechSynthesisUtterance(questionText);
  utterance.pitch = 1.15;    // higher pitch = sweeter female voice
  utterance.rate = 0.92;     // slightly slower = clearer, more professional
  utterance.volume = 1.0;
  // Select female voice:
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Victoria') || v.lang === 'en-GB') || voices[0];
  speechSynthesis.speak(utterance);
  ```
- `💬 Ask AI` — opens the clarification modal (see below)

### Candidate Response Panel (Right)

**Mode Toggle** (top of panel):
```
[🎙️ Voice Mode]  [⌨️ Text Mode]
```

**Voice Mode**:
- Large pulsing mic orb (indigo glow, 80px circle)
- When recording: orb pulses strongly, "Recording..." label
- **Live transcription**: As user speaks, text appears word-by-word in a preview textarea below the orb
- Implementation using Web Speech API (SpeechRecognition):
  ```js
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.continuous = true;
  recognition.interimResults = true;   // ← shows words as spoken (real-time!)
  recognition.lang = 'en-US';
  recognition.onresult = (event) => {
    // combine all results into running transcript
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    setLiveTranscript(transcript);
  };
  ```
- If browser doesn't support SpeechRecognition: show a "Recording..." state, then POST audio blob to `/api/interviews/transcribe` on stop
- Controls: `[⏹ Stop Recording]` → shows transcript preview → `[🔄 Retake]` `[✓ Submit Answer]`

**Text Mode**:
- Full `<textarea>` with auto-resize
- Character counter (bottom right)
- Placeholder: "Type your answer here... Be specific and use examples from your experience."
- `[✓ Submit Answer]` button

### Feedback Card (after answer submission)
- Slides up from bottom with smooth animation
- 4 score bars with animated fill (delay each by 100ms)
- AI feedback text (from `evaluation.feedback`)
- Auto-advance countdown (4s) with animated dots, manual "→ Next Question" button

### Ask AI Clarification Modal

Triggered by `💬 Ask AI` button. Full-screen overlay with centered card.

```
┌─────────────────────────────────────────┐
│  💬 Ask Your Interviewer                 │
│                                         │
│  Current Question:                      │
│  "Design a scalable notification..."    │
│                                         │
│  Your Question:                         │
│  [__________________________________]   │
│  [Can I assume push + email both?   ]   │
│                                         │
│  [🎙️ Speak your question]              │
│                                         │
│  [Send →]                               │
│                                         │
│  ─────── AI Response ───────            │
│  "Great question! Yes, design for      │
│   both channels. Focus on the          │
│   push notification pipeline first."  │
│                                         │
│  [🔊 Hear Response]  [✓ Got it!]       │
└─────────────────────────────────────────┘
```

- User can type OR speak their question (Web Speech API)
- AI response text displayed below
- `🔊 Hear Response`: plays AI clarification via TTS (same system as question playback)
- POST to `/api/interviews/{id}/clarify`

### Floating Finish Button
Bottom right corner, always visible:
```
[🏁 Finish & Submit Interview]
```
- Soft rose/amber gradient
- Clicking shows confirmation modal:
  ```
  "Are you sure you want to submit?
   You've answered 8 of 12 questions.
   [Cancel]  [Yes, Submit Interview →]"
  ```
- On confirm: POST to `/api/interviews/{id}/finish` → redirect to `/report?id={candidateId}`

### Complete Interview Flow Logic (React)
```typescript
// State management
const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
const [questionOrder, setQuestionOrder] = useState(1);
const [isComplete, setIsComplete] = useState(false);

// On answer submit:
const handleSubmitAnswer = async (answer: string) => {
  setSubmitting(true);
  const res = await fetch(`${API_BASE}/api/interviews/${candidateId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_order: questionOrder, answer })
  });
  const data = await res.json();
  
  setEvaluation(data);            // show feedback card
  
  if (data.interview_complete) {
    setIsComplete(true);
    // redirect to report after 2s
    setTimeout(() => router.push(`/report?id=${candidateId}`), 2000);
    return;
  }
  
  if (data.next_question) {
    // SUCCESS: advance to next question directly — NO page refresh needed!
    setTimeout(() => {
      setCurrentQuestion(data.next_question);
      setQuestionOrder(data.next_question.question_order);
      setEvaluation(null);
      setLiveTranscript('');
    }, 4000); // 4s for feedback review
  } else {
    // Fallback: poll for next question
    const nextRes = await fetch(`${API_BASE}/api/interviews/${candidateId}/next-question`);
    const nextQ = await nextRes.json();
    if (nextQ) {
      setTimeout(() => {
        setCurrentQuestion(nextQ);
        setQuestionOrder(nextQ.question_order);
        setEvaluation(null);
      }, 4000);
    }
  }
  setSubmitting(false);
};
```

---

## SCREEN 4: Candidate Scorecard & Report (`/report?id={candidateId}`)

### Overall Layout
Dark luxury page. Sections stack vertically with generous spacing.

### Section 1: Verdict Banner
Full-width glassmorphic banner with gradient background based on result:
- **Strong Hire**: emerald gradient background + `🚀 Strong Hire` badge
- **Hire**: indigo gradient + `✅ Hire` badge
- **Needs Improvement**: amber gradient + `⚠️ Needs Improvement` badge
- **No Hire**: rose gradient + `❌ No Hire` badge

Content:
```
🚀 Strong Hire Recommendation
━━━━━━━━━━━━━━━━━━━━━━━
"Jane demonstrated exceptional technical depth across all
interview stages with concrete real-world examples."

Overall Score: 84 / 100   [████████░░]
```
Score shown as large number + progress bar

### Section 2: Score Gauges (4 circular SVG dials in a row)
Each gauge:
- SVG circle with animated stroke-dasharray fill on page load
- Gradient stroke (indigo → cyan)
- Score number in center (JetBrains Mono font, large)
- Label below

```
[Technical  ] [Problem   ] [Communic.] [Depth    ]
[    8.4    ] [  Solving ] [   8.0   ] [   7.8   ]
[  /10  ●   ] [   7.9    ] [  /10 ●  ] [  /10 ●  ]
              [  /10  ●  ]
```

### Section 3: Two-Column Grid

**Left: ✅ Demonstrated Strengths**
List of strength cards (glassmorphic pill cards):
```
[⚡ System Design Expertise]
   "Correctly identified sharding and caching tradeoffs in Q5"

[💬 Clear Communication]
   "Structured all answers with clear problem → solution format"
```

**Right: 🎯 Growth Areas**
Same card style but amber/rose accent:
```
[📊 Add Quantified Results]
   "Mention specific metrics (e.g., 40% latency reduction) in answers"

[🔍 Deeper Testing Knowledge]
   "Questions about testing strategy lacked concrete methodology"
```

### Section 4: 💡 Quick Wins
3 card pills in a row (emerald accent):
```
[✓ Use STAR format]  [✓ Add metrics]  [✓ Practice aloud]
```

### Section 5: 🗺️ Your Personalized 4-Week Roadmap
Timeline-style layout:

```
Week 1-2          Week 3            Week 4
━━━━━━           ━━━━━━           ━━━━━━
System Design    Testing Strategy  Mock Interviews
Review CAP       Read "Growing     Record yourself
theorem, DB      Object-Oriented   on Pramp.com
sharding,        Software" by      (free peer
caching.         Martin Fowler     interviews)
Resource:        Resource:         Resource:
"Designing       Martin Fowler's   Pramp.com
Data-Intensive   website          InterviewBit
Applications"    (martinfowler.com)
```

### Section 6: 🎤 Interview Style Coaching Tips
3 tips shown as numbered cards with icons:
```
1. 💬 Structure your answers better
   [tip text]

2. 🎯 Be specific with examples
   [tip text]

3. ⏱️ Mind your pacing
   [tip text]
```

### Section 7: 💌 Encouragement Message
Warm italic quote in a highlighted glassmorphic card with a ✨ icon.

### Section 8: Action Buttons (side by side)
```
[📄 Download PDF Report]   [🔄 Start New Practice Interview]
```

---

## 🔌 Full API Integration Reference

```typescript
const API_BASE = 'https://your-backend.onrender.com'; // or http://localhost:8000

// ─── 1. REGISTER ───────────────────────────────────────────────────────
// POST /api/candidates/register
// Body: FormData { name, email, mobile, position, resume (File) }
// Response: { id: number, name: string, status: string }

// ─── 2. OTP FLOW ───────────────────────────────────────────────────────
// POST /api/candidates/{id}/send-otp    → sends OTP email/SMS
// POST /api/candidates/{id}/verify-otp  → { otp_code: "123456" }
// Response: { verified: true, message: string }

// ─── 3. INTERVIEW FLOW ─────────────────────────────────────────────────
// GET  /api/interviews/{id}/questions
// Response: [{ question_order, question_type, stage, question }]

// POST /api/interviews/{id}/answer
// Body: { question_order: number, answer: string }
// Response: {
//   technical_score, clarity_score, depth_score, communication_score,
//   feedback, next_question: { question_order, question_type, stage, question } | null,
//   interview_complete: boolean
// }

// GET  /api/interviews/{id}/next-question   ← FALLBACK POLLING
// Response: { question_order, question_type, stage, question } | null

// POST /api/interviews/{id}/clarify
// Body: { current_question: string, user_query: string }
// Response: { ai_response: string }

// POST /api/interviews/{id}/finish
// Response: { status, message, candidate_id, questions_answered, overall_score }

// ─── 4. TTS — FEMALE VOICE ─────────────────────────────────────────────
// POST /api/interviews/tts
// Body: { text: string }
// Response: MP3 audio stream (play with new Audio(url) or AudioContext)
// Frontend code:
//   const res = await fetch(`${API_BASE}/api/interviews/tts`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ text: questionText })
//   });
//   const blob = await res.blob();
//   const url = URL.createObjectURL(blob);
//   const audio = new Audio(url);
//   audio.play();

// ─── 5. TRANSCRIPTION (FALLBACK) ───────────────────────────────────────
// POST /api/interviews/transcribe
// Body: FormData { audio: File (webm/wav) }
// Response: { text: string }
// ⚠️ Use only when SpeechRecognition API not supported

// ─── 6. REPORT & SUGGESTIONS ───────────────────────────────────────────
// GET /api/reports/{id}
// Response: { overall_score, technical_score, problem_solving_score,
//             communication_score, strengths, weaknesses, recommendation,
//             improvement_plan, upskilling_plan, summary }

// GET /api/interviews/{id}/suggestions
// Response: {
//   overall_score, verdict, verdict_reason,
//   top_strengths: [{ title, detail }],
//   growth_areas: [{ title, detail }],
//   quick_wins: string[],
//   coaching_roadmap: [{ week, focus, action, resource }],
//   interview_style_tips: string[],
//   encouragement: string
// }

// GET /api/reports/{id}/pdf   → PDF binary download
```

---

## ⚙️ Environment Variables (frontend `.env`)
```
VITE_API_BASE=http://localhost:8000
```

---

## 🔑 Key UX Rules

1. **NO page refresh ever** — all state transitions via React state. Backend `/next-question` polling is fallback only.
2. **Play Voice is CLICK-ONLY** — never auto-play. User must click `🔊 Play Voice` to hear the question.
3. **Transcription is real-time** — use `SpeechRecognition.interimResults = true` so words appear as user speaks.
4. **Female voice implementation**: TTS endpoint returns MP3 from gTTS (British English, sweet female tone). If it fails, fallback to Web Speech API with pitch: 1.15, rate: 0.92 + select female voice by name.
5. **Submit Interview**: The `🏁 Finish & Submit Interview` floating button always visible. Always show confirmation modal before submitting.
6. **Report page**: Load BOTH `/api/reports/{id}` AND `/api/interviews/{id}/suggestions` in parallel on mount for rich data.
7. **Error handling**: All API errors should show toast notifications (bottom-right corner), never blank white pages.
8. **Local storage**: Store `candidateId` in localStorage so refreshing the page doesn't lose session.
```
