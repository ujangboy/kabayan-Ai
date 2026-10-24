import json
import re
import html

# Control characters (keep \t \n \r)
_CTRL_CHARS_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')
# Hex escapes like \x20
_HEX_ESC_RE = re.compile(r'\\x([0-9a-fA-F]{2})')
# Stray backslash before a single bad letter (not a real LaTeX command)
# Protected: \i \j (valid no-arg LaTeX macros) and any \word{...} or \\ 
_BAD_ESC_RE = re.compile(r'\\([a-hkmnprtwxz])(?![a-zA-Z{])')
# Multiple horizontal spaces
_SPACES_RE = re.compile(r'[ \t]{2,}')
_NBSP_RE = re.compile(r'\u00a0')


def sanitize_output(s) -> str:
    """Clean AI-generated text: control chars, stray escapes, hex codes,
    HTML entities, whitespace, and unbalanced LaTeX $ signs."""
    if not isinstance(s, str) or not s:
        return s or ""
    # 1. Hex escapes -> decoded char (printable) or space
    def _hex_replace(m):
        ch = chr(int(m.group(1), 16))
        return ch if ch.isprintable() and ch != "\\" else " "
    s = _HEX_ESC_RE.sub(_hex_replace, s)
    # 2. Escape sequence \c \o \x ... -> drop the stray backslash
    s = _BAD_ESC_RE.sub(r'\1', s)
    # 3. \" -> " unless it starts a LaTeX umlaut (\"{o})
    s = re.sub(r'\\"(?!{)', '"', s)
    # 4. Control characters (bell, backspace, etc.)
    s = _CTRL_CHARS_RE.sub('', s)
    # 5. HTML entities
    s = html.unescape(s)
    # 6. Whitespace: normalize newlines + collapse multiple horizontal spaces
    s = s.replace('\r\n', '\n').replace('\r', '\n')
    s = _NBSP_RE.sub(' ', s)
    s = _SPACES_RE.sub(' ', s)
    # 7. Balance LaTeX $ signs: odd count -> drop the last $
    if s.count('$') % 2 == 1:
        idx = s.rfind('$')
        if idx >= 0:
            s = s[:idx] + s[idx + 1:]
    return s.strip()


def sanitize_all_strings(data):
    """Recursively sanitize every string in a parsed JSON structure."""
    if isinstance(data, str):
        return sanitize_output(data)
    if isinstance(data, list):
        return [sanitize_all_strings(d) for d in data]
    if isinstance(data, dict):
        return {k: sanitize_all_strings(v) for k, v in data.items()}
    return data


def sanitize_json_str(s: str) -> str:
    """Iteratively fix invalid JSON escapes (e.g. latex commands like \\cap)."""
    s = re.sub(r',\s*([}\]])', r'\1', s)
    max_passes = 30
    for _ in range(max_passes):
        try:
            # strict=False mengizinkan newline literal di dalam string JSON.
            # Model kadang menulis paragraf soal tanpa escape \n.
            json.loads(s, strict=False)
            return s
        except json.JSONDecodeError as e:
            if "escape" not in str(e).lower():
                raise
            pos = e.pos
            if pos is None or pos >= len(s):
                raise
            # Find the backslash that starts this escape
            bs = pos
            while bs > 0 and s[bs - 1] == '\\':
                bs -= 1
            # Double the first backslash of the sequence
            s = s[:bs] + '\\' + s[bs:]
            continue
    return s


def extract_json(raw: str) -> str:
    """Extract the outermost JSON object/array from an AI response.

    Model sering membungkus JSON dengan ```json atau teks pembuka. Pemilihan
    bracket harus memakai bracket pertama yang muncul, bukan selalu array:
    objek ``{"items": [...]}`` sebelumnya salah dipotong menjadi array di
    dalamnya. Brace di dalam string juga tidak boleh dihitung.
    """
    s = raw.strip()
    for pat in [r'```json\s*([\s\S]*?)\s*```', r'```\s*([\s\S]*?)\s*```']:
        m = re.search(pat, s)
        if m:
            s = m.group(1).strip()
            break

    start = next((i for i, ch in enumerate(s) if ch in "[{"), None)
    if start is None:
        return s

    opening = s[start]
    closing = "}" if opening == "{" else "]"
    depth = 0
    in_string = False
    escaped = False

    for i in range(start, len(s)):
        ch = s[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
        elif ch == opening:
            depth += 1
        elif ch == closing:
            depth -= 1
            if depth == 0:
                return s[start:i + 1]

    # JSON terpotong / tidak seimbang — biarkan parser pelapor error yang jelas.
    return s[start:]


def parse_ai_json(response, label: str = "AI") -> dict | list:
    json_str = extract_json(str(response))
    json_str = sanitize_json_str(json_str)
    data = json.loads(json_str, strict=False)
    return sanitize_all_strings(data)
