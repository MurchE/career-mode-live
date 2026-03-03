"""Multi-agent coaching panel logic.

Orchestrates 3 coaches in sequence. Each coach sees what the previous coaches
said, creating a "building on each other" debate dynamic.

Flow:
1. User input goes to Coach 1 (Chad) with his persona + user context
2. Coach 2 (Dr. Reeves) gets persona + user context + Chad's response
3. Coach 3 (Viktor) gets persona + user context + Chad's + Reeves' responses
"""

from typing import Optional

from app.gemini_service import generate, generate_with_history
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

    # Recent conversation history (last 6 exchanges)
    if conversation_history:
        parts.append("=== RECENT CONVERSATION ===")
        for entry in conversation_history[-6:]:
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
that is DELIBERATELY generic and corporate-sounding. Use buzzwords, vague language, and
make it sound like it could describe anyone in this field. This is intentional — we want
the user to react and push back.

Background:
{resume_text[:3000]}

Write the flat, generic summary now. Make it sound like a bad LinkedIn "About" section."""

    return await generate(
        prompt=prompt,
        system_instruction="You generate deliberately generic, corporate-sounding career summaries. Be boring on purpose.",
        temperature=0.5,
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

PROVOCATION MODE: The user just pushed back on a generic career summary.
Your job is to probe DEEPER. Ask the question that will surface the REAL story.
Focus on specifics: numbers, names, moments of crisis, the thing they're proud of
that no job description would capture. Be provocative but constructive.
Keep it to 1-2 sentences — sharp, targeted."""

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
