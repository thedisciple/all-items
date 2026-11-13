import {beforeAll,afterAll,expect,it} from "vitest";
import {mkdtemp} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {getDatabase} from "@/db/client";
import {applyMigrations} from "@/db/migrate";
import {listItems,listItemsPage} from "./service";
import {listRouteQuery,paginationInput} from "./pagination";
import {ownFixtureInventory} from "@/test/owned-fixture";
import {createCollection,addItemsToCollection,collectionCoverPage} from "./collections";
import {inventoryReturnPath} from "./inventory-context";

let client:Awaited<ReturnType<typeof getDatabase>>["$client"];
const context={workspaceId:"00000000-0000-4000-8000-000000000001"};
beforeAll(async()=>{process.env.ALL_ITEMS_DATA_DIR=await mkdtemp(path.join(os.tmpdir(),"all-items-pagination-"));client=(await getDatabase()).$client;await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));});
afterAll(()=>client.close());
it("normalizes invalid query/page values without weakening domain validation",()=>{
  for(const page of[undefined,"0","-1","1.5","1e9",["2"],"99999999",NaN])expect(paginationInput({page})).toEqual({page:1,pageSize:25});
  expect(paginationInput({page:"2",pageSize:"100"})).toEqual({page:2,pageSize:100});
  expect(paginationInput({pageSize:"26"}).pageSize).toBe(25);
  expect(listRouteQuery({q:["x"],status:"bad",sort:"bad"})).toMatchObject({q:"",page:1,pageSize:25,status:undefined,sort:undefined});
  expect(inventoryReturnPath(context,`/inventories/${context.workspaceId}?page=2&pageSize=50&q=needle`)).toContain("page=2");
  for(const suffix of["?next=https://example.org","?page=2&page=3","#outside","/../account"]){expect(()=>inventoryReturnPath(context,`/inventories/${context.workspaceId}${suffix}`)).toThrow();}
});
it("pages exact boundaries, stable ties, filters, collections, deletion and ownership",async()=>{
  for(const count of[0,1,24,25,26,51,101,1001]){
    const workspaceId=crypto.randomUUID();await client.execute({sql:"INSERT INTO workspaces(id,name,created_at) VALUES(?,?,'2026-01-01')",args:[workspaceId,`Synthetic ${count}`]});await ownFixtureInventory(client,workspaceId);
    const statements=Array.from({length:count},(_,index)=>({sql:"INSERT INTO items(id,workspace_id,name,model,inventory_number,created_at,updated_at,identification_status) VALUES(?,?,?, ?,?,'2026-01-01','2026-01-01',?)",args:[crypto.randomUUID(),workspaceId,"Synthetic tied",index%2?"needle":"other",`INV-${String(index+1).padStart(6,"0")}`,index%2?"unknown":"user_confirmed"]}));
    if(statements.length)await client.batch(statements,"write");
    const scope={workspaceId},first=await listItemsPage(scope),last=await listItemsPage(scope,{}, {page:"999999"});
    expect(first.total).toBe(count);expect(first.items).toHaveLength(Math.min(25,count));expect(last.page).toBe(Math.max(1,Math.ceil(count/25)));
    expect(last.items).toHaveLength(count?((count-1)%25)+1:0);
    const all=await listItems(scope),visited:string[]=[];
    for(let page=1;page<=first.pages;page++)visited.push(...(await listItemsPage(scope,{}, {page})).items.map(item=>String(item.id)));
    expect(visited).toEqual(all.map(item=>String(item.id)));expect(new Set(visited).size).toBe(count);
    const filtered=await listItemsPage(scope,{search:"needle",status:"unknown",sort:"quantity"},{pageSize:50});expect(filtered.total).toBe(Math.floor(count/2));
    if(count===26){
      const collection=(await createCollection(scope,{name:"Synthetic collection"})).id;await addItemsToCollection(scope,collection,all.map(item=>String(item.id)));
      expect((await listItemsPage(scope,{collectionId:collection},{page:2})).items).toHaveLength(1);
      expect((await listItemsPage(scope,{excludeCollectionId:collection})).total).toBe(0);
      expect((await collectionCoverPage(scope,collection,"",1)).items).toEqual([]);
      await client.execute({sql:"INSERT INTO item_categories(item_id,category) VALUES(?,'custom')",args:[String(all[0]!.id)]});
      expect((await listItemsPage(scope,{category:"custom"})).total).toBe(1);
      await client.execute({sql:"DELETE FROM items WHERE id=?",args:[String(last.items[0]!.id)]});expect((await listItemsPage(scope,{}, {page:2})).page).toBe(1);
    }
  }
  const foreign=crypto.randomUUID();await client.execute({sql:"INSERT INTO workspaces(id,name,created_at) VALUES(?,'Synthetic inaccessible','2026')",args:[foreign]});
  await expect(listItemsPage({workspaceId:foreign})).rejects.toThrow();
  expect(()=>inventoryReturnPath(context,"https://example.org/")).toThrow();
},30_000);

it("records bounded synthetic pagination latency without a speculative index",async()=>{
  const workspaceId=crypto.randomUUID(),scope={workspaceId};await client.execute({sql:"INSERT INTO workspaces(id,name,created_at) VALUES(?,'Synthetic benchmark','2026')",args:[workspaceId]});await ownFixtureInventory(client,workspaceId);
  const seed=Array.from({length:10000},(_,index)=>({sql:"INSERT INTO items(id,workspace_id,name,inventory_number,created_at,updated_at) VALUES(?,?,?,?,'2026','2026')",args:[crypto.randomUUID(),workspaceId,`Synthetic ${String(index).padStart(5,"0")}`,`INV-${index+1}`]}));
  await client.batch(seed,"write");
  const filters={search:"Synthetic 0",sort:"name"},full=await listItems(scope,filters),paged=await listItemsPage(scope,filters);
  expect(paged.total).toBe(full.length);expect(paged.items).toEqual(full.slice(0,25));
  const measure=async(work:()=>Promise<unknown>)=>{for(let index=0;index<3;index++)await work();const values:number[]=[];for(let index=0;index<20;index++){const start=performance.now();await work();values.push(performance.now()-start);}values.sort((a,b)=>a-b);return{medianMs:Number(values[10]!.toFixed(2)),p95Ms:Number(values[18]!.toFixed(2))};};
  console.info("M4C synthetic 10000-row query",JSON.stringify({node:process.version,full:await measure(()=>listItems(scope,filters)),page25:await measure(()=>listItemsPage(scope,filters))}));
},60_000);
