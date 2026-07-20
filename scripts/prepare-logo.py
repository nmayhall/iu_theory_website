#!/usr/bin/env python3
"""Turn a designer SVG lockup into a self-contained, theme-ready asset.

Does three things that a raw export needs before it is safe to ship:

1. Removes a flat background rect (so the mark sits on the page, not a box).
2. Optionally recolours fills/strokes (to derive a light-mode variant from a
   dark-mode export, since the designer only supplied the reversed treatment).
3. Embeds every referenced font as a subset base64 @font-face. The lockups set
   the wordmark in live <text> using Space Grotesk / Spline Sans Mono — neither a
   default system font — so without embedding the wordmark silently falls back to
   a system font on visitors' machines. Both fonts are OFL, which permits this.

Output is validated as XML before writing.

Usage:
    python3 scripts/prepare-logo.py IN.svg OUT.svg [--strip-fill '#191919'] \
        [--recolor OLD=NEW ...]
"""

import base64
import io
import os
import re
import sys
import xml.etree.ElementTree as ET

from fontTools import subset
from fontTools.ttLib import TTFont

FONT_DIR = os.path.expanduser("~/Library/Fonts")

# Map a font-family name (as it appears in the SVG) to a local TTF and the
# weight the lockups actually use (Regular for both).
FONT_FILES = {
    "Space Grotesk": "SpaceGrotesk-Regular.ttf",
    "Spline Sans Mono": "SplineSansMono-Regular.ttf",
    "Open Sans": "OpenSans-Regular.ttf",
}


def strip_background(svg: str, fill: str) -> str:
    # Inkscape writes multi-line <rect ... fill="#191919" ... /> — match across newlines.
    pattern = re.compile(r"<rect\b[^>]*?fill=\"" + re.escape(fill) + r"\"[^>]*?/?>", re.S)
    new, n = pattern.subn("", svg)
    if n == 0:
        print(f"  warning: no <rect fill=\"{fill}\"> found to strip", file=sys.stderr)
    return new


def recolor(svg: str, pairs: list[tuple[str, str]]) -> str:
    for old, new in pairs:
        # Match the colour in both fill:#xxx (CSS) and fill="#xxx" (attr) forms,
        # for fill and stroke, case-insensitively.
        svg = re.sub(
            r"((?:fill|stroke)\s*[:=]\s*\"?)" + re.escape(old),
            lambda m: m.group(1) + new,
            svg,
            flags=re.I,
        )
    return svg


def used_chars(svg: str) -> str:
    text = "".join(re.findall(r"<tspan[^>]*>(.*?)</tspan>", svg, re.S))
    if not text:
        text = "".join(re.findall(r"<text[^>]*>([^<]*)</text>", svg, re.S))
    for a, b in [("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">")]:
        text = text.replace(a, b)
    return text


def embed_fonts(svg: str) -> str:
    families = sorted(set(re.findall(r"font-family:\s*'([^']+)'", svg)))
    if not families:
        return svg

    chars = "".join(sorted(set(used_chars(svg)) - {"\n", "\t"}))
    faces = []
    for fam in families:
        ttf = FONT_FILES.get(fam)
        if not ttf:
            print(f"  warning: no local file mapped for font '{fam}' — leaving as-is", file=sys.stderr)
            continue
        path = os.path.join(FONT_DIR, ttf)
        if not os.path.exists(path):
            print(f"  warning: {path} not found — '{fam}' will fall back", file=sys.stderr)
            continue
        font = TTFont(path)
        ss = subset.Subsetter(subset.Options(layout_features=["*"], notdef_outline=True))
        ss.populate(text=chars)
        ss.subset(font)
        font.flavor = "woff2"
        buf = io.BytesIO()
        font.save(buf)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        faces.append(
            f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:400;"
            f"src:url(data:font/woff2;base64,{b64}) format('woff2');}}"
        )
        print(f"  embedded '{fam}' ({len(b64) * 3 // 4 // 1024} KB woff2, {len(chars)} glyphs)")

    if not faces:
        return svg
    style = "<style>" + "".join(faces) + "</style>"
    svg, n = re.subn(r"(<svg[^>]*>)", r"\1" + style, svg, count=1)
    return svg


def main() -> int:
    args = sys.argv[1:]
    src, out = args[0], args[1]
    strip_fill = None
    pairs: list[tuple[str, str]] = []
    i = 2
    while i < len(args):
        if args[i] == "--strip-fill":
            strip_fill = args[i + 1]
            i += 2
        elif args[i] == "--recolor":
            old, new = args[i + 1].split("=")
            pairs.append((old, new))
            i += 2
        else:
            print(f"unknown arg {args[i]}", file=sys.stderr)
            return 2

    svg = open(src, encoding="utf-8").read()
    if strip_fill:
        svg = strip_background(svg, strip_fill)
    if pairs:
        svg = recolor(svg, pairs)
    svg = embed_fonts(svg)

    open(out, "w", encoding="utf-8").write(svg)
    ET.parse(out)  # fail loudly rather than emit malformed SVG
    print(f"  wrote {out} ({os.path.getsize(out) // 1024} KB), XML valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
