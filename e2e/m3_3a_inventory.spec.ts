import { expect, test, type Page } from "@playwright/test";

async function createInventory(page:Page,name:string) {
  const previous=new URL(page.url()).pathname;
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
  await expect(page.getByLabel("Текущий инвентарь")).toContainText("Home renamed M33");
  await page.getByLabel("Текущий инвентарь").selectOption(workshop.split("/").at(-1)!);
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
