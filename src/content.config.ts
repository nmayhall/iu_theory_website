import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import * as bibtex from '@retorquere/bibtex-parser';

const faculty = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faculty' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      title: z.string(),
      // Drop a headshot next to the .md file and reference it relatively,
      // e.g. photo: './jane-doe.jpg'. Omitted entries render initials instead.
      photo: image().optional(),
      researchAreas: z.array(z.string()),
      personalSite: z.url().optional(),
      googleScholar: z.url().optional(),
      // One-line summary used on the /people grid; the markdown body holds the full bio
      // shown on the individual /people/<slug> page.
      blurb: z.string().optional(),
      // e.g. { year: '2019', name: 'NSF CAREER Award' }. Year is optional because some
      // honors (fellowships, editorial roles) are better listed without one.
      awards: z
        .array(
          z.object({
            year: z.string().optional(),
            name: z.string(),
          }),
        )
        .default([]),
      // Free-form lines, e.g. 'PhD, University of California, Berkeley, 2010'.
      education: z.array(z.string()).default([]),
      // Surnames to match against publication author lists. Defaults to the last word
      // of `name`, but early papers often use a different form — Raghavachari published
      // as "R. Krishnan" in 1980 — so extra surnames can be listed here.
      authorAliases: z.array(z.string()).default([]),
      // Controls display order on /people; lower numbers sort first.
      order: z.number().default(999),
    }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/research' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      // Basename of an SVG in src/assets/motifs (decorative artwork, no data implied).
      // Used only when no real `figure` is supplied.
      motif: z.string().optional(),
      // A real figure from published work. Drop the image beside this markdown file
      // and reference it relatively, e.g. figure: ./tpsci-scheme.png
      figure: image().optional(),
      figureAlt: z.string().optional(),
      // Attribution / reuse note, e.g. "Adapted from Smith et al., JCTC 2024".
      figureCredit: z.string().optional(),
      // Each entry must match a faculty file's slug. Astro validates these at
      // build time, so a typo fails the build rather than rendering an empty list.
      faculty: z.array(reference('faculty')).default([]),
      order: z.number().default(999),
    }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    link: z.url().optional(),
  }),
});

// Publications come straight from a BibTeX file, so keeping the list current means
// dropping in a fresh export from Zotero / Google Scholar / EndNote and committing it.
// No hand-editing of markdown, no schema to learn.
const publications = defineCollection({
  loader: file('src/data/publications.bib', {
    parser: (text) => {
      const parsed = bibtex.parse(text);
      return parsed.entries.map((entry) => {
        const f = entry.fields;
        const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
        return {
          // The BibTeX citation key is a natural stable id.
          id: entry.key,
          type: entry.type,
          title: String(first(f.title) ?? '').replace(/[{}]/g, ''),
          // This parser exposes authors on `fields.author` as {firstName, lastName}
          // objects (there is no `creators` property). Institutional authors appear
          // as a bare `name` instead, so fall back to that.
          authors: (f.author ?? []).map((a) =>
            typeof a === 'string'
              ? a
              : [a.firstName, a.lastName].filter(Boolean).join(' ').trim() ||
                String(a.name ?? ''),
          ),
          journal: String(first(f.journal) ?? first(f.booktitle) ?? '').replace(/[{}]/g, ''),
          year: Number(String(first(f.year) ?? '').match(/\d{4}/)?.[0]) || undefined,
          volume: first(f.volume) ? String(first(f.volume)) : undefined,
          pages: first(f.pages) ? String(first(f.pages)).replace(/--/g, '–') : undefined,
          doi: first(f.doi) ? String(first(f.doi)) : undefined,
          url: first(f.url) ? String(first(f.url)) : undefined,
        };
      });
    },
  }),
  schema: z.object({
    type: z.string().optional(),
    title: z.string(),
    authors: z.array(z.string()).default([]),
    journal: z.string().optional(),
    year: z.number().optional(),
    volume: z.string().optional(),
    pages: z.string().optional(),
    doi: z.string().optional(),
    url: z.string().optional(),
  }),
});

export const collections = { faculty, research, news, publications };
