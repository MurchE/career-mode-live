"""Multi-agent coaching panel logic.

Orchestrates 3 coaches in sequence. Each coach sees what the previous coaches
said, creating a "building on each other" debate dynamic.

Flow:
1. User input goes to Coach 1 (Chad) with his persona + user context
2. Coach 2 (Dr. Reeves) gets persona + user context + Chad's response
3. Coach 3 (Viktor) gets persona + user context + Chad's + Reeves' responses
"""

import json
from typing import Optional

from app.gemini_service import generate, generate_json, generate_interleaved, generate_with_history
from app.personas import PANEL_COACHES, CoachPersona


def _build_context_block(
    user_input: str,
    conversation_history: list[dict],
    character_sheet: Optional[dict],
    prior_coach_responses: list[dict],
) -> str:
    """Build the context block that each coach receives."""
    parts = []

    # Character sheet context (if available)
    if character_sheet:
        parts.append("=== USER'S CHARACTER SHEET ===")
        alloc = character_sheet.get("suggested_allocation", {})
        if alloc:
            parts.append("Skill Points:")
            for skill, pts in alloc.items():
                parts.append(f"  {skill}: {pts}")
        cls = character_sheet.get("character_class", "")
        if cls:
            parts.append(f"Class: {cls}")
        parts.append("")

    # Recent conversation history (last 8 exchanges to keep context manageable)
    if conversation_history:
        parts.append("=== RECENT CONVERSATION ===")
        for entry in conversation_history[-8:]:
            role = entry.get("role", "user")
            content = entry.get("content", "")
            speaker = entry.get("coach_name", role.upper())
            parts.append(f"[{speaker}]: {content}")
        parts.append("")

    # What prior coaches said THIS round
    if prior_coach_responses:
        parts.append("=== WHAT THE OTHER COACHES JUST SAID ===")
        for resp in prior_coach_responses:
            parts.append(f"[{resp['coach_name']}]: {resp['response']}")
        parts.append("")

    # Current user input
    parts.append(f"=== USER'S MESSAGE ===\n{user_input}")

    return "\n".join(parts)


async def _get_coach_response(
    coach: CoachPersona,
    user_input: str,
    conversation_history: list[dict],
    character_sheet: Optional[dict],
    prior_coach_responses: list[dict],
) -> dict:
    """Get a single coach's response."""
    context = _build_context_block(
        user_input=user_input,
        conversation_history=conversation_history,
        character_sheet=character_sheet,
        prior_coach_responses=prior_coach_responses,
    )

    response_text = await generate(
        prompt=context,
        system_instruction=coach.system_prompt,
        temperature=0.8,
        max_tokens=250,
    )

    return {
        "coach_id": coach.id,
        "coach_name": coach.name,
        "response": response_text.strip(),
        "color": coach.color,
    }


async def run_panel(
    user_input: str,
    conversation_history: list[dict] | None = None,
    character_sheet: dict | None = None,
) -> list[dict]:
    """Run the full 3-coach panel in sequence.

    Each coach sees what the previous coaches said this round.
    Returns list of 3 response dicts.
    """
    conversation_history = conversation_history or []
    responses = []

    for coach in PANEL_COACHES:
        resp = await _get_coach_response(
            coach=coach,
            user_input=user_input,
            conversation_history=conversation_history,
            character_sheet=character_sheet,
            prior_coach_responses=responses,  # prior coaches' responses this round
        )
        responses.append(resp)

    return responses


async def run_flat_mirror(resume_text: str) -> str:
    """Generate a deliberately flat, generic career mirror.

    This is intentionally boring — it's designed to provoke the user into
    pushing back with "that's not what I actually did."
    """
    prompt = f"""Based on this resume/background, write a short (3-4 sentence) career summary
that is DELIBERATELY generic and underselling. Use corporate buzzwords, strip out any
specifics, replace concrete achievements with vague language, and make it sound like it
could describe anyone in this field. This is intentional — we want the user to react
with "that's not what I did at all" so we can probe for the real story.

Rules:
- Replace specific projects with "various initiatives"
- Replace concrete results with "drove positive outcomes"
- Make leadership sound generic ("collaborated cross-functionally")
- Strip personality and uniqueness — make it beige

Background:
{resume_text[:3000]}

Write the flat, generic summary now. Make it sound like a bad LinkedIn "About" section
written by someone who has never met the person."""

    return await generate(
        prompt=prompt,
        system_instruction="You generate deliberately generic, corporate-sounding career summaries that strip away all specificity and personality. Be boring on purpose. Your goal is to provoke the person into correcting you.",
        temperature=0.6,
        max_tokens=200,
    )


