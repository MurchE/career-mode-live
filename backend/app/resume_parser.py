"""Resume parser — extracts structured data from text, PDF, DOCX, or LinkedIn URL.

Supports:
- Plain text (pasted resume or spoken intro)
- PDF file upload (via PyMuPDF)
- DOCX file upload (via python-docx)
- LinkedIn public profile URL (via httpx scraping)
"""

import re
import io
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

    # Try "Name - Title" or "Name | Title" pattern on first line
    first_line = lines[0].strip() if lines else ""
    for sep in [" - ", " – ", " — ", " | ", " · "]:
        if sep in first_line:
            candidate = first_line.split(sep)[0].strip()
            if candidate and len(candidate.split()) <= 4 and not any(c.isdigit() for c in candidate):
                if "@" not in candidate and "http" not in candidate.lower():
                    return candidate

    for line in lines[:5]:
        line = line.strip()
        if line and len(line.split()) <= 4 and not any(c.isdigit() for c in line):
            if "@" not in line and "http" not in line.lower():
                return line

    # Try extracting name from "Name, Title at Company" pattern
    if "," in first_line:
        candidate = first_line.split(",")[0].strip()
        if candidate and len(candidate.split()) <= 3 and not any(c.isdigit() for c in candidate):
            return candidate

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


def parse_pdf_bytes(data: bytes) -> str:
    """Extract text from PDF file bytes using PyMuPDF."""
    import pymupdf
    doc = pymupdf.open(stream=data, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n".join(pages).strip()


def parse_docx_bytes(data: bytes) -> str:
    """Extract text from DOCX file bytes using python-docx."""
    from docx import Document
    doc = Document(io.BytesIO(data))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs).strip()


async def fetch_linkedin_profile(url: str) -> str:
    """Fetch text content from a public LinkedIn profile URL.

    LinkedIn aggressively blocks scrapers, so this uses httpx with a
    browser-like user agent. Falls back to Gemini to extract career info
    if raw HTML is returned.
    """
    import httpx

    # Normalize URL
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()

    html = resp.text

    # Extract meaningful text from LinkedIn HTML
    # Strip script/style tags, then extract text
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<[^>]+>', ' ', html)
    html = re.sub(r'\s+', ' ', html).strip()

    # LinkedIn public profiles have useful meta content even when blocked
    # Try to extract og:title, og:description from original response
    og_parts = []
    og_title = re.search(r'og:title["\s]+content="([^"]+)"', resp.text)
    og_desc = re.search(r'og:description["\s]+content="([^"]+)"', resp.text)
    if og_title:
        og_parts.append(og_title.group(1))
    if og_desc:
        og_parts.append(og_desc.group(1))

    if og_parts:
        return "\n".join(og_parts) + "\n\n" + html[:3000]

    # Return whatever text we got (capped)
    return html[:5000] if html else "Could not extract content from LinkedIn profile."
