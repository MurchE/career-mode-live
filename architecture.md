# Architecture — Career Mode Live

## System Overview

Career Mode Live is a multi-agent voice career coaching panel. Three AI personas (powered by Gemini 2.0 Flash) operate as a panel, each responding in sequence and building on what the previous coaches said.

## Architecture Diagram

```
+=====================================================================+
|                          BROWSER (Client)                            |
|                                                                      |
|  +------------------+  +-------------------+  +-------------------+  |
|  | Web Speech API   |  | Coaching Panel    |  | Character Sheet   |  |
|  | (voice input/    |  | (message display, |  | (radar chart,     |  |
|  |  TTS output)     |  |  staggered render)|  |  skill bars)      |  |
|  +--------+---------+  +---------+---------+  +-------------------+  |
|           |                      |                      ^            |
|           v                      v                      |            |
|  +--------+----------------------+----------------------+---------+  |
|  |                    Zustand State Store                          |  |
|  |  - characterSheet  - messages  - coachingPhase  - isLoading   |  |
|  +------------------------+--------------------------------------+  |
|                           |                                          |
+===========================+==========================================+
                            | HTTP POST (JSON)
                            v
+=====================================================================+
|                        BACKEND (FastAPI)                              |
|                                                                      |
|  +-------------------+                                               |
|  | /api/onboard      | --> resume_parser --> skill_analyzer          |
|  +-------------------+                   --> flat_mirror (Gemini)    |
|                                                                      |
|  +-------------------+                                               |
|  | /api/coaching/    | --> coaching_panel.run_panel()                |
|  |     panel         |                                               |
|  +-------------------+                                               |
|           |                                                          |
|           v                                                          |
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
|                    GEMINI 2.0 FLASH API                               |
|                                                                      |
|  - System instruction: coach persona                                 |
|  - Context: user input + prior coaches + character sheet             |
|  - Temperature: 0.8 (creative, varied responses)                     |
|  - Max tokens: 250 (punchy, not preachy)                             |
+=====================================================================+
```

## Key Design Decisions

### 1. Sequential Coach Execution (not parallel)

Each coach sees what the previous coaches said. This is the core differentiator -- it creates genuine debate dynamics. Chad provokes, Reeves deepens, Viktor synthesizes.

Trade-off: 3 sequential API calls (~2-3 seconds total with Flash) vs. instant parallel responses. The staggered delivery actually enhances the "panel discussion" feel.

### 2. Provocation-First Methodology

The "flat mirror" technique from career-mode-ai: generate a deliberately generic career summary, then use the user's pushback as the real signal. People can't tell you what's special about their career, but they absolutely know how to say "that's wrong."

### 3. Browser-Native Voice

Web Speech API for both recognition (STT) and synthesis (TTS). No server-side audio processing, no latency from audio streaming. Trade-off: limited to Chrome/Edge, voice quality varies.

### 4. Heuristic Skill Analysis (no AI call needed)

Character sheet generation uses keyword matching + log-scaling, not an AI call. Fast, deterministic, good enough for the RPG gamification layer. AI is reserved for the coaching conversation where it matters most.

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
                    +-------------------+
                              |
                    +---------v---------+
                    |   Gemini API      |
                    +-------------------+
```

## Data Flow: Coaching Session

```
1. Onboard
   User pastes resume --> parse_resume_text() --> analyze_skills() --> character sheet
                     \--> Gemini: generate flat mirror

2. Flat Mirror Phase
   Frontend displays generic summary
   User pushes back: "That's not what I did..."

3. Provocation Phase
   User pushback --> Panel orchestrator:
     Chad:   "Bro, then what DID you do?"
     Reeves: "I notice you got defensive about X..."
     Viktor: "The data suggests a pattern here..."

4. Free Discussion
   Ongoing coaching conversation
   Each exchange: user input --> 3 sequential coach responses
   Character sheet refines as stories emerge
```