async def run_provocation(
    user_input: str,
    conversation_history: list[dict] | None = None,
    character_sheet: dict | None = None,
) -> list[dict]:
    """Run a provocation round — each coach probes from their unique angle.

    Used after the flat mirror to dig deeper into what makes the user unique.
    """
    conversation_history = conversation_history or []

    # Override system prompts for provocation mode
    provocation_addendum = """

PROVOCATION MODE: The user just pushed back on a deliberately generic career summary.
Their pushback is THE SIGNAL — the emotion, the specifics they correct, the stories they
tell to prove the summary wrong. Your job is to seize on that signal and probe DEEPER.
Ask the question that will surface the REAL story.
Focus on specifics: numbers, names, moments of crisis, the thing they're proud of
that no job description would capture. Be provocative but constructive.
Keep it to 2-3 sentences — sharp, targeted.
If the user mentions something impressive casually, CATCH IT and push for the full story."""

    responses = []
    for coach in PANEL_COACHES:
        modified_prompt = coach.system_prompt + provocation_addendum
        context = _build_context_block(
            user_input=user_input,
            conversation_history=conversation_history,
            character_sheet=character_sheet,
            prior_coach_responses=responses,
        )

        response_text = await generate(
            prompt=context,
            system_instruction=modified_prompt,
            temperature=0.85,
            max_tokens=200,
        )

        responses.append({
            "coach_id": coach.id,
            "coach_name": coach.name,
            "response": response_text.strip(),
            "color": coach.color,
        })

    return responses


async def run_narrative_synthesis(
    conversation_history: list[dict],
    character_sheet: dict | None = None,
) -> dict:
    """Synthesize the career throughline from the coaching conversation.

    This is the payoff moment — after several rounds of provocation and discussion,
    Viktor synthesizes a career narrative that captures what makes this person unique.
    """
    # Build conversation transcript
    transcript_parts = []
    for entry in conversation_history:
        role = entry.get("role", "user")
        speaker = entry.get("coach_name", role.upper())
        content = entry.get("content", "")
        transcript_parts.append(f"[{speaker}]: {content}")
    transcript = "\n".join(transcript_parts)

    char_context = ""
    if character_sheet:
        char_context = f"\nCharacter Class: {character_sheet.get('character_class', 'unknown')}"
        alloc = character_sheet.get("suggested_allocation", {})
        if alloc:
            top_skills = sorted(alloc.items(), key=lambda x: x[1], reverse=True)[:3]
            char_context += f"\nTop skills: {', '.join(f'{s}({p})' for s, p in top_skills)}"

    prompt = f"""You are a career narrative architect. You've been observing a coaching panel
(Chad the provocateur, Dr. Reeves the depth therapist, and Viktor the analyst) work with
a person to uncover their authentic career story.

Based on the conversation below, identify the throughline — the organizing narrative that
makes this person's career make sense as a story, not just a sequence of jobs.
{char_context}

=== COACHING CONVERSATION ===
{transcript}

=== YOUR TASK ===
Return a JSON object with these fields:
- "throughline": A single sentence capturing the career's organizing narrative (write it as "You are someone who...")
- "evidence": 2-3 specific moments from the conversation that support this throughline
- "reframe": 2-3 sentences you'd say directly to the person — warm, specific, using their own words where possible
- "positioning_statement": A 2-sentence career summary written in their authentic voice, not corporate voice

Return ONLY valid JSON, no markdown fences."""

    response_text = await generate_json(
        prompt=prompt,
        system_instruction="You are an expert career narrative analyst. Return a JSON object with throughline, evidence, reframe, and positioning_statement fields.",
        temperature=0.7,
        max_tokens=500,
    )

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        return {
            "throughline": response_text.strip(),
            "evidence": [],
            "reframe": response_text.strip(),
            "positioning_statement": "",
        }


