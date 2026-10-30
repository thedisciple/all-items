"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search, X } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { useInventory } from "./inventory-provider";

type Props = {
  actions?: React.ReactNode;
  categories: { value: string; label: string }[];
  statuses: { value: string; label: string }[];
  searchPlaceholder: string;
};

const filterKeys = ["q", "category", "status", "sort"] as const;

export function ItemFilters({ categories, statuses, searchPlaceholder, actions }: Props) {
  const { t } = useI18n();
  const { presentation } = useInventory();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(paramsString), [paramsString]);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const filterRef = useRef<HTMLDivElement>(null);
  const scrollBeforeNavigation = useRef<number | null>(null);
  function rememberScroll() { if (pathname.includes("/collections/")) scrollBeforeNavigation.current = window.scrollY; }
  useLayoutEffect(() => {
    const previous = scrollBeforeNavigation.current;
    if (previous === null) return;
    scrollBeforeNavigation.current = null;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const filtersTop = (filterRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
    window.scrollTo({ top: previous <= max ? previous : Math.min(max, Math.max(0, filtersTop-16)), behavior: "instant" });
  }, [paramsString]);
  const editedSinceNavigation = useRef(false);
  const activeFilters = filterKeys.some(key => key === "sort" ? Boolean(params.get(key) && params.get(key) !== presentation.preferences.sort) : Boolean(params.get(key)));

  useEffect(() => {
    if (!editedSinceNavigation.current) setQuery(params.get("q") ?? "");
    editedSinceNavigation.current = false;
  }, [params]);

  function navigate(key: string, value: string) {
    const next = new URLSearchParams(params);
    const pendingQuery = query.trim();
    if (pendingQuery) next.set("q", pendingQuery);
    else next.delete("q");
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("updated");
    next.delete("added");
    const queryString = next.toString();
    rememberScroll();
    router.push(queryString ? pathname + "?" + queryString : pathname, { scroll: false });
  }

  useEffect(() => {
    const committed = params.get("q") ?? "";
    if (query === committed) return;
    const timer = window.setTimeout(() => navigate("q", query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query, paramsString]);

  const clear = () => {
    const next = new URLSearchParams(params);
    for (const key of filterKeys) next.delete(key);
    next.delete("added");
    next.delete("updated");
    const queryString = next.toString();
    rememberScroll();
    router.push(queryString ? pathname + "?" + queryString : pathname, { scroll: false });
    filterRef.current?.querySelector<HTMLInputElement>(".search-field input")?.focus();
  };

  const categoryLabel = categories.find(option => option.value === params.get("category"))?.label ?? t("categoriesAll");
  const statusLabel = statuses.find(option => option.value === params.get("status"))?.label ?? t("statusAny");
  const sort = params.get("sort") ?? presentation.preferences.sort;
  const sortLabel = t(sort === "name" ? "sortName" : sort === "quantity" ? "sortQuantity" : "sortNewest");

  return <div ref={filterRef} className={`filter-bar${actions ? " inventory-toolbar" : ""}`} aria-label={t("inventoryFilters")}>
    {actions}
    <label className="search-field"><Search size={17} aria-hidden="true"/><input type="search" aria-label={searchPlaceholder} value={query} onChange={(event) => { editedSinceNavigation.current = true; setQuery(event.target.value); }} placeholder={searchPlaceholder} maxLength={160}/></label>
    <label className="filter-select"><span aria-hidden="true">{categoryLabel}</span><select aria-label={t("category")} title={categories.find(option=>option.value===params.get("category"))?.label ?? t("categoriesAll")} value={params.get("category") ?? ""} onChange={(event) => navigate("category", event.target.value)}>
      <option value="">{t("categoriesAll")}</option>{categories.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
    </select><ChevronDown className="filter-chevron" size={16} aria-hidden="true"/>
    </label><label className="filter-select"><span aria-hidden="true">{statusLabel}</span><select aria-label={t("statusAny")} title={statuses.find(option=>option.value===params.get("status"))?.label ?? t("statusAny")} value={params.get("status") ?? ""} onChange={(event) => navigate("status", event.target.value)}>
      <option value="">{t("statusAny")}</option>{statuses.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
    </select><ChevronDown className="filter-chevron" size={16} aria-hidden="true"/>
    </label><label className="filter-select"><span aria-hidden="true">{sortLabel}</span><select aria-label={t("sortLabel")} value={params.get("sort") ?? presentation.preferences.sort} onChange={(event) => navigate("sort", event.target.value)}>
      <option value="date">{t("sortNewest")}</option><option value="name">{t("sortName")}</option><option value="quantity">{t("sortQuantity")}</option>
    </select><ChevronDown className="filter-chevron" size={16} aria-hidden="true"/>
    </label>{<button type="button" className="quiet-button clear-filters-button" disabled={!activeFilters} onClick={clear}><X size={15} aria-hidden="true"/>{t("clearFilters")}</button>}
  </div>;
}
