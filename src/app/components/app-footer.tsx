import {translate,type Locale} from "@/i18n/messages";
import metadata from "../../../package.json";

export function AppFooter({locale}:{locale:Locale}){
  const version=metadata.version;
  const repository="https://github.com/thedisciple/all-items",t=(key:Parameters<typeof translate>[1])=>translate(locale,key);
  return <footer className="app-footer"><span className="footer-identity">All Items <span>{translate(locale,"footerVersion",{version})}</span></span><nav aria-label="All Items"><a href={repository} target="_blank" rel="noopener noreferrer">{t("footerRepository")}</a><a href={repository+"/blob/main/CONTRIBUTING.md"} target="_blank" rel="noopener noreferrer">{t("footerContribute")}</a><a href={repository+"/blob/main/LICENSE"} target="_blank" rel="noopener noreferrer">{t("footerLicense")}</a><a href={repository+"/blob/main/CHANGELOG.md"} target="_blank" rel="noopener noreferrer">{t("footerChangelog")}</a></nav></footer>;
}
