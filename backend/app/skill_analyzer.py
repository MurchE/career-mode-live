"""Heuristic skill analyzer for character sheet generation.

Simplified version from career-mode-ai. Maps resume text to 6 skill
dimensions and assigns point budgets for the RPG character sheet.
"""

import math
import re
from typing import Dict, Any

SKILL_KEYWORDS = {
    "technical": [
        "python", "javascript", "typescript", "java", "c++", "go", "rust",
        "react", "vue", "angular", "node", "django", "fastapi", "flask",
        "sql", "postgresql", "mongodb", "redis", "docker", "kubernetes",
        "aws", "gcp", "azure", "terraform", "git", "api", "backend", "frontend",
        "full-stack", "software", "engineering", "development", "programming",
        "architecture", "system design", "microservices", "debugging",
    ],
    "leadership": [
        "lead", "manager", "director", "vp", "head of", "chief",
        "team", "mentor", "coach", "supervise", "hire", "recruit",
        "performance review", "1:1", "strategic", "vision", "culture",
    ],
    "communication": [
        "present", "presentation", "public speaking", "write", "writing",
        "documentation", "blog", "article", "stakeholder", "client",
        "negotiate", "influence", "collaborate", "cross-functional",
    ],
    "analytical": [
        "data", "analysis", "analytics", "statistics", "machine learning",
        "ai", "research", "experiment", "hypothesis", "metrics", "kpi",
        "dashboard", "insights", "forecast", "model", "algorithm",
    ],
    "creative": [
        "design", "ui", "ux", "user experience", "figma", "sketch",
        "prototype", "wireframe", "visual", "creative", "innovation",
        "product", "feature", "ideation", "brainstorm",
    ],
    "operational": [
        "project management", "agile", "scrum", "kanban", "jira",
        "delivery", "deadline", "milestone", "budget", "resource",
        "process", "efficiency", "optimization", "automation", "devops",
        "ci/cd", "deployment", "monitoring", "incident", "on-call",
    ],
}

CLASS_MAPPING = {
    ("technical", "analytical"): "hacker",
    ("analytical", "technical"): "scientist",
    ("communication", "creative"): "bard",
    ("leadership", "operational"): "paladin",
    ("operational", "technical"): "ranger",
    ("creative", "technical"): "artificer",
}

PRIMARY_TO_CLASS = {
    "technical": "hacker",
    "analytical": "scientist",
    "communication": "bard",
    "leadership": "paladin",
    "operational": "ranger",
    "creative": "artificer",
}


def _estimate_years(text: str) -> int:
    """Estimate years of experience from text."""
    year_pattern = r"\b((?:19|20)\d{2})\b"
    years = re.findall(year_pattern, text)
    if len(years) >= 2:
        years_int = [int(y) for y in years if int(y) <= 2026]
        if years_int:
            return max(0, min(2026 - min(years_int), 40))
    exp_patterns = [
        r"(\d+)\+?\s*years?\s*(of)?\s*experience",
        r"experience:\s*(\d+)\s*years?",
    ]
    for pattern in exp_patterns:
        match = re.search(pattern, text.lower())
        if match:
            return int(match.group(1))
    return 0


def analyze_skills_from_text(parsed_data: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze skills from parsed data and build a character sheet."""
    text = parsed_data.get("raw_text", "").lower()
    skills_list = parsed_data.get("skills", [])
    years_exp = parsed_data.get("years_experience", 0)
    if years_exp == 0:
        years_exp = _estimate_years(text)

    # Point budget
    base_points = 100
    total_budget = base_points + (years_exp * 3)

    # Score categories by keyword matches
    skills_text = " ".join(skills_list).lower()
    raw_scores: Dict[str, int] = {}
    for category, keywords in SKILL_KEYWORDS.items():
        score = 0
        for kw in keywords:
            if kw in text:
                score += 1
            if kw in skills_text:
                score += 2
        raw_scores[category] = score
    total_raw = sum(raw_scores.values())

    # Log-scale to compress differences
    log_scores = {cat: math.log1p(s) for cat, s in raw_scores.items()}
    total_log = sum(log_scores.values())

    num_cats = len(SKILL_KEYWORDS)
    max_per = int(total_budget * 0.40)
    min_per = 5

    if total_log == 0:
        per = total_budget // num_cats
        suggested = {cat: per for cat in SKILL_KEYWORDS}
        suggested["technical"] += total_budget - (per * num_cats)
    else:
        suggested: Dict[str, float] = {cat: float(min_per) for cat in log_scores}
        distributable = total_budget - (min_per * num_cats)

        free_cats = list(log_scores.keys())
        free_weight = sum(log_scores[c] for c in free_cats)
        for cat in free_cats:
            extra = (log_scores[cat] / free_weight) * distributable if free_weight > 0 else distributable / len(free_cats)
            extra = min(extra, max_per - min_per)
            suggested[cat] = min_per + extra

        # Round to integers, preserve budget
        int_suggested = {cat: int(pts) for cat, pts in suggested.items()}
        remainders = {cat: suggested[cat] - int_suggested[cat] for cat in suggested}
        shortfall = total_budget - sum(int_suggested.values())
        for cat in sorted(remainders, key=remainders.get, reverse=True):
            if shortfall <= 0:
                break
            int_suggested[cat] += 1
            shortfall -= 1
        suggested = int_suggested

    sorted_cats = sorted(suggested.items(), key=lambda x: x[1], reverse=True)
    primary = sorted_cats[0][0]
    secondary = sorted_cats[1][0]
    character_class = CLASS_MAPPING.get((primary, secondary), PRIMARY_TO_CLASS.get(primary, "ranger"))

    return {
        "suggested_allocation": suggested,
        "total_budget": total_budget,
        "character_class": character_class,
        "primary_stat": primary,
        "secondary_stat": secondary,
        "confidence": min(0.3 + (total_raw / 50), 0.95),
        "name": parsed_data.get("name", "Adventurer"),
        "title": parsed_data.get("title", "Professional"),
        "years_experience": years_exp,
    }