async def extract_star_elements(
    user_input: str,
    conversation_history: list[dict],
    existing_elements: list[dict] | None = None,
) -> list[dict]:
    """Extract STAR framework elements from the conversation.

    Returns list of {category, content, coach_id, coach_name} dicts.
    Uses Gemini JSON mode for reliable structured output.
    """
    existing_elements = existing_elements or []

    # Build transcript of the last few exchanges
    recent = conversation_history[-6:]
    transcript_parts = []
    for entry in recent:
        role = entry.get("role", "user")
        speaker = entry.get("coach_name", role.upper())
        content = entry.get("content", "")
        transcript_parts.append(f"[{speaker}]: {content}")
    transcript = "\n".join(transcript_parts)

    # Build list of already-extracted elements so Gemini doesn't duplicate
    existing_desc = ""
    if existing_elements:
        existing_lines = []
        for el in existing_elements:
            existing_lines.append(f"  - [{el.get('category', '?').upper()}] {el.get('content', '')}")
        existing_desc = "\n\nALREADY EXTRACTED (do NOT repeat these):\n" + "\n".join(existing_lines)

    # Identify which coaches said what in the last round
    last_coaches = []
    for entry in reversed(recent):
        if entry.get("role") == "assistant" and entry.get("coach_name"):
            last_coaches.append(entry["coach_name"])
        elif entry.get("role") == "user" and last_coaches:
            break

    # Coach ID mapping
    coach_id_map = {"Chad": "chad", "Dr. Reeves": "reeves", "Viktor": "viktor"}

    prompt = f"""You are analyzing a career coaching conversation to extract STAR framework elements.

STAR framework:
- **Situation**: The context or background — where they were, what was happening, the setup
- **Task**: What they needed to accomplish, the challenge or responsibility they faced
- **Action**: What they specifically DID — their decisions, steps, leadership moves
- **Result**: The outcome, impact, metrics, what changed because of their actions

=== LATEST USER INPUT ===
{user_input}

=== RECENT CONVERSATION ===
{transcript}
{existing_desc}

=== INSTRUCTIONS ===
Extract any NEW STAR elements revealed in this exchange. Only extract elements when the user
or coaches mention concrete, specific career experiences — not generic coaching advice.

For each element, attribute it to the coach whose question or response most directly revealed it.
If the user volunteered it unprompted, attribute it to the coach who responded most relevantly.

Coach IDs: chad, reeves, viktor
Coach names: Chad, Dr. Reeves, Viktor

Return a JSON object with a single key "elements" containing an array.
Each element has: category (situation|task|action|result), content (1-2 sentences), coach_id, coach_name.
If nothing new was revealed, return {{"elements": []}}.
Return ONLY valid JSON."""

    response_text = await generate_json(
        prompt=prompt,
        system_instruction="You extract STAR framework elements from career coaching conversations. Return valid JSON only.",
        temperature=0.4,
        max_tokens=600,
    )

    try:
        data = json.loads(response_text)
        elements = data.get("elements", [])
        # Validate each element
        valid = []
        for el in elements:
            cat = el.get("category", "").lower()
            if cat in ("situation", "task", "action", "result") and el.get("content"):
                valid.append({
                    "category": cat,
                    "content": el["content"],
                    "coach_id": el.get("coach_id", "viktor"),
                    "coach_name": el.get("coach_name", "Viktor"),
                })
        return valid
    except (json.JSONDecodeError, AttributeError):
        return []


async def run_career_storyboard(
    narrative: dict,
    conversation_history: list[dict],
    character_sheet: dict | None = None,
) -> list[dict]:
    """Generate an interleaved text + image career storyboard.

    This is the core Creative Storyteller deliverable — Gemini produces
    text narrative and generated illustrations in a single output stream,
    creating a visual career story.

    Uses gemini-2.5-flash-image with response_modalities=['TEXT', 'IMAGE'].
    """
    throughline = narrative.get("throughline", "")
    positioning = narrative.get("positioning_statement", "")
    reframe = narrative.get("reframe", "")
    evidence = narrative.get("evidence", [])

    # Build key moments from conversation
    key_moments = []
    for entry in conversation_history:
        if entry.get("role") == "user" and len(entry.get("content", "")) > 50:
            key_moments.append(entry["content"][:200])

    char_class = ""
    if character_sheet:
        char_class = character_sheet.get("character_class", "")

    moments_text = "\n".join(f"- {m}" for m in key_moments[:3])

    prompt = f"""Create a visual career story with 3 illustrated chapters. For each chapter,
write a short paragraph (2-3 sentences) and generate an accompanying illustration.

The illustrations should be stylized, colorful digital art — NOT photographs.
Use a consistent visual style across all images: bold colors, clean shapes,
slightly abstract/metaphorical. Think editorial illustration, not stock photo.

Career Throughline: {throughline}

Key career moments:
{moments_text}

Positioning: {positioning}

Character archetype: {char_class.title() if char_class else "Builder"}

Structure your response as exactly 3 chapters:
1. THE ORIGIN — How the pattern first appeared (an illustration showing the seed of this person's drive)
2. THE PATTERN — The recurring theme across their career (an illustration showing the throughline in action)
3. THE FUTURE — Where this story leads next (an illustration showing potential and direction)

For each chapter: write the narrative paragraph FIRST, then generate the illustration.
Keep text concise and powerful. The illustrations should feel like chapter illustrations in a premium career book."""

    return await generate_interleaved(
        prompt=prompt,
        system_instruction="You are a career story illustrator creating a visual narrative. Produce text and illustrations interleaved — text first, then image, for each chapter.",
        temperature=0.8,
    )
