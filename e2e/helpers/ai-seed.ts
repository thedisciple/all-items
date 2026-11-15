import {writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {getDatabase,dataDirectory} from '../../src/db/client';
import {runMaintenance} from '../../src/auth/authority';
import {createItemWithPhoto,addItemPhoto,listItemPhotos} from '../../src/media/service';
async function main(){
  const root=dataDirectory(),relative=path.relative(os.tmpdir(),root);if(relative.startsWith('..')||path.isAbsolute(relative)||!path.basename(root).startsWith('all-items-'))throw new Error('Synthetic data only');
  const client=(await getDatabase()).$client;
  try{await runMaintenance(async()=>{const context={workspaceId:'00000000-0000-4000-8000-000000000001'},bytes=await sharp({create:{width:180,height:120,channels:3,background:'#547b55'}}).png().toBuffer(),image=new File([new Uint8Array(bytes)],'synthetic.png',{type:'image/png'});const item=await createItemWithPhoto(context,{name:'Human item name',brand:'Human brand',categories:['Human custom category'],originalMarking:'Human marking',notes:'Human notes',identificationStatus:'user_confirmed',saleIntent:'considering'},image);await addItemPhoto(context,item.id,image);await writeFile(path.join(root,'ai-fixture.json'),JSON.stringify({inventoryId:context.workspaceId,id:item.id,photos:await listItemPhotos(context,item.id)}));});}finally{client.close();}
}
main().catch(()=>{console.error('Synthetic AI fixture failed');process.exitCode=1;});
