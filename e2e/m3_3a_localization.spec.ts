import { expect,test } from "@playwright/test";
import { translate,type Locale } from "../src/i18n/messages";
import {chooseAccountLanguage} from "./helpers/language";

test("recoverable collection feedback preserves fields in all five account languages",async({page})=>{
  test.setTimeout(120_000);
  await page.goto("/inventories/00000000-0000-4000-8000-000000000001/collections");
  const name="M33 localized duplicate";
  await page.getByRole("button",{name:translate("ru","collectionNew"),exact:true}).click();
  let dialog=page.getByRole("dialog");
  await dialog.getByLabel(translate("ru","collectionName")).fill(name);
  await dialog.getByRole("button",{name:translate("ru","collectionCreate"),exact:true}).click();
  await expect(page).toHaveURL(/\/collections\//);
  await page.getByRole("link",{name:new RegExp(`^${translate("ru","collections")}\\s+\\d+$`)}).click();
  await page.getByRole("button",{name:translate("ru","collectionNew"),exact:true}).click();
  dialog=page.getByRole("dialog");
  await dialog.getByLabel(translate("ru","collectionName")).fill(name);
  await dialog.locator(".collection-emoji-choice").last().click();
  const icon=await dialog.locator('input[name="icon"]').inputValue();
  await dialog.getByRole("button",{name:translate("ru","collectionCreate"),exact:true}).click();
  await expect(dialog.getByRole("alert")).toHaveText(translate("ru","collectionAlreadyExists"));
  await expect(dialog.getByLabel(translate("ru","collectionName"))).toHaveValue(name);
  await expect(dialog.locator('input[name="icon"]')).toHaveValue(icon);
  const choices:[Locale,string][]=[["en","English"],["uk","Українська"],["sr-Latn","Srpski"],["zh-Hans","简体中文"],["ru","Русский"]];
  let locale:Locale="ru";
  for(const [next,label] of choices) {
    await dialog.getByRole("button",{name:translate(locale,"close"),exact:true}).click();
    await chooseAccountLanguage(page,label);
    await expect(page.locator("html")).toHaveAttribute("lang",next);
    await page.getByRole("button",{name:translate(next,"collectionNew"),exact:true}).click();
    dialog=page.getByRole("dialog");
    await dialog.getByLabel(translate(next,"collectionName")).fill(name);
    await dialog.locator(".collection-emoji-choice").last().click();
    await dialog.getByRole("button",{name:translate(next,"collectionCreate"),exact:true}).click();
    await expect(dialog.getByRole("alert")).toHaveText(translate(next,"collectionAlreadyExists"));
    await expect(dialog.getByLabel(translate(next,"collectionName"))).toHaveValue(name);
    await expect(dialog.locator('input[name="icon"]')).toHaveValue(icon);
    locale=next;
  }
});
