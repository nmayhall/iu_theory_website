/**
 * Minimal ambient types for @retorquere/bibtex-parser, which ships no .d.ts files.
 *
 * Only the surface this project actually uses is declared. The shapes were confirmed
 * against the parser's real output: authors arrive on `fields.author` as
 * {firstName, lastName} objects, and there is no `creators` property.
 */
declare module '@retorquere/bibtex-parser' {
  export interface BibtexName {
    firstName?: string;
    lastName?: string;
    /** Institutional / literal authors come through as a single name string. */
    name?: string;
  }

  export interface BibtexEntry {
    /** Entry type without the '@', e.g. 'article'. */
    type: string;
    /** The citation key, e.g. 'Grimsley_2019'. */
    key: string;
    fields: Record<string, unknown> & {
      author?: Array<BibtexName | string>;
    };
  }

  export interface BibtexFile {
    entries: BibtexEntry[];
  }

  export function parse(input: string): BibtexFile;
}
