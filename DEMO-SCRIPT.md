# Demo Script — Career Mode Live (4 minutes)

**Key principle from hackathon judges:** Demo the payoff, not the setup.
Start in the middle. Never show plumbing when you have magic to show.

---

## 0:00-0:30 — Architecture + Hook (30 sec)

**Show:** Architecture diagram on screen

**Narrate:**
> "Career Mode Live puts you on a panel with three AI coaches who debate each other about your career. But here's the twist — they start by generating a deliberately wrong summary of your career. Your frustration IS the coaching."

**Key visual:** Show the 3 coach avatars (Chad, Reeves, Viktor) with their distinct colors.

---

## 0:30-1:00 — The Flat Mirror (30 sec)

**Show:** App already onboarded. The "Career Summary Report" card is visible.

**Narrate:**
> "Here's what the panel generated from my resume. Listen to this..."

**Read the flat mirror aloud** (it should be hilariously generic):
> "Murch is an experienced professional with a background in leveraging technology to support organizational objectives. At Visa, Murch contributed to various initiatives, driving positive outcomes..."

**Pause, then react genuinely:**
> "This is deliberately terrible. Watch what happens when I push back."

---

## 1:00-2:00 — The Pushback + Panel Pounce (60 sec)

**Type or speak:**
> "That's not what I did at all. I didn't 'contribute to various initiatives.' I built an AI-powered fraud detection system from scratch that reduced false positives by 40%. And at Deloitte before that, I automated their entire audit workflow in Python — nobody asked me to, I just couldn't watch people waste their lives on manual spreadsheets."

**Wait for panel response. Show the staggered rendering (800ms between coaches).**

**Highlight on screen as they appear:**
- **Chad (red):** Catches the understatement, pushes for numbers
- **Dr. Reeves (purple):** Notices the pattern — "you keep volunteering for broken systems"
- **Viktor (blue):** Synthesizes: "Your career algorithm prioritizes complexity and rescue"

**Narrate:**
> "Notice how each coach builds on what the previous one said. They're debating each other, not just responding to me."

---

## 2:00-2:40 — Deeper Probing (40 sec)

**Respond to the panel (type or speak):**
> "The emotional payoff? I hate watching smart people waste time on dumb manual work. At both companies it was the same — I saw talented engineers stuck doing reconciliation or manual fraud review, and I built systems so they could work on real problems."

**Wait for panel response. Highlight one specific moment of inter-coach disagreement.**

**Narrate:**
> "See how Dr. Reeves reframes this as 'empathy expressed through engineering' while Viktor calls it 'a compulsion worth auditing.' The panel doesn't agree — and that tension is where the insight lives."

---

## 2:40-3:20 — The Synthesis Reveal (40 sec)

**Click "Synthesize Throughline" button.**

**Wait for the narrative synthesis card to appear.**

**Show the throughline card:** Orange border, clear structure with:
- **Throughline:** "You are someone who..."
- **Evidence:** Direct quotes from the conversation
- **Reframe:** In their own words
- **Positioning statement:** Career summary in authentic voice

**Narrate:**
> "After two rounds, the panel synthesizes a career throughline I never would have written myself. This isn't a resume bullet — it's a narrative I can actually use."

**Read the positioning statement aloud.**

---

## 3:20-3:50 — Tech Stack + Voice Demo (30 sec)

**Show:** Quick voice input demo — click mic, say a short sentence, show it transcribed.

**Narrate:**
> "Voice input via Web Speech API for hands-free coaching. Each coach has a distinct voice through Google Cloud Text-to-Speech."

**Click "Listen" on one coach's response — play the distinct TTS voice.**

**Show character sheet sidebar briefly** — radar chart, skill distribution.

---

## 3:50-4:00 — Close (10 sec)

**Narrate:**
> "Every AI career tool helps you write a resume. Career Mode Live helps you figure out what your career story actually is. Built with Gemini 2.5 Flash, Google Cloud TTS, and the provocation-first coaching methodology."

**Show:** Logo + "Built for the Gemini Live Agent Challenge"

---

## Tips for Recording

1. **Do multiple takes.** Voice input might fail; Gemini might be slow. Use the best take.
2. **Pre-warm the API.** Hit the health endpoint before recording to ensure the Gemini client is initialized.
3. **Have a backup text input ready.** If voice fails, type. Say "and of course you can also type" and move on.
4. **Use Chrome.** Web Speech API works best in Chrome.
5. **Full screen the app.** No browser chrome, no taskbar.
6. **Pre-load with a real resume.** Your actual career data makes the coaching responses more compelling.
7. **Record at 1080p** — hackathon judges watch on laptops, not 4K monitors.
8. **Don't explain the tech stack in the first 2 minutes.** Show the magic first, explain after.
