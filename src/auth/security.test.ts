import {beforeAll,afterAll,it,expect,vi} from "vitest";
import {mkdtemp,mkdir,readdir,copyFile,readFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createHash,randomUUID} from "node:crypto";
import sharp from "sharp";
vi.unmock("@/auth/request");
const request=vi.hoisted(()=>({token:"",headers:new Headers({host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000"})}));
vi.mock("next/headers",()=>({cookies:async()=>({get:(key:string)=>key==="all-items-session"?{value:request.token}:undefined}),headers:async()=>request.headers}));
vi.mock("next/cache",()=>({revalidatePath:()=>{}}));
import {getDatabase} from "@/db/client";
import {applyMigrations} from "@/db/migrate";
import {provisionAccount,signIn,sessionUser,revokeSession,resetAccount,AccessError,ORIGINAL_OWNER_ID} from "./core";
import {authorizeInventory,requireAdmin,runMaintenance} from "./authority";
import {validRequest} from "./policy";
import {createInventory,listInventories,renameInventory,resolveInventory} from "@/items/inventories";
import {createItem,listItems,getItem,updateItem,saveStock,listCategoryValues,deleteItem} from "@/items/service";
import {createCollection,listCollections,renameCollection,addItemsToCollection,setCollectionCover,deleteCollection} from "@/items/collections";
import {createItemWithPhoto,listItemPhotos,readItemPhoto,addItemPhoto,reorderItemPhotos,setItemPrimaryPhoto,removeItemPhoto,replaceItemPhoto,deleteItemWithMedia} from "@/media/service";
import {readCollectionCover,replaceCollectionCoverUpload} from "@/media/collection-covers";
import {getInventoryPresentation,setInventorySort,saveCategoryPresentations} from "@/items/inventory-presentation";
import {createInventoryArchive,createInventoryCsv} from "@/export/archive";
import {importArchiveAsNew,restoreInventoryArchive} from "@/export/import";
import {deleteInventory} from "@/items/inventory-deletion";
import {finalizeItemCreation} from "@/items/creation";
import type {CreationCommand} from "@/items/creation-command";
import {readWriteReceipt} from "@/items/write-receipts";
import {GET as mediaGET} from "@/app/inventories/[inventoryId]/media/[itemId]/[mediaId]/route";
import {GET as zipGET} from "@/app/inventories/[inventoryId]/api/export/archive/route";
import {GET as csvGET} from "@/app/inventories/[inventoryId]/api/export/csv/route";
import {POST as previewPOST} from "@/app/inventories/[inventoryId]/api/import/preview/route";
import {POST as importPOST} from "@/app/inventories/[inventoryId]/api/import/restore/route";
import {installationBackupAction} from "@/app/backup-actions";
import * as actions from "@/app/actions";
import {stageCreationPhotoAction,finalizeCreationAction} from "@/app/creation-actions";
import {renameInventoryAction,deleteInventoryAction,rememberInventoryAction,saveInventorySortAction} from "@/app/inventory-actions";
import {ownedLegacyInventory} from "@/items/legacy-routes";
import {listItemsPage} from "@/items/service";
import {collectionCandidates,collectionPhotos} from "@/app/collection-read-actions";

let directory:string,ownerToken:string,aliceToken:string,bobToken:string;
let alice:{workspaceId:string},bob:{workspaceId:string},item:string,photo:string,collection:string,cover:string,image:File,archive:Uint8Array;
let migrationPreserved=false;
const pass="Synthetic-P1-password-2026";
const original={workspaceId:"00000000-0000-4000-8000-000000000001"};
const hash=(value:Uint8Array)=>createHash("sha256").update(value).digest("hex");
beforeAll(async()=>{
  directory=await mkdtemp(path.join(os.tmpdir(),"all-items-p1-security-"));process.env.ALL_ITEMS_DATA_DIR=directory;
  const client=(await getDatabase()).$client,migrations=path.join(process.cwd(),"src/db/migrations"),legacy=path.join(directory,"legacy");await mkdir(legacy);
  for(const file of(await readdir(migrations)).filter(file=>file<"0014"))await copyFile(path.join(migrations,file),path.join(legacy,file));
  await applyMigrations(client,legacy);
  image=new File([new Uint8Array(await sharp({create:{width:96,height:72,channels:3,background:"#5c7960"}}).png().toBuffer())],"synthetic.png",{type:"image/png"});
  const seed=await runMaintenance(()=>createItemWithPhoto(original,{name:"Synthetic migrated owner",notes:"Synthetic private owner note"},image));
  const before=(await client.execute("SELECT * FROM items ORDER BY id")).rows,media=(await client.execute("SELECT * FROM media_assets ORDER BY id")).rows;
  const bytes=await runMaintenance(async()=>readItemPhoto(original,seed.id,String(media[0]!.id),"image"));
  await applyMigrations(client,migrations);await applyMigrations(client,migrations);
  migrationPreserved=JSON.stringify(before)===JSON.stringify((await client.execute("SELECT * FROM items ORDER BY id")).rows)&&JSON.stringify(media)===JSON.stringify((await client.execute("SELECT * FROM media_assets ORDER BY id")).rows)&&hash(bytes!)===hash((await runMaintenance(()=>readItemPhoto(original,seed.id,String(media[0]!.id),"image")))!);
  await provisionAccount(client,"synthetic-owner",pass,true);await provisionAccount(client,"synthetic-alice",pass);await provisionAccount(client,"synthetic-bob",pass);
  ownerToken=(await signIn(client,directory,"synthetic-owner",pass)).token;aliceToken=(await signIn(client,directory,"synthetic-alice",pass)).token;bobToken=(await signIn(client,directory,"synthetic-bob",pass)).token;
  request.token=aliceToken;expect(await listInventories()).toEqual([]);alice=await createInventory("Synthetic shared name");const created=await createItemWithPhoto(alice,{name:"Synthetic Alice camera",categories:["tools"],trackingMode:"bulk"},image,image,"",[{location:"Synthetic shelf",quantity:3}]);item=created.id;photo=(await listItemPhotos(alice,item))[0]!.id;
  collection=(await createCollection(alice,{name:"Synthetic Alice collection"})).id;cover=await replaceCollectionCoverUpload(alice,collection,image);await addItemsToCollection(alice,collection,[item]);archive=await createInventoryArchive(alice);
  request.token=bobToken;expect(await listInventories()).toEqual([]);bob=await createInventory("Synthetic shared name");await createItem(bob,{name:"Synthetic Bob item"});
},120_000);
afterAll(async()=>{await(await getDatabase()).$client.close();});
it("secures paged collection reads and legacy bookmarks against other users and admin",async()=>{
  request.headers=new Headers({host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000"});
  const input={inventoryId:alice.workspaceId,collectionId:collection,query:"",page:1};
  request.token=aliceToken;expect(await ownedLegacyInventory("item",item)).toEqual({workspaceId:alice.workspaceId});expect(await ownedLegacyInventory("collection",collection)).toEqual({workspaceId:alice.workspaceId});
  expect((await listItemsPage(alice)).total).toBe(1);expect((await collectionPhotos(input)).items[0]!.mediaId).toBe(photo);expect((await collectionCandidates(input)).total).toBe(0);
  for(const token of[bobToken,ownerToken]){request.token=token;expect(await ownedLegacyInventory("item",item)).toBeNull();expect(await ownedLegacyInventory("collection",collection)).toBeNull();await expect(listItemsPage(alice)).rejects.toBeInstanceOf(AccessError);await expect(collectionPhotos(input)).rejects.toBeInstanceOf(AccessError);await expect(collectionCandidates(input)).rejects.toBeInstanceOf(AccessError);}
  request.token=aliceToken;request.headers=new Headers({host:"127.0.0.1:3000",origin:"https://attacker.invalid"});await expect(collectionCandidates(input)).rejects.toThrow();await expect(collectionPhotos(input)).rejects.toThrow();request.headers=new Headers({host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000"});
});
it("preserves the migrated owner's records and media and gives invitees no inherited inventory",async()=>{
  expect(migrationPreserved).toBe(true);const client=(await getDatabase()).$client;
  expect((await client.execute("PRAGMA integrity_check")).rows[0]!.integrity_check).toBe("ok");expect((await client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
  request.token=ownerToken;expect((await listInventories()).map(row=>row.workspaceId)).toEqual([original.workspaceId]);expect((await getItem(original,String((await listItems(original))[0]!.id)))!.notes).toContain("owner note");
  await expect(resolveInventory(alice.workspaceId)).rejects.toBeInstanceOf(AccessError);
  const users=(await client.execute("SELECT * FROM auth_users")).rows;expect(users.every(row=>String(row.password_hash).startsWith("scrypt:131072:8:1:"))).toBe(true);expect(new Set(users.map(row=>row.password_hash)).size).toBe(3);
  expect(JSON.stringify((await client.execute("SELECT * FROM auth_sessions")).rows)).not.toContain(ownerToken);expect((await readFile(path.join(directory,"auth-session-key"))).length).toBe(32);
  const unowned=randomUUID();await client.execute({sql:"INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)",args:[unowned,"Synthetic unowned",new Date().toISOString()]});await expect(resolveInventory(unowned)).rejects.toBeInstanceOf(AccessError);expect((await listInventories()).map(row=>row.workspaceId)).not.toContain(unowned);
});
it("rejects cross-user reads and mutations at every shared resource boundary",async()=>{
  request.token=bobToken;const client=(await getDatabase()).$client,before=JSON.stringify((await client.execute("SELECT * FROM items ORDER BY id")).rows);
  const attacks:Array<()=>Promise<unknown>>=[()=>authorizeInventory(alice.workspaceId),()=>resolveInventory(alice.workspaceId),()=>listItems(alice),()=>getItem(alice,item),()=>createItem(alice,{name:"attack"}),()=>updateItem(alice,item,{name:"attack"}),()=>saveStock(alice,item,[{quantity:99,location:"attack"}]),()=>deleteItem(alice,item),()=>listCategoryValues(alice),()=>getInventoryPresentation(alice),()=>setInventorySort(alice,"name"),()=>listCollections(alice),()=>createCollection(alice,{name:"attack"}),()=>renameCollection(alice,collection,{name:"attack"}),()=>addItemsToCollection(alice,collection,[item]),()=>setCollectionCover(alice,collection,{type:"default"}),()=>deleteCollection(alice,collection),()=>listItemPhotos(alice,item),()=>addItemPhoto(alice,item,image),()=>replaceItemPhoto(alice,item,photo,image),()=>setItemPrimaryPhoto(alice,item,photo),()=>reorderItemPhotos(alice,item,[photo]),()=>removeItemPhoto(alice,item,photo),()=>deleteItemWithMedia(alice,item),()=>replaceCollectionCoverUpload(alice,collection,image),()=>readCollectionCover(alice,collection,cover),()=>createInventoryArchive(alice),()=>createInventoryCsv(alice),()=>importArchiveAsNew(alice,archive,"attack",{client,directory}),()=>restoreInventoryArchive(archive,{client,directory,workspaceId:alice.workspaceId}),()=>deleteInventory(alice,"Synthetic shared name",{client,directory}),()=>readWriteReceipt(client,alice,{operationId:randomUUID(),kind:"item_create",requestHash:"a".repeat(64)}),()=>saveCategoryPresentations(client,alice.workspaceId,[{category:"Attack",emoji:"🛠️"}],["Attack"]),()=>requireAdmin()];
  for(const attack of attacks)await expect(attack()).rejects.toBeInstanceOf(AccessError);
  for(const variant of["image","source","thumbnail"])await expect(readItemPhoto(alice,item,photo,variant)).rejects.toBeInstanceOf(AccessError);
  // An owned context with foreign item/collection/media IDs also yields no private data.
  expect(await getItem(bob,item)).toBeNull();expect(await readItemPhoto(bob,item,photo,"source")).toBeNull();expect(await readCollectionCover(bob,collection,cover)).toBeNull();
  expect(JSON.stringify((await client.execute("SELECT * FROM items ORDER BY id")).rows)).toBe(before);
});
it("protects direct handlers and Server Actions, not only navigation",async()=>{
  request.token=bobToken;const params={params:Promise.resolve({inventoryId:alice.workspaceId,itemId:item,mediaId:photo})};
  for(const handler of[mediaGET,zipGET,csvGET])expect((await handler(new Request("http://127.0.0.1:3000/"),params)).status).toBe(404);
  const post=new Request("http://127.0.0.1:3000/",{method:"POST",headers:{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000"},body:"invalid"});
  expect((await previewPOST(post.clone(),params)).status).toBe(404);expect((await importPOST(post.clone(),params)).status).toBe(404);
  const data=new FormData();data.set("inventoryId",alice.workspaceId);data.set("id",item);data.set("itemId",item);data.set("mediaId",photo);data.set("collectionId",collection);data.set("name","attack");data.set("confirm","on");data.set("confirmation","Synthetic shared name");data.set("returnTo",`/inventories/${alice.workspaceId}`);data.set("trackingMode","bulk");data.set("stock",JSON.stringify([{location:"Synthetic shelf",quantity:3}]));data.append("categories","tools");data.set("photo",image);data.set("photoSource",image);data.set("photoWriteId",randomUUID());data.set("operation","primary");
  for(const action of[actions.addItemAction,actions.updateItemAction,actions.replacePhotoAction,actions.createCollectionAction,actions.addItemsToCollectionAction,actions.setCollectionCoverAction,actions.renameCollectionAction,actions.addCollectionMembershipAction,actions.removeCollectionMembershipAction,actions.galleryPhotoAction])expect((await action({status:"idle",message:""},data)).status).toBe("error");
  for(const action of[actions.removeItem,actions.removePhoto,actions.deleteCollectionAction,actions.deleteGalleryPhoto])expect((await action(data))?.status).toBe("error");
  expect((await stageCreationPhotoAction(data)).status).toBe("error");expect((await finalizeCreationAction(data)).status).toBe("error");
  for(const action of[renameInventoryAction,deleteInventoryAction,saveInventorySortAction])expect((await action({status:"idle"},data)).status).toBe("error");await expect(rememberInventoryAction(alice.workspaceId)).rejects.toBeInstanceOf(AccessError);
  data.set("inventoryId",bob.workspaceId);data.set("operation","verify");data.set("backupId",randomUUID());expect((await installationBackupAction({status:"idle",message:""},data)).status).toBe("error");
  request.token="";expect((await mediaGET(new Request("http://127.0.0.1:3000/"),params)).status).toBe(401);await expect(listInventories()).rejects.toBeInstanceOf(AccessError);
});
it("enforces trusted origin/host and rejects spoofed forwarding, missing origin and cross-site POST",async()=>{
  for(const entries of[{host:"attacker.invalid"},{host:"127.0.0.1:3000",origin:"https://attacker.invalid"},{host:"127.0.0.1:3000"},{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000","x-forwarded-host":"attacker.invalid"},{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000","x-forwarded-proto":"https"},{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000",forwarded:"host=attacker.invalid"}])expect(validRequest(new Headers(Object.entries(entries).filter((entry):entry is [string,string]=>entry[1]!==undefined)),true)).toBe(false);
  request.token=aliceToken;expect((await previewPOST(new Request("http://127.0.0.1:3000/",{method:"POST",headers:{host:"127.0.0.1:3000",origin:"https://attacker.invalid"}}),{params:Promise.resolve({inventoryId:alice.workspaceId})})).status).toBe(403);
  request.headers.set("origin","https://attacker.invalid");try{await expect(actions.addItemAction({status:"idle",message:""},new FormData())).rejects.toMatchObject({status:403});}finally{request.headers.set("origin","http://127.0.0.1:3000");}
});
it("keeps imports owned by the importer and functional workflows independent",async()=>{
  request.token=bobToken;const client=(await getDatabase()).$client;
  const imported=await importArchiveAsNew(bob,archive,"Synthetic Bob imported",{client,directory});expect((await listInventories()).map(row=>row.workspaceId)).toContain(imported.inventoryId);expect((await listItems({workspaceId:imported.inventoryId}))).toHaveLength(1);
  request.token=aliceToken;await expect(resolveInventory(imported.inventoryId)).rejects.toBeInstanceOf(AccessError);await renameInventory(alice,"Synthetic Alice renamed");expect((await getItem(alice,item))!.stock).toEqual([{location:"Synthetic shelf",quantity:3}]);
});
it("binds staged operations and receipts to ownership and retains upload limits",async()=>{
  const command:CreationCommand={version:1,inventoryId:alice.workspaceId,operationId:randomUUID(),fields:{name:"Synthetic receipt owner",model:"",brand:"",categories:[],trackingMode:"unique",originalMarking:"",description:"",notes:"",identificationStatus:"unknown",saleIntent:"not_for_sale",askingPrice:"",askingCurrency:""},rows:[{location:"",quantity:"1"}],categoryPresentation:[],photos:[],primaryId:null};
  request.token=aliceToken;const result=await finalizeItemCreation(alice,command);expect((await finalizeItemCreation(alice,command)).itemId).toBe(result.itemId);
  const before=await listItemPhotos(alice,item);await expect(addItemPhoto(alice,item,new File([new Uint8Array(10*1024*1024+1)],"synthetic-too-large.png",{type:"image/png"}))).rejects.toThrow();expect(await listItemPhotos(alice,item)).toEqual(before);
  request.token=bobToken;await expect(finalizeItemCreation(alice,command)).rejects.toBeInstanceOf(AccessError);await expect(finalizeItemCreation(bob,command)).rejects.toThrow();
  const independent=await finalizeItemCreation(bob,{...command,inventoryId:bob.workspaceId});expect(independent.itemId).not.toBe(result.itemId);expect(await getItem(bob,result.itemId)).toBeNull();
});
it("expires and revokes sessions, invalidates reset credentials and throttles failed login",async()=>{
  const client=(await getDatabase()).$client,now=Date.now();const login=await signIn(client,directory,"synthetic-bob",pass,now);
  expect((await sessionUser(login.token,client,directory,now))?.username).toBe("synthetic-bob");expect(await sessionUser(login.token,client,directory,now+31*60*1000)).toBeNull();expect(await sessionUser(login.token,client,directory,now+9*60*60*1000)).toBeNull();await revokeSession(login.token,client,directory);expect(await sessionUser(login.token,client,directory,now)).toBeNull();
  await resetAccount(client,"synthetic-bob",pass+"-reset");expect(await sessionUser(bobToken,client,directory)).toBeNull();
  await client.execute({sql:"UPDATE auth_users SET disabled=1 WHERE username='synthetic-alice'",args:[]});expect(await sessionUser(aliceToken,client,directory)).toBeNull();
  const later=now+20*60*1000;for(let index=0;index<5;index++)await expect(signIn(client,directory,"synthetic-unknown","wrong password",later)).rejects.toMatchObject({code:"authInvalid"});await expect(signIn(client,directory,"synthetic-unknown","wrong password",later)).rejects.toMatchObject({code:"authThrottled"});
  expect((await client.execute({sql:"SELECT user_id FROM inventory_owners WHERE workspace_id=?",args:[original.workspaceId]})).rows[0]!.user_id).toBe(ORIGINAL_OWNER_ID);
});
