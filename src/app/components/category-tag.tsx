import { categoryEmoji, categoryKeyForStoredValue, categoryMessageKey } from "@/items/categories";
import { translate, type Locale } from "@/i18n/messages";

export function CategoryTag({ value, locale }: { value: string; locale: Locale }) {
  const key = categoryKeyForStoredValue(value);
  const label = key ? translate(locale, categoryMessageKey(key)!) : value;
  return <span className="category-chip">{key ? <span aria-hidden="true">{categoryEmoji[key]}</span> : null}{label}</span>;
}

export function CategoryTags({ values, locale }: { values: string[]; locale: Locale }) {
  return <span className="category-tags">{values.map(value => <CategoryTag key={value} value={value} locale={locale}/>)}</span>;
}
