export const categories = [
  "electronics", "computers", "tools", "antiques", "clothing", "plants", "home", "books_hobbies", "sports", "kids", "other",
] as const;

export type CategoryKey = typeof categories[number];

const legacyCategoryMap: Record<CategoryKey, readonly string[]> = {
  electronics: ["Электроника", "Электроника и компоненты", "Electronics"],
  computers: ["Компьютеры", "Компьютеры и гаджеты", "Компьютерная техника", "Computers & Gadgets"],
  tools: ["Инструменты", "Инструменты и оборудование", "Инструменты и техника", "Tools & Equipment"],
  antiques: ["Антиквариат", "Антиквариат и коллекционирование", "Коллекционирование", "Antiques & Collectibles"],
  clothing: ["Одежда", "Одежда и обувь", "Обувь", "Clothing & Shoes"],
  plants: ["Растения", "Растения и сад", "Сад и огород", "Двор и сад", "Bašta i dvorište", "Plants & Garden"],
  home: ["Дом и быт", "Дом и хозяйство", "Для дома", "Home & Household"],
  books_hobbies: ["Книги", "Книги и хобби", "Хобби и отдых", "Books & Hobbies"],
  sports: ["Спорт", "Спорт и отдых", "Спорт и туризм", "Sports & Outdoors"],
  kids: ["Детские вещи", "Детские товары", "Детские товары и игрушки", "Kids & Baby"],
  other: ["Прочее", "Другое", "Other"],
};

const keySet = new Set<string>(categories);
const legacyToKey = new Map<string, CategoryKey>();
for (const key of categories) for (const label of legacyCategoryMap[key]) legacyToKey.set(label.normalize("NFKC").toLocaleLowerCase("ru-RU"), key);

export function categoryKeyForStoredValue(value: string | null | undefined): CategoryKey | null {
  if (!value) return null;
  if (keySet.has(value)) return value as CategoryKey;
  return legacyToKey.get(value.normalize("NFKC").toLocaleLowerCase("ru-RU")) ?? null;
}

export function categoryFilterValues(value: string): string[] {
  if (!keySet.has(value)) return [value];
  const key = value as CategoryKey;
  return [key, ...legacyCategoryMap[key]];
}

export function categoryMessageKey(value: string) {
  const key = categoryKeyForStoredValue(value);
  if (!key) return null;
  const labels = {
    electronics: "categoryElectronics", computers: "categoryComputers", tools: "categoryTools", antiques: "categoryAntiques",
    clothing: "categoryClothing", plants: "categoryPlants", home: "categoryHome", books_hobbies: "categoryBooksHobbies",
    sports: "categorySports", kids: "categoryKids", other: "categoryOther",
  } as const;
  return labels[key];
}
