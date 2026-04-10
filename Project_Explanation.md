# AI Interview Bot: Intelligent Automated Candidate Screening System

## 1. Project Overview
**What the System Does:** 
The AI Interview Bot is an automated, end-to-end interviewing platform. It intelligently extracts information from candidate resumes to dynamically generate context-aware interview questions. During the interview, it interacts with candidates using natural voice recognition and synthesis, evaluates their responses in real time, and produces a structured final report.

**Business Value:** 
This system significantly reduces the time and resources required for preliminary candidate screening. By establishing an objective, standardized, and scalable interview process, it empowers recruitment teams to focus on top-tier candidates, accelerating the hiring pipeline and minimizing bias.

## 2. Key Features
- **Resume Upload & Parsing:** Capability to upload documents (PDF/Docx) with accurate text extraction.
- **AI-Based Question Generation:** Tailors questions specific to the candidate's unique experience and stated skills.
- **Dynamic Interview Flow:** Adapts the interview rhythm and subsequent questions based on candidate inputs.
- **Voice-Based Interaction:** Features real-time Speech-to-Text for candidate answers and Text-to-Speech for the AI interviewer.
- **Real-Time Answer Evaluation:** Provides immediate scoring and insight generation based on the candidate's latest response.
- **Final Report Generation:** Summarizes performance into an actionable document for technical leads and HR.
- **Error Handling & Retry Logic:** Robust fallback mechanisms to ensure seamless interviews despite network or external API hiccups.

## 3. System Architecture
Our architecture separates concerns and ensures a highly logical, secure flow:
- **Frontend (React / Next.js):** Delivers a responsive, accessible interface with real-time audio capturing and playback, styled with Tailwind CSS.
- **Backend (FastAPI):** Orchestrates business logic, manages state, handles file processing (`pdfplumber`/`python-docx`), and provides low-latency Python endpoints.
- **AI Layer (OpenAI API / Web Speech API):** Drives the core intelligence, handling context extraction, conversational dynamics, and system voice interactions.
- **Database (PostgreSQL):** Securely stores candidate profiles, generated questions, raw transcripts, and final evaluation metrics.

## 4. API Design
RESTful endpoints seamlessly connect the user interface to the core logic:
- `POST /register`: Registers the candidate, uploads, and parses their resume.
- `GET /next-question`: Fetches the dynamically generated next question.
- `POST /transcribe`: Converts uploaded candidate audio into text via Speech-to-Text.
- `POST /evaluate`: Sends the parsed text for AI grading and qualitative feedback.
- `GET /ai-health`: Monitors the status of the OpenAI API and system readiness.

## 5. Data Pipeline
The candidate journey follows a continuous, state-driven workflow:
1. **Upload Resume:** Candidate submits their document.
2. **Extract Text:** Text is parsed utilizing `pdfplumber` or `python-docx`.
3. **Store Data:** Baseline candidate data is structured and registered in the database.
4. **Generate Questions:** The AI reviews the extraction and prepares customized questions.
5. **Capture Answers:** The frontend captures candidate voice responses and transcribes them.
6. **Evaluate Responses:** Transcripts are scored against expected technical benchmarks.
7. **Generate Report:** A final, consolidated feedback matrix is generated for the hiring team.

## 6. AI Models & Workflow
The system leverages state-of-the-art models and a structured step-by-step workflow to conduct the interview:

**Models & APIs Used:**
- **Text Generation & Logic:** OpenAI's LLM (`gpt-4o` / `gpt-3.5-turbo`) handles resume analysis, dynamic question generation, and real-time candidate answer evaluation.
- **Speech-to-Text (STT):** OpenAI Whisper API (or native Browser Web Speech API) accurately transcribes candidate audio into text.
- **Text-to-Speech (TTS):** Web Speech API (or OpenAI TTS) vocalizes the generated questions to create a natural conversational feel.

**AI Processing Workflow:**
1. **Context Extraction:** The LLM maps out skills, experiences, and potential gaps from the previously parsed resume data.
2. **Initial Question Generation:** Utilizing the extracted context, the model formulates the first set of tailored technical and behavioral questions.
3. **Adaptive Questioning:** After receiving the candidate's transcribed answer (via STT), the LLM analyzes the response. Based on the depth and accuracy of this answer, the AI dynamically adjusts the difficulty and topic of the follow-up request.
4. **Real-time Evaluation:** The LLM grades responses continuously on technical accuracy, clarity, and completeness.
5. **Vocalization:** The generated response and the next follow-up question are converted to audio (via TTS) and played back to the candidate seamlessly.

## 7. Performance Optimization
To simulate a natural conversation and maintain user engagement:
- **Per-Question Generation:** Questions are generated lazily (just-in-time) rather than in bulk, allowing the system to adapt mid-interview and minimizing initial load times.
- **Reduced Latency:** Optimized prompt engineering ensures much faster AI inference.
- **Retry Logic:** Automatic exponential backoff handles transient OpenAI API rate limits or failures gracefully.
- **Timeout Handling:** Strict timeout parameters ensure the interface remains responsive under load.

## 8. Challenges & Solutions
- **API Failures:** *Solution:* Implemented robust fallback logic to handle OpenAI service degradations without abruptly ending the interview.
- **Network Issues:** *Solution:* Frontend is equipped with offline audio buffering before transmitting to the transcription service.
- **Large Prompt Handling:** *Solution:* Context window limits are managed by summarizing the conversation history before sending it back to the AI.
- **Voice Transcription Errors:** *Solution:* Context-aware prompt injection on the AI side helps the model deduce incorrectly transcribed technical jargon based on the candidate's resume.

## 9. Future Improvements
- **Emotion Detection:** Analyzing sentiment via voice tone to evaluate soft skills and confidence under pressure.
- **Proctoring:** Integrating web-camera analysis for identity verification and anti-cheating mechanisms.
- **Multi-language Support:** Enabling the AI to conduct non-English or multilingual interviews natively.
- **Advanced Analytics Dashboard:** Providing comprehensive candidate comparative metrics across diverse recruitment cohorts.
