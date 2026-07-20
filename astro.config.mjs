// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Deployed as a GitHub Pages *project* site:
//   https://nmayhall.github.io/iu_theory_website
// If this later moves to a custom domain, set `site` to that domain,
// delete `base`, and add a public/CNAME file.
export default defineConfig({
  site: 'https://nmayhall.github.io',
  base: '/iu_theory_website',

  // LaTeX in markdown: $inline$ and $$display$$. Rendered to HTML at build time by
  // KaTeX, so no math JavaScript is shipped to the browser — only the KaTeX
  // stylesheet, which BaseLayout imports.
  //
  // Astro 7 made Sätteri the default Markdown processor, and it does not take remark /
  // rehype plugins. Passing `markdown.remarkPlugins` directly (the form in every online
  // guide, all written pre-Astro-7) now fails the build. Opting into the `unified`
  // processor from @astrojs/markdown-remark restores plugin support; note this replaces
  // Sätteri for both .md and .mdx.
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
});
