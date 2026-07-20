/**
 * Prefix an internal path with the configured `base`.
 *
 * The site deploys to a GitHub Pages project subpath (/iu_theory_website), so
 * hard-coded root-relative hrefs like "/people" would 404 in production while
 * still working in `astro dev`. Always route internal links through this.
 */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}` || '/';
}
