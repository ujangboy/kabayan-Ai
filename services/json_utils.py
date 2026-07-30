import json
import re


def sanitize_json_str(s: str) -> str:
    """Iteratively fix invalid JSON escapes (e.g. latex commands like \\cap)."""
    s = re.sub(r',\s*([}\]])', r'\1', s)
    max_passes = 10
    for _ in range(max_passes):
        try:
            json.loads(s)
            return s
        except json.JSONDecodeError as e:
            if "escape" not in str(e).lower():
                raise
            pos = e.pos
            if pos < len(s) and s[pos] == '\\':
                s = s[:pos] + '\\' + s[pos:]
                continue
            raise
    return s


def extract_json(raw: str) -> str:
    """Extract JSON array or object from AI response using bracket counting."""
    s = raw.strip()
    for pat in [r'```json\s*([\s\S]*?)\s*```', r'```\s*([\s\S]*?)\s*```']:
        m = re.search(pat, s)
        if m:
            return m.group(1).strip()
    for start_char, end_char in [('[', ']'), ('{', '}')]:
        start = s.find(start_char)
        if start >= 0:
            depth = 0
            for i, ch in enumerate(s[start:], start):
                if ch == start_char: depth += 1
                elif ch == end_char: depth -= 1
                if depth == 0:
                    return s[start:i + 1]
    return s


def parse_ai_json(response, label: str = "AI") -> dict | list:
    json_str = extract_json(str(response))
    json_str = sanitize_json_str(json_str)
    return json.loads(json_str)
