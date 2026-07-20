import type { CollectionEntry } from 'astro:content';

type Pub = CollectionEntry<'publications'>;
type Faculty = CollectionEntry<'faculty'>;

/** Surnames that identify a faculty member in an author list. */
export function surnamesFor(person: Faculty): string[] {
  const parts = person.data.name.trim().split(/\s+/);
  return [parts[parts.length - 1], ...person.data.authorAliases].map((s) => s.toLowerCase());
}

/** Does this publication list the given faculty member as an author? */
export function isAuthoredBy(pub: Pub, person: Faculty): boolean {
  const surnames = surnamesFor(person);
  return pub.data.authors.some((a) => {
    const last = a.trim().split(/\s+/).pop()?.toLowerCase() ?? '';
    return surnames.includes(last);
  });
}

/** Newest first; entries with no year sort last. */
export function byYearDesc(a: Pub, b: Pub): number {
  return (b.data.year ?? -Infinity) - (a.data.year ?? -Infinity);
}

/** Group publications into year buckets, newest year first. */
export function groupByYear(pubs: Pub[]): { year: number | null; items: Pub[] }[] {
  const buckets = new Map<number | null, Pub[]>();
  for (const p of [...pubs].sort(byYearDesc)) {
    const y = p.data.year ?? null;
    if (!buckets.has(y)) buckets.set(y, []);
    buckets.get(y)!.push(p);
  }
  return [...buckets.entries()].map(([year, items]) => ({ year, items }));
}

/** Preferred outbound link: DOI resolver, else whatever URL the entry carries. */
export function linkFor(pub: Pub): string | undefined {
  if (pub.data.doi) return `https://doi.org/${pub.data.doi}`;
  return pub.data.url;
}
