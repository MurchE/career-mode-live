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

from app.gemini_service import generate, generate_json, generate_with_history
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
