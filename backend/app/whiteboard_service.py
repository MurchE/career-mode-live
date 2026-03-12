"""
Whiteboard AI Service — Analyzes canvas screenshots and returns drawing commands.

Takes a screenshot of the user's drawing canvas, sends it to Gemini Vision,
and gets back structured drawing commands (shapes, annotations, arrows, text)
that the frontend renders with hand-drawn animated strokes.
"""

import base64
import json
import logging
from typing import Any

from .gemini_service import get_client, MODEL

logger = logging.getLogger(__name__)

# ─── Drawing Command Schema ──────────────────────────────────────────────────

DRAWING_COMMAND_SCHEMA = {
    "type": "object",
    "properties": {
        "shapes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["circle", "rect", "arrow", "text", "highlight"],
                    },
                    "x": {"type": "number"},
                    "y": {"type": "number"},
                    "width": {"type": "number"},
                    "height": {"type": "number"},
                    "radius": {"type": "number"},
                    "toX": {"type": "number"},
                    "toY": {"type": "number"},
                    "content": {"type": "string"},
                    "fontSize": {"type": "number"},
                    "color": {"type": "string"},
                    "strokeWidth": {"type": "number"},
                    "fill": {"type": "string"},
                    "label": {"type": "string"},
                },
                "required": ["type", "x", "y", "color"],
            },
        },
        "voice_response": {
            "type": "string",
            "description": "What the AI says out loud while drawing",
        },
        "thinking": {
            "type": "string",
            "description": "Brief internal reasoning (not shown to user)",
        },
    },
    "required": ["shapes", "voice_response"],
}


# ─── Prompts ──────────────────────────────────────────────────────────────────

WHITEBOARD_SYSTEM_PROMPT = """You are an AI drawing collaborator on a shared whiteboard. You can see what the user has drawn and you respond by drawing shapes, arrows, text, and annotations back on the canvas.

CRITICAL RULES:
1. You DRAW on the canvas — your primary output is visual shapes, not just text.
2. Keep your drawings spatially aware — place annotations near relevant user drawings, not on top of them.
3. Use arrows to connect related concepts.
4. Use circles to highlight important areas.
5. Use text labels to annotate.
6. Use highlights (translucent rectangles) to emphasize regions.
7. Colors: #7EE787 (green) for positive/agreements, #FF7B72 (red) for concerns/questions, #58A6FF (blue) for suggestions, #BC8CFF (purple) for connections/patterns, #F0883E (orange) for emphasis.
8. Your voice_response should be conversational — explain what you're drawing and why.
9. Place shapes in EMPTY areas of the canvas. The canvas is {width}x{height} pixels.
10. Keep annotations concise — max 3-4 words per label.

CONTEXT: {context_description}

Respond with drawing commands that visually enhance and respond to what the user drew."""

CONTEXT_DESCRIPTIONS = {
    "career_coaching": "You are a career coach. The user is drawing out their career story, skills, experiences, or goals. Help them visualize patterns, connections between experiences, skill gaps, and career trajectory. Draw arrows between related experiences, circle key themes, annotate strengths.",
    "brainstorming": "You are a brainstorming partner. The user is mapping out ideas. Help them find connections, group related concepts, identify gaps, and suggest new directions. Use arrows for relationships, circles for clusters, text for suggestions.",
    "architecture": "You are a system design partner. The user is sketching architecture. Help them identify missing components, potential bottlenecks, data flow issues, and suggest improvements. Use boxes for components, arrows for data flow, text for annotations.",
    "general": "You are a visual thinking partner. Help the user organize and develop whatever they're working on. Draw connections, highlight patterns, annotate key points.",
}


# ─── Main Analysis Function ──────────────────────────────────────────────────

async def analyze_canvas(
    image_base64: str,
    canvas_width: int,
    canvas_height: int,
    context: str = "general",
    existing_shapes: int = 0,
) -> dict[str, Any]:
    """
    Analyze a canvas screenshot and return drawing commands.

    Args:
        image_base64: Base64-encoded PNG of the canvas
        canvas_width: Canvas width in pixels
        canvas_height: Canvas height in pixels
        context: One of 'career_coaching', 'brainstorming', 'architecture', 'general'
        existing_shapes: Number of AI shapes already on canvas (to avoid overcrowding)

    Returns:
        Dict with 'shapes' (list of drawing commands) and 'voice_response' (what AI says)
    """
    context_desc = CONTEXT_DESCRIPTIONS.get(context, CONTEXT_DESCRIPTIONS["general"])

    system_prompt = WHITEBOARD_SYSTEM_PROMPT.format(
        width=canvas_width,
        height=canvas_height,
        context_description=context_desc,
    )

    # Build the multimodal prompt
    user_prompt = f"""Here is the current state of our shared whiteboard ({canvas_width}x{canvas_height} pixels).

I have already placed {existing_shapes} annotations on the canvas. {"Don't repeat what's already there — add NEW insights." if existing_shapes > 0 else "This is the first time you're seeing the user's drawing."}

Look at what the user has drawn and respond with drawing commands. Place your annotations in empty areas. Be selective — 3-6 shapes maximum. Quality over quantity.

Return your response as JSON matching the schema with 'shapes' array and 'voice_response' string."""

    VALID_SHAPE_TYPES = {"circle", "rect", "arrow", "text", "highlight"}

    try:
        from google.genai import types

        client = get_client()

        image_part = types.Part.from_bytes(
            data=base64.b64decode(image_base64),
            mime_type="image/png",
        )

        response = client.models.generate_content(
            model=MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=system_prompt),
                        image_part,
                        types.Part.from_text(text=user_prompt),
                    ],
                ),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )

        result_text = response.text
        if not result_text:
            return {"shapes": [], "voice_response": "I couldn't analyze the canvas. Could you draw something and try again?"}
        result = json.loads(result_text.strip())

        # Validate shapes
        shapes = result.get("shapes", [])
        validated_shapes = []
        for shape in shapes:
            if not isinstance(shape, dict):
                continue
            if "type" not in shape or "x" not in shape or "y" not in shape:
                continue
            # Validate type against enum
            if shape["type"] not in VALID_SHAPE_TYPES:
                continue
            # Ensure color
            if "color" not in shape:
                shape["color"] = "#7EE787"
            # Clamp all coordinates to canvas bounds
            shape["x"] = max(0, min(shape["x"], canvas_width))
            shape["y"] = max(0, min(shape["y"], canvas_height))
            if "toX" in shape:
                shape["toX"] = max(0, min(shape["toX"], canvas_width))
            if "toY" in shape:
                shape["toY"] = max(0, min(shape["toY"], canvas_height))
            # Clamp dimensions
            if "width" in shape:
                shape["width"] = max(1, min(shape["width"], canvas_width))
            if "height" in shape:
                shape["height"] = max(1, min(shape["height"], canvas_height))
            if "radius" in shape:
                shape["radius"] = max(1, min(shape["radius"], min(canvas_width, canvas_height) // 2))
            validated_shapes.append(shape)

        return {
            "shapes": validated_shapes[:8],  # Cap at 8 shapes per response
            "voice_response": result.get("voice_response", ""),
        }

    except Exception as e:
        logger.error(f"Canvas analysis error: {e}")
        return {
            "shapes": [],
            "voice_response": "I had trouble analyzing your drawing. Could you tell me what you're working on?",
            "error": str(e),
        }
