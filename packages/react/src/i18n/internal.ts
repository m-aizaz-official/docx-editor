import {
  createT as createUpstreamT,
  deepMerge as deepMergeUpstream,
  en as upstreamEn,
} from '../../../i18n/src/index';

export type LocaleStrings = Record<string, unknown> & {
  table: {
    mergeCells: string;
    splitCell: string;
    selectTable: string;
    deleteTable: string;
  };
  contextMenu: {
    updateTableOfContents: string;
  };
};
export type Translations = LocaleStrings & { _lang?: string };
export type TranslationKey = string;
export type TFunction = (key: string, vars?: Record<string, unknown>) => string;

export const en = upstreamEn as LocaleStrings;

export function deepMerge(base: Record<string, unknown>, override?: Record<string, unknown>) {
  return deepMergeUpstream(base, override);
}

export function createT(strings: LocaleStrings, lang: string): TFunction {
  return createUpstreamT(strings as typeof upstreamEn, lang) as TFunction;
}
