"""Basic resume text parser — extracts structured data from plain text.

For the hackathon MVP, we accept plain text input (pasted resume or spoken intro).
No PDF/DOCX parsing needed since voice-first.
"""

import re
from typing import Dict, Any, List


def parse_resume_text(text: str) -> Dict[str, Any]:
    """Parse plain text resume/background into structured data."""
    return {
        "raw_text": text,
        "name": _extract_name(text),
        "title": _extract_title(text),
        "summary": _extract_summary(text),
        "years_experience": _estimate_years(text),
        "skills": _extract_skills(text),
        "work_experience": [],
        "education": [],
    }


def _extract_name(text: str) -> str:
    """Heuristic name extraction from first few lines."""
    # Check for explicit "Name: ..." pattern
    match = re.search(r"(?:name|Name)\s*:\s*(.+)", text)
    if match:
        return match.group(1).strip()

    lines = text.strip().split("\n")
    for line in lines[:5]:
        line = line.strip()
        if line and len(line.split()) <= 4 and not any(c.isdigit() for c in line):
            if "@" not in line and "http" not in line.lower():
                return line
    return "Unknown"


def _extract_title(text: str) -> str:
    """Extract job title from text."""
    # Check for explicit "Title: ..." pattern
    match = re.search(r"(?:title|Title)\s*:\s*(.+)", text)
    if match:
        return match.group(1).strip()

    # Try common title patterns: "Senior Software Engineer at Google"
    title_pattern = r"(?:^|,\s*)((?:Senior\s+|Staff\s+|Lead\s+|Principal\s+|Junior\s+|Chief\s+|VP\s+of\s+)?(?:Software|Data|ML|AI|DevOps|Cloud|Full[\s-]?Stack|Front[\s-]?End|Back[\s-]?End|Platform|Infrastructure|Site Reliability|Product|Engineering|Technical|Solutions|Systems)?\s*(?:Engineer|Developer|Manager|Designer|Analyst|Architect|Scientist|Consultant|Director|Lead|Officer|Founder)(?:\s+\w+)?)"
    match = re.search(title_pattern, text, re.IGNORECASE)
    if match:
        title = match.group(1).strip()
        # Cap at reasonable length
        if len(title) < 60:
            return title

    title_keywords = [
        "engineer", "developer", "manager", "designer", "analyst",
        "architect", "lead", "director", "scientist", "consultant",
        "founder", "cto", "ceo", "vp",
    ]
    lines = text.split("\n")
    for line in lines[:10]:
        line_lower = line.lower()
        # Only return short lines that contain a title keyword
        if len(line.strip()) < 60:
            for kw in title_keywords:
                if kw in line_lower:
                    return line.strip()
    return "Professional"


def _extract_summary(text: str) -> str:
    """Extract a summary paragraph."""
    # Check for explicit "Background: ..." pattern
    match = re.search(r"(?:background|Background|summary|Summary)\s*:\s*(.+)", text)
    if match:
        return match.group(1).strip()

    lines = text.split("\n")
    for line in lines[1:15]:
        line = line.strip()
        if 50 < len(line) < 500:
            return line
    return ""


def _estimate_years(text: str) -> int:
    """Estimate years of experience."""
    # Explicit mention
    match = re.search(r"(?:years?\s*(?:of\s*)?experience)\s*:\s*(\d+)", text.lower())
    if match:
        return int(match.group(1))

    exp_patterns = [
        r"(\d+)\+?\s*years?\s*(?:of\s*)?experience",
        r"experience:\s*(\d+)\s*years?",
    ]
    for pattern in exp_patterns:
        match = re.search(pattern, text.lower())
        if match:
            return int(match.group(1))

    # Try to find year range
    year_pattern = r"\b((?:19|20)\d{2})\b"
    years = re.findall(year_pattern, text)
    if len(years) >= 2:
        years_int = [int(y) for y in years if int(y) <= 2026]
        if years_int:
            return max(0, min(2026 - min(years_int), 40))

    return 0


COMMON_SKILLS = [
    "python", "javascript", "typescript", "java", "c++", "go", "rust",
    "react", "vue", "angular", "node.js", "django", "fastapi", "flask",
    "sql", "postgresql", "mongodb", "redis", "docker", "kubernetes",
    "aws", "gcp", "azure", "terraform", "git", "ci/cd",
    "machine learning", "data science", "agile", "scrum",
    "leadership", "communication", "project management",
]


def _extract_skills(text: str) -> List[str]:
    """Extract recognized skills from text."""
    text_lower = text.lower()
    return [s for s in COMMON_SKILLS if s in text_lower]
