# Architecture — Career Mode Live

## System Overview

Career Mode Live is a multi-agent voice career coaching panel for the **Gemini Live Agent Challenge** (Creative Storyteller category). Three AI personas (powered by Gemini 2.5 Flash) operate as a panel, each responding in sequence and building on what the previous coaches said. The provocation-first methodology deliberately generates a bad career summary to provoke authentic pushback, then uses that emotional signal as raw material for narrative discovery.

## Architecture Diagram

```
+=====================================================================+
|                          BROWSER (Client)                            |
|                                                                      |
|  +------------------+  +-------------------+  +-------------------+  |
|  | Web Speech API   |  | Coaching Panel    |  | Character Sheet   |  |
|  | (voice input)    |  | + Flat Mirror Card|  | (radar chart,     |  |
|  |                  |  | + Narrative Card  |  |  skill bars)      |  |
|  +--------+---------+  +---------+---------+  +-------------------+  |
|           |                      |                      ^            |
|           v                      v                      |            |
|  +--------+----------------------+----------------------+---------+  |
|  |                    Zustand State Store                          |  |
|  |  - characterSheet  - messages  - coachingPhase  - roundCount   |  |
|  |  - narrativeSynthesis  - conversationHistory  - isLoading      |  |
|  +------------------------+--------------------------------------+  |
|                           |                                          |
+===========================+==========================================+
                            | HTTP POST (JSON)
                            v
+=====================================================================+
|                        BACKEND (FastAPI)                              |
|                                                                      |
|  Endpoints:                                                          |
|  +-------------------+                                               |
|  | /api/onboard      | --> resume_parser --> skill_analyzer          |
|  +-------------------+                   --> flat_mirror (Gemini)    |
|                                                                      |
|  +-------------------+                                               |
|  | /api/coaching/    | --> coaching_panel.run_panel()                |
|  |     panel         |     (3 sequential coach calls)                |
|  +-------------------+                                               |
|                                                                      |
|  +-------------------+                                               |
|  | /api/coaching/    | --> coaching_panel.run_narrative_synthesis()  |
|  |   synthesize      |     (throughline extraction)                  |
|  +-------------------+                                               |
|                                                                      |
|  +-------------------+                                               |
|  | /api/tts          | --> Google Cloud Text-to-Speech              |
|  +-------------------+     (3 distinct coach voices)                 |
|                                                                      |
|  +---------------------------------------------------+              |
|  |           Panel Orchestrator                       |              |
|  |                                                    |              |
|  |  Step 1: Chad (persona + user input)               |              |
|  |           |                                        |              |
|  |  Step 2: Dr. Reeves (persona + user + Chad)        |              |
|  |           |                                        |              |
|  |  Step 3: Viktor (persona + user + Chad + Reeves)   |              |
|  |                                                    |              |
|  +-------------------------+-------------------------+              |
|                            |                                         |
+============================+=========================================+
                             | API calls (sequential)
                             v
+=====================================================================+
|                    GEMINI 2.5 FLASH API                               |
|  +  GOOGLE CLOUD TEXT-TO-SPEECH                                      |
|                                                                      |
|  Gemini:                                                             |
|  - System instruction: coach persona                                 |
|  - Context: user input + prior coaches + character sheet             |
|  - Temperature: 0.8 (creative, varied responses)                     |
|  - Max tokens: 250 (punchy, not preachy)                             |
|  - Thinking: disabled (direct responses only)                        |
|                                                                      |
|  Cloud TTS:                                                          |
|  - Chad: en-US-Neural2-J (casual, slightly faster)                   |
|  - Dr. Reeves: en-GB-Neural2-B (British authority, measured)         |
|  - Viktor: en-US-Neural2-D (deep, precise)                          |
+=====================================================================+
```

## Coaching Flow (4 Phases)

```
1. ONBOARD
   User pastes resume or speaks background
   → parse + skill analysis → character sheet (RPG radar chart)
   → Gemini generates deliberately generic "flat mirror"

2. FLAT MIRROR (the provocation)
   Panel displays corporate-BS career summary in a formal card
   User pushes back: "That's not what I did at all..."
   → Phase auto-transitions to PROVOCATION

3. PROVOCATION
   Panel pounces on pushback — probes for the real story
   Each coach approaches from their angle:
     Chad: "Cool story bro, but what did you ACTUALLY do?"
     Reeves: "I notice you got defensive about X — there's a pattern..."
     Viktor: "Your career algorithm prioritizes complexity over safety..."

   Repeat 2-4 rounds of user pushback ↔ panel probing

4. SYNTHESIS (the payoff)
   After sufficient conversation, user triggers synthesis
   → Viktor generates career throughline:
     - Primary narrative ("You are someone who...")
     - Evidence from conversation
     - Reframe in their own words
     - Positioning statement (authentic career summary)
```

## Key Design Decisions

### 1. Sequential Coach Execution (not parallel)
Each coach sees what the previous coaches said. This creates genuine debate dynamics. Chad provokes, Reeves deepens, Viktor synthesizes. Trade-off: 3 sequential API calls (~2-3 seconds total with Flash) vs. instant parallel responses. The staggered delivery enhances the "panel discussion" feel.

### 2. Provocation-First Methodology
The "flat mirror" technique: generate a deliberately generic career summary, then use the user's pushback as the real signal. People can't tell you what's special about their career, but they absolutely know how to say "that's wrong."

### 3. Thinking Budget Disabled
Gemini 2.5 Flash's thinking feature is disabled (thinking_budget=0) because we want direct, conversational responses — not deep reasoning. The coaching is in the persona and conversation dynamics, not model reasoning depth.

### 4. Google Cloud TTS for Distinct Voices
Each coach gets a unique voice via Cloud TTS (Neural2 voices). This sells the multi-persona concept immediately — the audience hears three distinct entities debating. Fallback to browser SpeechSynthesis if Cloud TTS is unavailable.

### 5. Narrative Synthesis as Explicit Action
The throughline synthesis is triggered manually (not automatic) because it's the "reveal" moment. The user decides when they've shared enough for the panel to synthesize. This creates a dramatic payoff beat.

## Deployment Architecture (Google Cloud)

```
                    +-------------------+
                    |  Firebase Hosting  |
                    |  (Static Next.js)  |
                    +---------+---------+
                              |
                    +---------v---------+
                    |   Cloud Run       |
                    |   (FastAPI)       |
                    |   - Auto-scaling  |
                    |   - GEMINI_API_KEY|
                    |   - GCP creds    |
                    +---+----------+---+
                        |          |
              +---------v---+  +---v---------+
              | Gemini API  |  | Cloud TTS   |
              +-------------+  +-------------+
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/onboard` | Process resume/background, generate character sheet + flat mirror |
| POST | `/api/coaching/panel` | Run 3-coach panel on user input |
| POST | `/api/coaching/synthesize` | Extract career throughline from conversation |
| POST | `/api/tts` | Convert coach text to speech (Cloud TTS) |
| POST | `/api/skills/analyze` | Analyze skills from text |
