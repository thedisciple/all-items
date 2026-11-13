import {beforeAll,afterAll,it,expect} from "vitest";
import {mkdtemp,mkdir,writeFile,readFile} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import {getDatabase} from "@/db/client";
import {applyMigrations} from "@/db/migrate";
import {createItemWithPhoto} from "@/media/service";
import {windowsAdapter} from "./windows-adapter";
import {assertSynthetic} from "./paths";
import type {BetaConfig} from "./release";
import {prepareClean} from './clean';
import {command} from './process';
import {isolatedEnvironment} from './environment';

let config:BetaConfig,client:Awaited<ReturnType<typeof getDatabase>>['$client'];
beforeAll(async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'all-items-operations-')),data=path.join(root,'synthetic'),id=crypto.randomUUID();await mkdir(data);process.env.ALL_ITEMS_DATA_DIR=data;client=(await getDatabase()).$client;await applyMigrations(client,path.join(process.cwd(),'src/db/migrations'));
  const image=await sharp({create:{width:80,height:80,channels:3,background:'#536844'}}).png().toBuffer();await createItemWithPhoto({workspaceId:'00000000-0000-4000-8000-000000000001'},{name:'Synthetic operation media'},new File([new Uint8Array(image)],'synthetic.png',{type:'image/png'}));
  await writeFile(path.join(data,'synthetic-installation.json'),JSON.stringify({format:'all-items-synthetic',installationId:id}));config={format:1,purpose:'synthetic-only',installationId:id,repository:process.cwd(),dataDirectory:data,personalDataDirectory:path.join(root,'personal'),releaseRoot:path.join(root,'releases'),runtimeConfig:path.join(root,'private.env'),appService:'MockApp',caddyService:'MockCaddy',appServiceXml:path.join(root,'app.xml'),publicOrigin:'https://synthetic.example.ts.net',tailscaleExecutable:process.execPath};
});
afterAll(()=>client.close());
it('creates/verifies a complete synthetic snapshot and restores database plus media into fresh durable directories',async()=>{
  const adapter=windowsAdapter(config,path.join(config.releaseRoot,'private.json')),backup=await adapter.backup(config.dataDirectory),restored=await adapter.restore(backup);
  expect(restored).not.toBe(config.dataDirectory);await expect(assertSynthetic(restored,config.installationId,config.personalDataDirectory,config.repository)).resolves.toBe(restored);
  expect(await readFile(path.join(restored,'all-items.db'))).toBeTruthy();const again=await adapter.backup(restored);expect(again.semanticHash).toBe(backup.semanticHash);
},60_000);
it('fails closed for personal, repository, unmarked or mismatched directories',async()=>{
  await expect(assertSynthetic(config.dataDirectory,crypto.randomUUID(),config.personalDataDirectory,config.repository)).rejects.toThrow();
  await expect(assertSynthetic(config.personalDataDirectory,config.installationId,config.personalDataDirectory,config.repository)).rejects.toThrow();await expect(assertSynthetic(config.repository,config.installationId,config.personalDataDirectory,config.repository)).rejects.toThrow();
});
it('prepares an empty managed installation with a real verified backup/drill without modifying the previous data',async()=>{
  const old=await readFile(path.join(config.dataDirectory,'all-items.db')),sha='a'.repeat(40);
  await writeFile(config.runtimeConfig,'ALL_ITEMS_ORIGIN=https://synthetic.example.ts.net\nALL_ITEMS_PROXY_MODE=https-proxy\nALL_ITEMS_PROXY_SECRET=synthetic-private-assertion');
  const adapter=windowsAdapter(config,path.join(config.releaseRoot,'private.json'));
  const plan=await prepareClean(config,sha,{...adapter,candidate:async()=>{},build:async()=>config.repository,migrate:async(_release,data)=>{await command(process.execPath,['--import','tsx','src/db/migrate.ts'],config.repository,isolatedEnvironment(data,'http://127.0.0.1:3201',sha));},services:async()=>{throw new Error('Preparation must not require running services');}});
  expect(plan.preflight.source).toBe(plan.data);expect(plan.drill).not.toBe(plan.data);expect(plan.data).not.toBe(config.dataDirectory);
  expect(await readFile(path.join(config.dataDirectory,'all-items.db'))).toEqual(old);expect(await readFile(plan.runtime,'utf8')).toContain(plan.data);
  expect((await adapter.backup(plan.drill)).semanticHash).toBe(plan.preflight.semanticHash);
},60_000);
