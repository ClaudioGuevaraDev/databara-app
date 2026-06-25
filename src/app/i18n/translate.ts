import type { Language } from "../types";
import { en } from "./en";

export type Translations = typeof en;

// A leaf that carries singular/plural variants selected by a `count` parameter.
type PluralLeaf = { one: string; other: string };

// Recursively builds the union of dot-paths down to every string / plural leaf,
// so `translate` keys are checked at compile time (typos become type errors).
type DotKeys<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends PluralLeaf
      ? K
      : T[K] extends object
        ? `${K}.${DotKeys<T[K]>}`
        : never;
}[keyof T & string];

export type TranslationKey = DotKeys<Translations>;

export type TranslationParams = Record<string, string | number>;

// Locale catalogs. Only English is supported today; new locales are added here
// and `setActiveLocale` starts resolving them with no other code change.
const catalogs: Record<Language, Translations> = { en };

let activeCatalog: Translations = en;

export function setActiveLocale(code: Language): void {
  activeCatalog = catalogs[code] ?? en;
}

function resolve(key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object") return (node as Record<string, unknown>)[part];
    return undefined;
  }, activeCatalog);
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined ? `{{${name}}}` : String(value);
  });
}

/**
 * Resolves a translation key against the active locale and applies
 * interpolation. Pass `count` to select a plural form. Falls back to the raw
 * key when a value is missing, which makes untranslated strings visible.
 *
 * Used both by React components (via `useI18n().t`) and by non-render code such
 * as toast messages and form validation, which cannot use the hook.
 */
export function translate(key: TranslationKey, params?: TranslationParams): string {
  const node = resolve(key);

  if (typeof node === "string") return interpolate(node, params);

  if (node && typeof node === "object") {
    const plural = node as Partial<PluralLeaf>;
    if (typeof plural.one === "string" && typeof plural.other === "string") {
      const count = typeof params?.count === "number" ? params.count : undefined;
      const template = count === 1 ? plural.one : plural.other;
      return interpolate(template, params);
    }
  }

  return key;
}
