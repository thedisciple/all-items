import { AppSidebar } from "@/app/components/app-sidebar";
import { LanguageSwitcher } from "@/app/components/language-switcher";
import { ExportControls } from "@/app/components/export-controls";
import { ImportControls } from "@/app/components/import-controls";
import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return <main className="app-shell">
    <AppSidebar active="data" locale={locale}/>
    <section className="main-content">
      <header className="topbar"><span>{t("data")}</span><LanguageSwitcher/></header>
      <div className="content-wrap data-content"><div className="heading-row"><h1>{t("data")}</h1></div>
        <section className="data-panel" aria-labelledby="data-backup-heading"><h2 id="data-backup-heading">{t("dataBackup")}</h2><ExportControls locale={locale}/><ImportControls locale={locale}/></section>
      </div>
    </section>
  </main>;
}
