# CLAUDE.md — Career Mode Live

## What This Is

Hackathon submission for the **Gemini Live Agent Challenge** (deadline March 16, 2026).

Multi-agent voice career coaching panel: 3 AI personas (Chad, Dr. Reeves, Viktor) simultaneously listen, respond, debate each other, and provoke the user. Built on Gemini 2.0 Flash.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12 / FastAPI / uv |
| Frontend | Next.js 14 / TypeScript / TailwindCSS |
| AI | Google GenAI SDK (`google-genai`) / Gemini 2.0 Flash |
| Voice | Web Speech API (browser-native) |
| Deploy | Docker / Cloud Run / Firebase Hosting |

## Running Locally

```bash
./run.sh
# or manually:
cd backend && uv run uvicorn main:app --reload --port 8000
cd frontend && npm run dev
```

Requires `GEMINI_API_KEY` in `backend/.env`.

## Architecture

- Backend orchestrates 3 coaches in sequence (each sees prior coaches' responses)
- Frontend renders responses with staggered animation for panel discussion feel
- Voice input via Web Speech API, TTS via browser SpeechSynthesis
- RPG character sheet generated from resume analysis

## Conventions

- Python: `uv` for deps, 3.12
- Frontend: Next.js App Router, Tailwind, Zustand for state
- API key: `GEMINI_API_KEY` env var (backend only)
- Dark theme: #0D1117 bg, #C9D1D9 text, #58A6FF accent
- Coach colors: Chad=#FF7B72, Reeves=#BC8CFF, Viktor=#79C0FF
