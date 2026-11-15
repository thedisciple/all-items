import {beforeAll,afterAll,it,expect} from 'vitest';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {getDatabase} from '@/db/client';import {applyMigrations} from '@/db/migrate';

import {createItem,getItemRevision,updateItem,getItem} from './service';
import {saveEvidence,readEvidence,citationUrl} from './source-evidence';
import {createInventoryArchive} from '@/export/archive';import {verifyInventoryArchive} from '@/export/archive';
import {createBackup,verifyBackup,restoreDrill} from '@/backup/service';import {dataDirectory} from '@/db/client';
let client:Awaited<ReturnType<typeof getDatabase>>['$client'],id:string;
const context={workspaceId:'00000000-0000-4000-8000-000000000001'};
beforeAll(async()=>{process.env.ALL_ITEMS_DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'all-items-source-'));client=(await getDatabase()).$client;await applyMigrations(client,path.join(process.cwd(),'src/db/migrations'));id=(await createItem(context,{name:'Human name',brand:'Maker',model:'Exact',originalMarking:'Private serial',notes:'Keep notes'})).id;});
afterAll(()=>client.close());
const review=async()=>({revision:await getItemRevision(context,id),confirm:true,url:'https://manufacturer.example/manual.pdf',label:'Official manual',match:'Exact model and connector match',locator:'Page 3',brand:'Maker',model:'Exact'});
it('requires explicit attestation, saves identity snapshot and rejects duplicate stale submission',async()=>{
 const input=await review();await expect(saveEvidence(context,id,{...input,confirm:false})).rejects.toThrow();expect(await readEvidence(context,id)).toBeNull();await saveEvidence(context,id,input);expect(await readEvidence(context,id)).toMatchObject({brand:'Maker',model:'Exact',marking:'Private serial'});await expect(saveEvidence(context,id,input)).rejects.toThrow('changed');expect((await getItem(context,id))!.notes).toBe('Keep notes');
});
it('retains evidence on unrelated reviewed edits and removes it on normal/AI identity changes',async()=>{
 await updateItem(context,id,{name:''},undefined,{revision:await getItemRevision(context,id),patch:{name:'Only name'}});expect(await readEvidence(context,id)).not.toBeNull();await updateItem(context,id,{name:''},undefined,{revision:await getItemRevision(context,id),patch:{model:'Other model'}});expect(await readEvidence(context,id)).toBeNull();expect((await getItem(context,id))!.identification_status).toBe('user_confirmed');await saveEvidence(context,id,await review());
});
it('exports revision 7 evidence and removes it without changing item identity',async()=>{
 const archive=await createInventoryArchive(context);expect(verifyInventoryArchive(archive).version).toBe(7);const backup=await createBackup(dataDirectory(),{pinned:true});await verifyBackup(dataDirectory(),backup.manifest.id);await restoreDrill(dataDirectory(),backup.manifest.id);const before=await getItem(context,id);await saveEvidence(context,id,{revision:await getItemRevision(context,id),remove:true});expect(await readEvidence(context,id)).toBeNull();expect((await getItem(context,id))!.model).toBe(before!.model);
});
it('rejects credential/scheme links and generic status elevation',async()=>{
 for(const url of['http://example.com','javascript:alert(1)','https://user:pass@example.com'])expect(citationUrl.safeParse(url).success).toBe(false);
 await expect(createItem(context,{name:'Forged',identificationStatus:'source_verified'})).rejects.toThrow();await expect(updateItem(context,id,{name:'Forged',identificationStatus:'source_verified'})).rejects.toThrow();
});
