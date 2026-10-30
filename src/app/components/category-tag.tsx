import { categoryEmoji, categoryKeyForStoredValue, categoryMessageKey } from "@/items/categories";
import { translate, type Locale } from "@/i18n/messages";

export function CategoryTag({ value, locale, customEmoji = {} }: { value: string; locale: Locale; customEmoji?: Record<string, string> }) {
  const key = categoryKeyForStoredValue(value);
  const label = key ? translate(locale, categoryMessageKey(key)!) : value;
  return <span className="category-chip" title={label}>{key || customEmoji[value] ? <span aria-hidden="true">{key ? categoryEmoji[key] : customEmoji[value]}</span> : null}<span className="category-chip-label">{label}</span></span>;
}

export function CategoryTags({ values, locale, customEmoji = {} }: { values: string[]; locale: Locale; customEmoji?: Record<string, string> }) {
  return <span className="category-tags">{values.map(value => <CategoryTag key={value} value={value} locale={locale} customEmoji={customEmoji}/>)}</span>;
}
