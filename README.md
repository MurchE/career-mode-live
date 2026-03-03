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

1. **Onboard**: Paste resume or share background
2. **Flat Mirror**: Panel generates a deliberately generic career summary
3. **Provocation**: You push back ("that's not what I did") -- panel probes deeper
4. **Real Stories**: Panel extracts authentic narratives from your pushback
5. **Synthesis**: Viktor builds a throughline framework from the conversation

## Tech Stack

- **Backend**: Python 3.12 / FastAPI / Google GenAI SDK
- **Frontend**: Next.js 14 / TypeScript / TailwindCSS / Zustand
- **AI Model**: Gemini 2.0 Flash
- **Voice**: Web Speech API (recognition + synthesis)
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

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/onboard` | Process resume/background, generate character sheet + flat mirror |
| POST | `/api/coaching/panel` | Run 3-coach panel on user input |
| POST | `/api/skills/analyze` | Analyze skills from text |

## Project Structure

```
career-mode-live/
+-- backend/
|   +-- main.py                 # FastAPI app
|   +-- app/
|   |   +-- gemini_service.py   # Gemini client wrapper
|   |   +-- coaching_panel.py   # Multi-agent orchestration
|   |   +-- personas.py         # 3 coach persona definitions
|   |   +-- skill_analyzer.py   # Heuristic skill analysis
|   |   +-- resume_parser.py    # Text resume parser
|   +-- pyproject.toml
|   +-- Dockerfile
+-- frontend/
|   +-- src/
|   |   +-- app/page.tsx        # Main page
|   |   +-- components/
|   |   |   +-- coaching-panel.tsx      # Core panel UI
|   |   |   +-- character-sheet-mini.tsx # RPG sidebar
|   |   |   +-- onboarding.tsx          # Onboarding flow
|   |   +-- hooks/use-voice.ts  # Web Speech API
|   |   +-- stores/character-store.ts   # Zustand state
|   |   +-- lib/api.ts          # Backend API client
|   +-- Dockerfile
+-- docker-compose.yml
+-- run.sh
+-- README.md
```

## Built With

- [Gemini 2.0 Flash](https://ai.google.dev/) -- Google's fastest multimodal model
- [Google GenAI SDK](https://github.com/googleapis/python-genai) -- Official Python SDK
- [FastAPI](https://fastapi.tiangolo.com/) -- Modern Python web framework
- [Next.js](https://nextjs.org/) -- React framework
- [Zustand](https://zustand-demo.pmnd.rs/) -- Lightweight state management

## License

MIT

---

*Built for the Gemini Live Agent Challenge by Murch + AI squad.*
