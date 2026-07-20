# IU Theoretical Chemistry

Static site for the theoretical chemistry program at Indiana University, built with
[Astro](https://astro.build) and deployed to GitHub Pages.

## Local development

Requires Node 20+ (this machine has Node 24 at `~/.local/node/bin`, which is not on the
default PATH — add `export PATH="$HOME/.local/node/bin:$PATH"` to your shell profile).

```sh
npm install
npm run dev      # http://localhost:4321/iu_theory_website
npm run build    # static output in dist/
npm run preview  # serve the built site locally
```

## Checking layout

Two Puppeteer-driven checks run against the built site. Both need a preview server on
port 4322 first (they drive the copy of Chrome already installed, via `puppeteer-core` —
no browser download):

```sh
npm run build
npx astro preview --port 4322 &
npm run check:responsive   # horizontal overflow + tap-target sizes, 320px-1024px
npm run check:nav          # hamburger menu behaviour, keyboard, and no-JS fallback
```

`check:responsive` measures *effective* tap-target size by probing with
`elementFromPoint`, so links that expand their hit area with a `::after` overlay (the nav)
or a stretched link (faculty cards) are scored correctly rather than by element box alone.

Delete `scripts/` and the `puppeteer-core` devDependency if you don't want to keep them.

## Theme (light / dark)

The header has a light/dark toggle. Behaviour:

- **No choice made** → follows the OS (`prefers-color-scheme`), and tracks it live.
- **Toggle clicked** → an explicit choice, saved to `localStorage`, overriding the OS.

An inline script in `BaseLayout.astro` stamps `data-theme` on `<html>` **before first
paint**, so there is no flash of the wrong theme on reload.

All theme differences live in CSS custom properties in `global.css`, defined once in a
`:root` (light) block and once in a shared dark block. The dark block is applied via two
selectors — `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and
`:root[data-theme="dark"]` — so system-default and manual override share the same values.
Even which logo variant shows (`--show-light`/`--show-dark`) and the faculty-initials
colour are vars, so adding a themed value means editing one place.

If JS is off, the toggle button hides itself and the site follows the OS via the media
query — still fully usable, just without manual override.

## Colors (IU brand)

Verified against IU's brand guidance:

- **`--crimson: #990000`** — IU Crimson (PMS 201). Official, used as-is in light mode.
- **`--ink: #191919`** — IU Primary Black. Official.
- **Paper `#ffffff`** — IU treats Cream as functionally white, so pure white is on-brand.

**Dark mode uses a lightened crimson `#e05a5f`, not `#990000`.** This is deliberate and
necessary: pure IU Crimson on the near-black dark paper measures only 2.1:1 contrast, which
fails WCAG. `#e05a5f` reaches 5.1:1 (AA for text) while staying in the crimson family. IU
publishes no official dark-mode crimson, and their guidance explicitly requires checking
contrast, so this is the accessible reading of the brand rather than a departure from it.

## Branding

Header/hero lockups are self-contained **SVG** in `src/assets/brand/` — one file scales to
every size. `lockup-light.svg` (ink brand, crimson accents) and `lockup-dark.svg` (cream
brand) are the designer's own light and dark exports; which shows is driven by the
`--show-light`/`--show-dark` theme vars.

The lockup appears twice: small in the header on every page, and large as the `<h1>` on the
home page, where it sits *inside* the `h1` and carries the alt text so the document keeps a
real heading for screen readers and search.

**Regenerate from a new designer export with `scripts/outline-logo.py` — do not use a raw
export directly.** The exports keep the wordmark as live `<text>` in **Space Grotesk** +
**Spline Sans Mono**, neither a default system font. That fails in two ways: it falls back
to a system font on machines without those fonts, and — even with the font embedded as
`@font-face` — an SVG loaded through `<img>` on **iOS Safari** runs in a restricted mode
that ignores the embedded font, so phones show the wrong font. (Both bugs were hit in
turn; embedding fixed the first, not the second.)

`outline-logo.py` converts the text to vector paths, removing the font entirely, so the
mark renders identically everywhere including in `<img>` on iOS. It replaces each `<text>`
in place (so the parent transform still applies), optionally strips a baked background
rect, and asserts the output has no `<text>` or `font-family` left:

```sh
python3 scripts/outline-logo.py <export.svg> src/assets/brand/lockup-light.svg [--strip-fill '#191919']
```

The outlined files are larger (~31 KB vs ~4 KB) because glyph path data is verbose, but
they are one cached request that gzips well, and correctness on every device beats the few
KB. The fonts (Space Grotesk, Spline Sans Mono) must be installed locally to run the
script — both are on Google Fonts, OFL-licensed. Requires `fonttools` (`pip install fonttools`).

Favicons in `public/` are rasterised from `icon-dark.svg` composited on IU crimson, so the
mark stays legible against both light and dark browser chrome. Regenerate if the artwork
changes.

**Known cosmetic inconsistency:** the two designer files place the crimson accent
differently — light mode crimsons the "INDIANA UNIVERSITY" subtitle, dark mode crimsons the
bracket marks. Each reads well on its own; harmonising them (if wanted) is a change to the
source SVGs, not the site.

**Validate any hand-edited SVG.** A malformed SVG still builds and still serves HTTP 200,
failing only at decode time as a broken image — `npm run check:responsive` catches exactly
that by checking every visible image's `naturalWidth`.

The square `icon-light.svg` / `icon-dark.svg` are from an earlier concept set and are used
only to generate the favicons. The current lockups are ~5.7:1 and cannot serve as a
square app icon.

**Trademark approval still outstanding.** The lockup incorporates the IU trident, a
registered university trademark. IU runs official "Signatures" and "Marketing Lockups"
programs, which implies unit-level lockups are centrally governed. Confirm with IU
University Communications and Marketing (ucm.iu.edu) before this goes public.

## Publications

The whole publication list is one file: [`src/data/publications.bib`](src/data/publications.bib).
To update it, export BibTeX from Zotero, Google Scholar, EndNote, or Mendeley, drop it in,
and commit. The site regroups by year and re-renders on build — nothing else to edit.

```sh
# after replacing the .bib
npm run build
```

Titles link out via DOI when present, otherwise via the entry's `url`. Faculty names are
bolded automatically in author lists.

**Author matching** works on surname. If a faculty member has published under another
name form, add it to `authorAliases` in their markdown file — Raghavachari's 1980
basis-set paper is authored "R. Krishnan", so `raghavachari.md` carries:

```yaml
authorAliases:
  - Krishnan
```

The `/publications` page shows a per-person count, and a faculty member with zero matches
says so explicitly rather than being silently omitted — that is usually the signal that a
name form is missing from `authorAliases`.

**Why not auto-import from Google Scholar?** Scholar has no public API, and scraping it
breaches their terms and gets CAPTCHA-blocked, which would break builds unpredictably.
Automated lookup via OpenAlex/ORCID was tested and rejected for a different reason: name
search is unreliable (one faculty member returned no correct match, another was split
across two profiles, a third was listed at the wrong institution). Pinning each person to
an ORCID iD would make that reliable — worth revisiting if maintaining the `.bib` becomes
a chore.

## Graphics

Three levels, in increasing order of authenticity:

1. **Motifs** (`src/assets/motifs/*.svg`) — abstract geometric artwork, one per research
   thrust, selected by the `motif` field. Inline SVG inheriting `currentColor`, so they
   follow the theme. Deliberately decorative: they imply no data or result.
2. **Real figures** — set `figure` on a research entry to a file beside its markdown, plus
   `figureAlt` and optionally `figureCredit`. A real figure **replaces** the motif
   automatically. This is the preferred end state.
   ```yaml
   figure: ./tpsci-scheme.png
   figureAlt: Schematic of the tensor product selected CI scheme
   figureCredit: Adapted from Braunscheidel et al., JCTC 2023
   ```
3. **Photography** — faculty headshots live beside their markdown (`photo:`). Check reuse
   rights before publishing any figure from a paper; publisher policies vary even for your
   own work.

## Math (LaTeX)

Markdown bodies in any collection support LaTeX: `$inline$` and `$$display$$`.

```markdown
The ansatz is $|\Psi\rangle = e^{\hat{T}}|\Phi_0\rangle$.

$$
\hat{T} = \hat{T}_1 + \hat{T}_2 + \cdots
$$
```

KaTeX renders at **build time**, so no math JavaScript reaches the browser — only the
KaTeX stylesheet, imported once in `BaseLayout.astro`. Display equations get their own
horizontal scroll container (`.katex-display` in `global.css`) because a wide equation
cannot reflow and would otherwise widen the whole page on a phone.

**Astro 7 note:** Sätteri is the default Markdown processor and does not accept remark or
rehype plugins. Passing `markdown.remarkPlugins` directly — the form shown in essentially
every LaTeX-in-Astro guide online, all written before Astro 7 — fails the build. This
project instead opts into the `unified` processor from `@astrojs/markdown-remark`; see
the comment in [`astro.config.mjs`](astro.config.mjs). That choice replaces Sätteri for
all `.md` and `.mdx` files.

## Navigation

The header nav collapses into a hamburger menu below 48rem (768px). The breakpoint appears
in two places that must stay in sync: the `@media` blocks in `src/styles/global.css` and
the `matchMedia` query in the inline script in
[`src/layouts/BaseLayout.astro`](src/layouts/BaseLayout.astro).

The collapsed state is applied only under a `.js` class set before first paint, so if the
script fails the nav degrades to a plain wrapped list instead of hiding behind a dead
button. Adding a nav item is a one-line change to the `nav` array in `BaseLayout.astro`.

## Editing content

All content lives in `src/content/` as markdown files. Schemas are defined and validated
in [`src/content.config.ts`](src/content.config.ts) — a file that violates its schema
fails the build rather than rendering incorrectly.

### Faculty — `src/content/faculty/*.md`

The filename becomes the slug (`jane-doe.md` → `jane-doe`), which is what research
entries reference.

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Full display name |
| `title` | yes | e.g. "Professor of Chemistry" |
| `photo` | no | Relative path to an image beside the `.md` file, e.g. `./jane-doe.jpg`. Omitted → initials placeholder |
| `researchAreas` | yes | List of strings, shown as tags |
| `personalSite` | no | Must be a valid URL |
| `googleScholar` | no | Must be a valid URL |
| `order` | no | Sort order on /people, lower first (default 999) |

To add a headshot, drop the image file next to the markdown file and set
`photo: ./filename.jpg`. Astro optimizes and hashes it at build time.

### Research — `src/content/research/*.md`

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | Thrust title |
| `summary` | yes | One- or two-sentence description |
| `faculty` | no | List of faculty slugs. **Validated at build time** — a typo fails the build |
| `order` | no | Sort order (default 999) |

The markdown body renders below the summary on `/research`.

### News — `src/content/news/*.md`

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | Headline |
| `date` | yes | `YYYY-MM-DD`; sorted newest first |
| `link` | no | Valid URL. Entries **with** a link also appear under Announcements on /join |

The body text is the markdown content of the file.

## Deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds with `withastro/action@v6` and publishes via `actions/deploy-pages@v5`.

**One-time setup:** in the repository, go to Settings → Pages and set **Source** to
**GitHub Actions**. Without this the workflow fails at the deploy step.

### Changing the URL

`astro.config.mjs` is configured for a project site at
`https://nmayhall.github.io/iu_theory_website`. If the site moves:

- **Different repo name** — update `base` to match the new name.
- **User/org site** (`nmayhall.github.io`) — delete `base` entirely.
- **Custom domain** — set `site` to the domain, delete `base`, and add a `public/CNAME`
  file containing the domain.

Internal links go through the `url()` helper in `src/lib/url.ts` so they follow `base`
automatically — use it instead of hard-coding `/people`-style hrefs, which would 404 in
production.
