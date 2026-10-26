import { expect, test, type Page } from "@playwright/test";

async function createInventory(page:Page,name:string) {
  const previous=new URL(page.url()).pathname;
  await page.locator(".inventory-menu-trigger").click();
  await page.locator(".inventory-create-button").click();
  const dialog=page.getByRole("dialog",{name:"Создать инвентарь"});
  await dialog.getByLabel("Название инвентаря").fill(name);
  await dialog.getByRole("button",{name:"Создать инвентарь",exact:true}).click();
  await expect.poll(()=>new URL(page.url()).pathname).not.toBe(previous);
  await expect(page).toHaveURL(/\/inventories\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname;
}

async function addItem(page:Page,name:string,quantity:string) {
  await page.locator(".add-dialog-trigger").click();
  const dialog=page.getByRole("dialog",{name:"Добавить вещь"});
  await dialog.getByLabel("Название").fill(name);
  await dialog.getByLabel("Тип учёта").selectOption("bulk");
  await dialog.getByLabel("Количество",{exact:true}).fill(quantity);
  await dialog.getByRole("button",{name:"Добавить вещь",exact:true}).click();
  await expect(page).toHaveURL(/added=/);
  const row=page.getByRole("link",{name:new RegExp(name)});
  await expect(row).toContainText("INV-000001");
  return (await row.getAttribute("href"))!;
}

test("explicit inventory routes isolate switching, stale editors, rename, preference and foreign detail requests",async({page,browser})=>{
  test.setTimeout(120_000);
  await page.goto("/");
  const home=await createInventory(page,"Home M33");
  const homeItem=await addItem(page,"Home isolated", "2");
  const workshop=await createInventory(page,"Workshop M33");
  const workshopItem=await addItem(page,"Workshop isolated", "4");
  await expect(page.getByRole("link",{name:/Home isolated/})).toHaveCount(0);
  await page.goto(homeItem);
  const second=await page.context().newPage();
  await second.goto(workshop);
  await expect.poll(async()=> (await page.context().cookies()).find(cookie=>cookie.name==="all-items-inventory")?.value).toBe(workshop.split("/").at(-1));
  await page.locator(".item-edit-form").getByLabel("Количество",{exact:true}).fill("3");
  await page.getByRole("button",{name:"Сохранить изменения",exact:true}).click();
  await expect(page).toHaveURL(home);
  await expect(page.getByRole("link",{name:/Home isolated/})).toContainText("3");
  await second.goto(workshopItem);
  await expect(second.getByLabel("Количество",{exact:true})).toHaveValue("4");
  const foreign=await page.request.get(`${home}/items/${workshopItem.split("/").at(-1)}`);
  expect(foreign.status()).toBe(404);
  await page.goto(`${home}/settings`);
  await page.getByLabel("Название инвентаря").fill("Home renamed M33");
  await page.getByRole("button",{name:"Сохранить изменения",exact:true}).click();
  await expect(page.locator(".inventory-menu-trigger")).toContainText("Home renamed M33");
  await page.locator(".inventory-menu-trigger").click();
  await page.getByRole("menuitemradio",{name:"Workshop M33"}).click();
  await expect(page).toHaveURL(workshop);
  await expect(page.getByRole("link",{name:/Home isolated/})).toHaveCount(0);
  await expect.poll(async()=> (await page.context().cookies()).find(cookie=>cookie.name==="all-items-inventory")?.value).toBe(workshop.split("/").at(-1));
  const reopened=await browser.newContext({storageState:await page.context().storageState(),locale:"ru-RU"});
  const reopenedPage=await reopened.newPage(); await reopenedPage.goto("http://127.0.0.1:3100/");
  await expect(reopenedPage).toHaveURL(`http://127.0.0.1:3100${workshop}`);
  await expect(reopenedPage.getByRole("link",{name:/Workshop isolated/})).toBeVisible();
  await reopened.close(); await second.close();
  await page.goto(home);
  await expect(page.getByRole("link",{name:/Home isolated/})).toBeVisible();
});

test("header navigation, scoped counts and category links remain usable at 360px",async({page})=>{
  test.setTimeout(120_000);
  await page.setViewportSize({width:360,height:800});
  await page.goto("/");
  const space=await createInventory(page,"M33B compact");
  await page.locator(".inventory-menu-trigger").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio",{name:"M33B compact"})).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".inventory-menu-trigger")).toBeFocused();
  await page.locator(".add-dialog-trigger").click();
  const dialog=page.getByRole("dialog",{name:"Добавить вещь"});
  await dialog.getByLabel("Название").fill("Synthetic row");
  await dialog.locator(".category-trigger").click();
  await dialog.locator(".category-options input").first().check();
  await dialog.locator(".category-trigger").click();
  await dialog.getByRole("button",{name:"Добавить вещь",exact:true}).click();
  await expect(page).toHaveURL(/added=/);
  await expect(page.locator(".side-navigation .nav-link").first().locator(".nav-count")).toHaveText("1");
  const row=page.locator(".item-grid-row").filter({hasText:"Synthetic row"});
  const itemLink=row.locator(".item-row-link");
  await expect(itemLink).toHaveAttribute("href",/\/items\//);
  await row.locator(".item-category-filter").first().click();
  await expect(page).toHaveURL(/category=/);
  await expect(page.locator(".item-grid-row").filter({hasText:"Synthetic row"})).toBeVisible();
  await page.goBack();await expect(page).toHaveURL(/added=/);
  await page.getByLabel("Категория",{exact:true}).selectOption("antiques");
  await expect(page).toHaveURL(/category=antiques/);
  await page.getByLabel("Любой статус").selectOption("source_verified");
  await expect(page).toHaveURL(/status=source_verified/);
  for(const [locale,label] of [["en","English"],["uk","Українська"],["sr-Latn","Srpski"],["zh-Hans","简体中文"],["ru","Русский"]]) {
    await page.locator(".language-switcher").click();
    await page.getByRole("menuitemradio",{name:label!,exact:true}).click();
    await expect(page.locator("html")).toHaveAttribute("lang",locale!);
    for(const select of await page.locator(".filter-bar select").all()) {
      const fits=await select.evaluate(element=>{const style=getComputedStyle(element);const canvas=document.createElement("canvas");const ctx=canvas.getContext("2d")!;ctx.font=style.font;return ctx.measureText((element as HTMLSelectElement).selectedOptions[0]!.text).width+44<=element.getBoundingClientRect().width;});
      expect(fits).toBe(true);
    }
  }
  await page.goto(`${space}/settings`);
  await expect(page.locator(".nav-link.active")).toHaveCount(0);
  await expect(page.locator(".side-navigation .nav-link").first().locator(".nav-count")).toHaveText("1");
  await expect(page.locator(".settings-back")).toHaveAttribute("href",space);
  await page.goto(`${space}/data`);
  await expect(page.locator(".side-navigation .nav-link").first().locator(".nav-count")).toHaveText("1");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
