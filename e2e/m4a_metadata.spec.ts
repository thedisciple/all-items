import {test,expect} from "./helpers/browser-reliability";
import {messages,locales} from "../src/i18n/messages";

const base="/inventories/00000000-0000-4000-8000-000000000001";
test("M4A localized metadata precedes the body and repeated full navigations hydrate cleanly",async({page,context})=>{
  test.setTimeout(180_000);const fallbackIcons:string[]=[];page.on("request",request=>{if(new URL(request.url()).pathname==="/favicon.ico")fallbackIcons.push(request.url());});
  for(const locale of locales){
    await context.addCookies([{name:"all-items-language",value:locale,url:"http://127.0.0.1:3100"}]);
    const response=await page.request.get(base,{maxRetries:1}),html=await response.text(),head=html.slice(0,html.indexOf("</head>"));expect(response.status()).toBe(200);expect(head).toContain("<title>All Items</title>");expect(head).toContain('href="/favicon.svg"');expect(head).toContain(messages[locale].appDescription);
  }
  for(let cycle=0;cycle<6;cycle++)for(const locale of locales){
    await context.addCookies([{name:"all-items-language",value:locale,url:"http://127.0.0.1:3100"}]);await page.goto(base);await expect(page.locator("html")).toHaveAttribute("lang",locale);
    await page.locator(".inventory-menu-trigger").click();await expect(page.getByRole("menuitemradio").first()).toBeVisible();await page.keyboard.press("Escape");await expect(page.locator(".inventory-menu-trigger")).toBeFocused();
  }
  expect(fallbackIcons).toEqual([]);
});
