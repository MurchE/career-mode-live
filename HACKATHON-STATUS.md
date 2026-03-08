# Hackathon Status — Career Mode Live

**Competition:** Gemini Live Agent Challenge
**Category:** Creative Storyteller
**Deadline:** March 16, 2026 @ 5:00 PM PDT
**Days remaining:** 9

## Current State (March 7, 2026)

### Working
- Backend: FastAPI running with Gemini 2.5 Flash integration
- 3-coach panel: Chad, Dr. Reeves, Viktor — sequential orchestration, each builds on prior
- Flat mirror: Deliberately generic career summary generation
- Provocation mode: Panel probes user's pushback
- Narrative synthesis: Career throughline extraction (JSON structured output)
- Frontend: Next.js with onboarding, coaching panel, character sheet
- Flat mirror displayed as formal "Career Summary Report" card (visually distinct)
- Narrative synthesis card with throughline, evidence, reframe, positioning statement
- Voice input: Web Speech API hook
- RPG character sheet: 6 skills, radar chart, character class
- TTS endpoint: Built with Cloud TTS (3 distinct Neural2 voices per coach)
- Staggered message rendering with send-lock during stagger
- Round counter for tracking coaching depth

### Needs Human Action (Murch)

1. **[BLOCKING] Set up GCP project + enable Cloud TTS API**
   - Go to https://console.cloud.google.com
   - Create or select a project
   - Enable "Cloud Text-to-Speech API"
   - Create a service account + download JSON key
   - Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` in backend/.env or environment
   - Without this, TTS falls back to browser SpeechSynthesis (worse quality, no distinct voices)

2. **[BLOCKING] Test the full flow end-to-end in a browser**
   - `cd backend && uv run uvicorn main:app --reload --port 8000`
   - `cd frontend && npm run dev`
   - Open http://localhost:3000 in Chrome
   - Paste a resume, push back on flat mirror, have a 3-round conversation
   - Click "Synthesize Throughline" after 2+ rounds
   - Test voice input (microphone icon)

3. **[BEFORE SUBMISSION] Record demo video (4 min max)**
   - Script a coaching session with a real resume (Murch's or test data)
   - Start mid-action (show flat mirror already generated, not onboarding setup)
   - Show: pushback → panel pounce → deeper probing → synthesis reveal
   - Include voice input for at least 10 seconds to show it works
   - Architecture diagram at beginning (30 seconds)

4. **[BEFORE SUBMISSION] Deploy to Google Cloud**
   - Deploy backend to Cloud Run
   - Deploy frontend to Firebase Hosting (or Vercel)
   - This satisfies "at least one Google Cloud service" requirement

5. **[NICE TO HAVE] Devpost submission prep**
   - Create project on geminiliveagentchallenge.devpost.com
   - Upload demo video
   - Link GitHub repo (make public or provide access)
   - Write submission text (README already has the content)

## Architecture Decision Record

All three debate agents (Product Strategist, Technical Architect, Hackathon Judge) unanimously agreed:

| Decision | Chosen | Why |
|----------|--------|-----|
| Category | Creative Storyteller | Natural fit — narrative discovery, not autonomous agents |
| SDK | Raw GenAI SDK | ADK v1.0.0 too new (9 days old), adds abstraction for zero gain |
| Google Cloud | Cloud TTS | 3 distinct coach voices = strongest demo differentiator |
| Gemini Live API | No | Architecture mismatch (1:1 voice vs 3-agent panel), too risky |
| Demo moment | Flat Mirror Revolt | AI wrong on purpose → user pushes back → panel pounces |
| Pulled from career-mode-ai | Narrative threading + provocation methodology | High impact, low integration cost |
| Excluded | Bullet corpus, LinkedIn parser, Target Dance | Scope creep, dilutes coaching focus |

## Remaining Build Work (Agent Can Do)

- [ ] Polish error handling (graceful fallback if Gemini API is slow/down)
- [ ] Add "retry" button if panel response fails
- [ ] Create architecture diagram image (Excalidraw or draw.io PNG)
- [ ] Dockerfile + docker-compose updates for Cloud TTS credentials
- [ ] Add conversation history trimming (prevent token limit after 10+ rounds)
- [ ] Test and polish responsive layout for demo recording
- [ ] Backup demo: record a screen capture of a successful session

## Stretch Goals (Only If Ahead of Schedule)

- [ ] GitHub profile parser for auto-populating character sheet
- [ ] Session persistence via Firestore (second Google Cloud service)
- [ ] Gemini Live API for STT input (replacing Web Speech API)
- [ ] Export career narrative as markdown/PDF
