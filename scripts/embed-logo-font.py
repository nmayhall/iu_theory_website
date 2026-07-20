#!/usr/bin/env python3
"""Make a logo SVG self-contained by embedding the font it depends on.

The supplied lockup SVGs keep the wordmark as a live <text> element referencing
Open Sans Bold. Open Sans is not a default system font (notably on Windows), so on
most visitors' machines the wordmark silently falls back to a serif. Embedding a
subset of the font as a base64 @font-face makes the file render identically
everywhere while staying vector.

Open Sans is licensed Apache-2.0, which permits embedding and redistribution.

Usage:
    python3 scripts/embed-logo-font.py <in.svg> <out.svg> [font.ttf]
"""

import base64
import io
import re
import sys
import xml.etree.ElementTree as ET

from fontTools import subset
from fontTools.ttLib import TTFont

DEFAULT_FONT = "/Users/nmayhall/Library/Fonts/OpenSans-Bold.ttf"
FAMILY = "IUTheoLockup"


def text_content(svg: str) -> str:
    """Every character the SVG actually renders, so the subset stays minimal."""
    return "".join(re.findall(r"<tspan[^>]*>(.*?)</tspan>", svg, re.S)) + "".join(
        re.findall(r"<text[^>]*>([^<]*)<", svg, re.S)
    )


def main() -> int:
    src_path, out_path = sys.argv[1], sys.argv[2]
    font_path = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_FONT

    svg = open(src_path, encoding="utf-8").read()

    chars = text_content(svg)
    chars = chars.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    glyphs = sorted(set(chars) - {"\n", "\t"})
    if not glyphs:
        print("no <text> found — nothing to embed", file=sys.stderr)
        return 1

    font = TTFont(font_path)
    subsetter = subset.Subsetter(subset.Options(layout_features=["*"], notdef_outline=True))
    subsetter.populate(text="".join(glyphs))
    subsetter.subset(font)

    font.flavor = "woff2"
    buf = io.BytesIO()
    font.save(buf)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    face = (
        f"@font-face{{font-family:'{FAMILY}';font-weight:700;font-style:normal;"
        f"src:url(data:font/woff2;base64,{b64}) format('woff2');}}"
    )

    # Point the wordmark at the embedded family, keeping the original as fallback.
    svg = re.sub(
        r"font-family:\s*OpenSans-Bold,\s*'Open Sans'",
        f"font-family: '{FAMILY}', OpenSans-Bold, 'Open Sans'",
        svg,
    )

    # Prepend the @font-face to the first <style> block.
    svg, n = re.subn(r"(<style[^>]*>)", r"\1" + face, svg, count=1)
    if n == 0:
        svg = re.sub(r"(<svg[^>]*>)", r"\1<style>" + face + "</style>", svg, count=1)

    open(out_path, "w", encoding="utf-8").write(svg)

    ET.parse(out_path)  # fail loudly rather than emit malformed SVG
    print(
        f"{out_path}: embedded {len(glyphs)} glyphs "
        f"({len(b64) * 3 // 4 // 1024} KB woff2), XML valid"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
