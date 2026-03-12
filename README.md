# Career Mode Live

**Multi-Agent Voice Career Coaching Panel** -- Gemini Live Agent Challenge Submission

Three AI coaching personas sit on a panel together, listening to your career story, debating each other, and provoking you into discovering what makes your professional narrative actually interesting.

[Demo Video](#) <!-- TODO: Add demo video link -->

---

## The Panel

| Coach | Personality | Role |
|-------|-------------|------|
| **Chad** (The Roast Bro) | Blunt, irreverent, cuts through BS | Goes first. Provokes. Challenges vague language. |
| **Dr. Reeves** (Depth Therapist) | Empathetic, probing, perceptive | Goes second. Digs deeper. Finds patterns you missed. |
| **Viktor** (Tech Savant) | Analytical, systematic, data-driven | Goes third. Synthesizes. Builds frameworks around insights. |

Each coach sees what the previous coaches said, creating genuine debate and building-on-each-other dynamics.

## How It Works

```
                          +------------------+
                          |   User speaks    |
                          | (voice or text)  |
                          +--------+---------+
                                   |
                          +--------v---------+
                          |   FastAPI Panel   |
                          |   Orchestrator    |
                          +--------+---------+
                                   |
                    +--------------+--------------+
                    |              |              |
             +------v------+ +----v-------+ +----v------+
             |    Chad      | | Dr. Reeves | |  Viktor   |
             | (Gemini API) | | (Gemini)   | | (Gemini)  |
             | sees: user   | | sees: user | | sees: all |
             |              | | + Chad     | | + Chad    |
             +------+------+ +----+-------+ | + Reeves  |
                    |              |          +----+------+
                    |              |               |
                    +--------------+---------------+
                                   |
                          +--------v---------+
                          |  Frontend Panel  |
                          | (staggered render)|
                          +------------------+
```

## Coaching Flow

1. **Onboard**: Paste resume or share background — character sheet auto-generates
2. **Flat Mirror**: Panel generates a deliberately generic career summary (displayed as a formal "Career Summary Report" card)
3. **Provocation**: You push back ("that's not what I did") — the three coaches pounce from different angles
4. **Deep Dive**: Panel extracts authentic narratives from your pushback across 2-4 rounds
5. **Synthesis**: Click "Synthesize Throughline" — the panel reveals your career's organizing narrative, with evidence, reframe, and positioning statement

## Tech Stack

- **Backend**: Python 3.12 / FastAPI / Google GenAI SDK
- **Frontend**: Next.js 14 / TypeScript / TailwindCSS / Zustand
- **AI Model**: Gemini 2.5 Flash (thinking disabled for conversational speed)
- **Voice Input**: Web Speech API (browser-native recognition)
- **Voice Output**: Google Cloud Text-to-Speech (Neural2 voices — distinct per coach)
- **Google Cloud**: Cloud TTS + Cloud Run (deployment)
- **Deploy**: Docker / Google Cloud Run / Firebase Hosting

## Quick Start

### Prerequisites

- Python 3.12+ with [uv](https://github.com/astral-sh/uv)
- Node.js 20+
- [Gemini API key](https://aistudio.google.com/apikey)

### Setup

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/career-mode-live.git
cd career-mode-live

# Set API key
cp backend/.env.example backend/.env
# Edit backend/.env and add your GEMINI_API_KEY

# Run both services
./run.sh
```

Or run manually:

```bash
# Terminal 1 — Backend
cd backend
uv sync
uv run uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### Docker

```bash
# Set your API key
export GEMINI_API_KEY=your-key-here

# Run
docker compose up --build
```

## RPG Character Sheet

Every user gets an auto-generated character sheet with:

- **6 Skill Dimensions**: Technical, Leadership, Communication, Analytical, Creative, Operational
- **Character Class**: Hacker, Scientist, Bard, Paladin, Ranger, or Artificer
- **Point Budget**: Base 100 + 3 per year of experience
- **Radar Chart**: Visual skill distribution

## DrawTogether — AI Collaborative Whiteboard

A visual thinking canvas where you draw and the AI responds with annotations, connections, and insights:

- **Pen tool** with pressure-sensitive freehand drawing (via `perfect-freehand`)
- **Arrow tool** for connecting concepts
- **Color palette** (7 colors) and stroke sizes
- **Vision mode**: Draw anything → AI sees your canvas → responds with hand-drawn shapes, arrows, labels
- **Voice + Vision mode**: Real-time bidirectional voice via Gemini Live API WebSocket + canvas screenshots
- **AI drawing layer**: Hand-drawn wobbly aesthetic with animated stroke-dashoffset reveals

Navigate to `/whiteboard` from the main app.

## Career Trailer — Storyboard Generator

After the coaching session, Gemini generates an interleaved text + image career storyboard using the `gemini-2.5-flash-image` model. This is rendered as a cinematic Career Trailer with Ken Burns effects on each generated panel.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/onboard` | Process resume/background, generate character sheet + flat mirror |
| POST | `/api/coaching/panel` | Run 3-coach panel on user input |
| POST | `/api/coaching/synthesize` | Extract career throughline from conversation history |
| POST | `/api/coaching/extract-star` | Extract STAR elements for live whiteboard |
| POST | `/api/coaching/storyboard` | Generate interleaved text+image career storyboard |
| POST | `/api/tts` | Text-to-speech with distinct coach voices (Gemini native TTS) |
| POST | `/api/whiteboard/analyze` | Canvas screenshot → AI drawing commands |
| GET | `/api/live/config` | Gemini Live API config for client-side WebSocket |
| POST | `/api/skills/analyze` | Analyze skills from text |

## Project Structure

```
career-mode-live/
+-- backend/
|   +-- main.py                 # FastAPI app (all endpoints)
|   +-- app/
|   |   +-- gemini_service.py   # Gemini client (text, JSON, TTS, image)
|   |   +-- coaching_panel.py   # Multi-agent orchestration + storyboard
|   |   +-- whiteboard_service.py # Canvas analysis → drawing commands
|   |   +-- personas.py         # 3 coach persona definitions
|   |   +-- skill_analyzer.py   # Heuristic skill analysis
|   |   +-- resume_parser.py    # Text resume parser
|   +-- pyproject.toml
|   +-- Dockerfile
+-- frontend/
|   +-- src/
|   |   +-- app/
|   |   |   +-- page.tsx              # Main coaching page
|   |   |   +-- whiteboard/page.tsx   # DrawTogether canvas
|   |   +-- components/
|   |   |   +-- coaching-panel.tsx      # Core panel UI
|   |   |   +-- draw-canvas.tsx         # SVG drawing canvas
|   |   |   +-- drawing-toolbar.tsx     # Tool/color/size picker
|   |   |   +-- ai-drawing-layer.tsx    # AI shape renderer (wobbly)
|   |   |   +-- character-sheet-mini.tsx # RPG sidebar
|   |   |   +-- career-trailer.tsx      # Cinematic storyboard player
|   |   |   +-- onboarding.tsx          # Onboarding flow
|   |   +-- hooks/
|   |   |   +-- use-voice.ts           # Web Speech API
|   |   |   +-- use-gemini-live.ts     # Gemini Live WebSocket
|   |   +-- stores/
|   |   |   +-- character-store.ts     # Coaching state
|   |   |   +-- canvas-store.ts        # Drawing state
|   |   +-- lib/api.ts                 # Backend API client
|   +-- Dockerfile
+-- docker-compose.yml
+-- run.sh
+-- README.md
```

## Built With

- [Gemini 2.5 Flash](https://ai.google.dev/) -- Text coaching, JSON structured output, canvas analysis
- [Gemini 2.5 Flash Image](https://ai.google.dev/) -- Interleaved text + image storyboard generation
- [Gemini Live API](https://ai.google.dev/) -- Real-time bidirectional voice + vision WebSocket
- [Gemini Native TTS](https://ai.google.dev/) -- Per-coach voice synthesis (Kore, Puck, Enceladus)
- [Google GenAI SDK](https://github.com/googleapis/python-genai) -- Official Python SDK
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) -- Pressure-sensitive pen strokes
- [FastAPI](https://fastapi.tiangolo.com/) -- Modern Python web framework
- [Next.js](https://nextjs.org/) -- React framework
- [Zustand](https://zustand-demo.pmnd.rs/) -- Lightweight state management

## License

MIT

---

*Built for the Gemini Live Agent Challenge by Murch + AI squad.*
