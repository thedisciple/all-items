import { test,expect,type Page } from "@playwright/test";
import { execFile,spawn,type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { mkdtemp,readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("production restart preserves selection, media ownership, scoped deletion and the final empty landing",async({page})=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),"all-items-restart-"));
  const env:NodeJS.ProcessEnv={...process.env,ALL_ITEMS_DATA_DIR:directory,NODE_ENV:"production"};
  const run=promisify(execFile);
  const migrate=()=>run(process.execPath,["--import","tsx","src/db/migrate.ts"],{env,windowsHide:true});
  await migrate();
  await run(process.execPath,["--import","tsx","e2e/helpers/restart-fixture.ts"],{env,windowsHide:true});
  type Inventory={id:string;name:string;item:string;collection:string;cover:string;media:string};
  const [home,workshop]=JSON.parse(await readFile(path.join(directory,"fixture.json"),"utf8")) as [Inventory,Inventory];
  let app:ChildProcess|undefined;let output="";
  const stop=async()=>{if(app&&app.exitCode===null){const done=once(app,"exit");app.kill();await done;}app=undefined;};
  const start=async()=>{
    await migrate();output="";
    app=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3104"],{env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
    app.stdout?.on("data",data=>{output+=String(data);});app.stderr?.on("data",data=>{output+=String(data);});
    await expect.poll(async()=>{if(app?.exitCode!==null)throw new Error(output);try{return(await page.request.get("/")).status();}catch{return 0;}},{timeout:30_000}).toBe(200);
  };
  const base=(id:string)=>`/inventories/${id}`;
  async function remove(page:Page,id:string,name?:string,renamed?:string) {
    await page.goto(`${base(id)}/settings`);
    await page.getByRole("button",{name:"Удалить инвентарь",exact:true}).click();
    const dialog=page.getByRole("alertdialog");
    const confirm=dialog.getByRole("button",{name:"Удалить инвентарь",exact:true});
    if(name){await expect(dialog).toContainText("Вещей: 1. Коллекций: 1.");await expect(confirm).toBeDisabled();await dialog.getByLabel("Введите название инвентаря для подтверждения").fill(name);}
    if(renamed){
      const other=await page.context().newPage();await other.goto(`${base(id)}/settings`);
      await other.getByLabel("Название инвентаря",{exact:true}).fill(renamed);
      await other.getByRole("button",{name:"Сохранить изменения",exact:true}).click();
      await expect(other.locator(".inventory-menu-trigger")).toContainText(renamed);await other.close();
      await confirm.click();
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(dialog.locator("strong")).toHaveText(renamed);
      await expect(dialog.getByLabel("Введите название инвентаря для подтверждения")).toHaveValue(name!);
      await expect(confirm).toBeDisabled();
      await dialog.getByLabel("Введите название инвентаря для подтверждения").fill(renamed);
    }
    await confirm.click();await expect(dialog).toHaveCount(0);
  }
  try {
    await start();
    await page.goto(base(workshop.id));
    await expect.poll(async()=>(await page.context().cookies()).find(c=>c.name==="all-items-inventory")?.value).toBe(workshop.id);
    await stop();await start();await page.goto("/");
    await expect(page).toHaveURL(base(workshop.id));
    for(const owner of [home,workshop]) {
      const other=owner===home?workshop:home;
      for(const variant of ["image","thumbnail","source"]) {
        const suffix=`/media/${owner.item}/${owner.media}?variant=${variant}`;
        const good=await page.request.get(`${base(owner.id)}${suffix}`);
        expect(good.status()).toBe(200);expect(good.headers()["cache-control"]).toContain("private");expect(good.headers()["x-content-type-options"]).toBe("nosniff");
        expect((await page.request.get(`${base(other.id)}${suffix}`)).status()).toBe(404);
      }
      for(const variant of ["image","thumbnail"]) {
        const suffix=`/media/collections/${owner.collection}/${owner.cover}?variant=${variant}`;
        expect((await page.request.get(`${base(owner.id)}${suffix}`)).status()).toBe(200);
        expect((await page.request.get(`${base(other.id)}${suffix}`)).status()).toBe(404);
      }
    }
    await remove(page,"00000000-0000-4000-8000-000000000001");
    await remove(page,home.id,home.name,"Restart Home renamed elsewhere");
    expect((await page.request.get(`${base(home.id)}/items/${home.item}`)).status()).toBe(404);
    await page.goto(`${base(workshop.id)}/items/${workshop.item}`);
    await expect(page.locator('.item-edit-form input[name="name"]')).toHaveValue(`${workshop.name} item`);
    expect((await page.request.get(`${base(workshop.id)}/media/${workshop.item}/${workshop.media}`)).status()).toBe(200);
    await remove(page,workshop.id,workshop.name);
    await expect(page).toHaveURL("/");await expect(page.locator(".inventory-create-button")).toBeVisible();
    await stop();await start();await page.goto("/");
    await expect(page).toHaveURL("/");await expect(page.locator(".inventory-create-button")).toBeVisible();
    await expect(page.getByLabel("Текущий инвентарь")).toHaveCount(0);
  }finally{await stop();}
});
