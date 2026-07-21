#!/usr/bin/env python3
"""Convert the <text> in a lockup SVG to vector outlines (paths).

The designer's exports keep the wordmark as live <text> in Space Grotesk / Spline Sans
Mono. Embedding the font makes it render on desktop, but an SVG loaded through <img> on
iOS Safari runs in a restricted mode where @font-face often does not apply — so the
wordmark falls back to a system font on phones. Converting the text to paths removes the
font dependency entirely: it then renders identically everywhere, including in <img>.

Each <text> is replaced in place by a <path> in the same coordinate space, so whatever
transform the parent group applies to the text applies identically to the outline.

Usage: python3 scripts/outline-logo.py IN.svg OUT.svg [--strip-fill '#191919']
"""

import os
import re
import sys
import xml.etree.ElementTree as ET

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONT_DIR = os.path.expanduser("~/Library/Fonts")
FONT_FILES = {
    "Space Grotesk": "SpaceGrotesk-Regular.ttf",
    "Spline Sans Mono": "SplineSansMono-Regular.ttf",
}

_cache = {}


def font_for(family):
    if family not in _cache:
        path = os.path.join(FONT_DIR, FONT_FILES[family])
        _cache[family] = TTFont(path)
    return _cache[family]


def unescape(s):
    return s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")


def outline_text(text_el):
    style = re.search(r'style="([^"]*)"', text_el).group(1)
    family = re.search(r"font-family:'([^']+)'", style).group(1)
    size = float(re.search(r"font-size:([\d.]+)", style).group(1))
    fill_m = re.search(r"fill:\s*(#[0-9a-fA-F]+)", style)
    fill = fill_m.group(1) if fill_m else "#000000"
    ls_m = re.search(r"letter-spacing:\s*([\d.]+)", style)
    letter_spacing = float(ls_m.group(1)) if ls_m else 0.0

    font = font_for(family)
    upem = font["head"].unitsPerEm
    scale = size / upem
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    hmtx = font["hmtx"]

    commands = []
    for tspan in re.finditer(r"<tspan\b([^>]*)>(.*?)</tspan>", text_el, re.S):
        attrs, raw = tspan.group(1), tspan.group(2)
        content = unescape(re.sub(r"<[^>]+>", "", raw))
        x = float(re.search(r'\sx="([\d.]+)"', attrs).group(1))
        y = float(re.search(r'\sy="([\d.]+)"', attrs).group(1))
        pen_x = x
        for ch in content:
            gname = cmap.get(ord(ch))
            if gname is None:
                pen_x += size * 0.5 + letter_spacing
                continue
            advance = hmtx[gname][0]
            if ch != " ":
                svg_pen = SVGPathPen(glyphs)
                # font units are y-up from the baseline; SVG is y-down, so flip y and
                # translate to the baseline position (pen_x, y).
                glyphs[gname].draw(TransformPen(svg_pen, (scale, 0, 0, -scale, pen_x, y)))
                d = svg_pen.getCommands()
                if d:
                    commands.append(d)
            pen_x += advance * scale + letter_spacing

    return '<path d="{}" fill="{}"/>'.format(" ".join(commands), fill)


def main():
    src, out = sys.argv[1], sys.argv[2]
    strip_fill = None
    if "--strip-fill" in sys.argv:
        strip_fill = sys.argv[sys.argv.index("--strip-fill") + 1]

    svg = open(src, encoding="utf-8").read()
    if strip_fill:
        svg = re.sub(
            r'<rect\b[^>]*?fill="' + re.escape(strip_fill) + r'"[^>]*?/?>', "", svg, flags=re.S
        )
    svg = re.sub(r"<text\b.*?</text>", lambda m: outline_text(m.group(0)), svg, flags=re.S)

    open(out, "w", encoding="utf-8").write(svg)
    ET.parse(out)  # fail loudly on malformed output

    check = open(out, encoding="utf-8").read()
    assert "<text" not in check, "a <text> element survived"
    assert "font-family" not in check, "a font-family reference survived"
    print("outlined {} ({} bytes) — no <text>, no font-family".format(out, os.path.getsize(out)))


if __name__ == "__main__":
    main()
