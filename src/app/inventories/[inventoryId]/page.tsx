import { routeInventory } from "@/app/inventory-routing";
import { inventoryPath } from "@/items/inventory-context";
import { AppSidebar } from "@/app/components/app-sidebar";
import { AddItemForm } from "@/app/components/add-item-form";
import { categories, categoryMessageKey } from "@/items/categories";
import { listCategoryValues, listItems } from "@/items/service";
import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";
import { AppHeader } from "@/app/components/app-header";
import { categoryEmoji, categoryKeyForStoredValue } from "@/items/categories";
import { ItemFilters } from "@/app/components/item-filters";
import { InventoryItemRow } from "@/app/components/inventory-item-row";
import { getInventoryPresentation } from "@/items/inventory-presentation";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{inventoryId:string}>; searchParams: Promise<{ q?: string; category?: string; status?: string; sort?: string; added?: string; updated?: string }> };
export default async function Home({ searchParams, params: routeParams }: Props) {
  const context = await routeInventory((await routeParams).inventoryId);
  const base = inventoryPath(context);
  const params = await searchParams;
  const presentation = await getInventoryPresentation(context);
  const customEmoji = Object.fromEntries(presentation.categories.map(value => [value.category, value.emoji]));
  const [locale, items, storedCategories] = await Promise.all([
    getLocale(),
    listItems(context, { search: params.q, category: params.category || undefined, status: params.status || undefined, sort: params.sort ?? presentation.preferences.sort }),
    listCategoryValues(context),
  ]);
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(locale, key, values);
  const hasFilters = Boolean(params.q || params.category || params.status);
  const statusLabels: Record<string, string> = { unknown: t("itemStatusUnknown"), user_confirmed: t("itemStatusConfirmed"), source_verified: t("itemStatusVerified") };
  const categoryOptions: { value: string; label: string }[] = [...categories.map((key) => ({ value: key, label: categoryEmoji[key] + " " + t(categoryMessageKey(key)!) }))];
  for (const value of storedCategories) if (!categoryKeyForStoredValue(value)) categoryOptions.push({ value, label: `${customEmoji[value] ? customEmoji[value] + " " : ""}${value}` });
  return <main className="app-shell">
    <AppSidebar active="items" locale={locale}/>
    <section className="main-content">
      <AppHeader/>
      <div className="content-wrap"><h1 className="visually-hidden">{t("inventory")}</h1>
        <AddItemForm key={context.workspaceId}/>
        <ItemFilters categories={categoryOptions} statuses={Object.entries(statusLabels).map(([value,label]) => ({ value, label }))} searchPlaceholder={t("searchItems")}/>
        {hasFilters ? <div className="list-heading"><span className="list-total">{t("resultCount", { count: items.length })}</span></div> : <div className="inventory-list-spacing"/>}
        {items.length ? <div className="item-list">{items.map(item => <InventoryItemRow key={String(item.id)} item={item} base={base} locale={locale} query={params} customEmoji={customEmoji} highlighted={params.added === String(item.id)}/>)}</div> : <div className="empty-state"><div className="empty-orbit">✳</div><h3>{hasFilters ? t("noMatches") : t("noItems")}</h3><p>{hasFilters ? t("adjustFilters") : t("addFirstItem")}</p></div>}
      </div>
    </section>
  </main>;
}
