import {parseArgs} from "node:util";
import {mkdir,readFile,writeFile,lstat} from "node:fs/promises";
import {createServer} from "node:net";
import path from "node:path";
import os from "node:os";
import {randomUUID} from "node:crypto";
import {command,serve} from "../src/operations/process";
import {isolatedEnvironment} from "../src/operations/environment";
import {assertSynthetic,plainPath,within} from "../src/operations/paths";
import {buildRelease} from "../src/operations/build";

async function main(){
  const {values}=parseArgs({options:{checkout:{type:"string"},revision:{type:"string"},data:{type:"string"},root:{type:"string"},port:{type:"string",default:"3200"},owner:{type:"boolean",default:false},"check-only":{type:"boolean",default:false}}});
  const repository=path.resolve(values.checkout??process.cwd()),base=process.env.LOCALAPPDATA??path.join(os.homedir(),'.local/share'),personal=process.platform==='win32'?path.join(base,'AllItems'):path.join(os.homedir(),'.all-items');
  const data=await plainPath(path.resolve(values.data??path.join(base,"AllItems-Preview"))),root=path.resolve(values.root??path.join(base,"AllItems-Preview-Releases"));
  const port=Number(values.port);if(!Number.isInteger(port)||port<1024||port>65535||port===3000)throw new Error("Use an independent unprivileged preview port");
  if(within(personal,data)||within(data,personal)||within(repository,data)||within(data,repository)||within(root,data)||within(data,root))throw new Error("Preview data must be isolated from personal data, repository and release storage");
  const sha=await command('git',['rev-parse','--verify',`${values.revision??'HEAD'}^{commit}`],repository),env=isolatedEnvironment(data,`http://127.0.0.1:${port}`,sha);
  let marker;try{marker=JSON.parse(await readFile(path.join(data,'synthetic-installation.json'),'utf8'));}catch{
    // Never adopt an existing unmarked directory, even if its name looks synthetic.
    try{await lstat(data);throw new Error("Existing unmarked preview directory refused");}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
    if(values['check-only']){console.log(JSON.stringify({sha,url:env.ALL_ITEMS_ORIGIN,data,initializationRequired:true}));return;}
    await mkdir(path.dirname(data),{recursive:true});await mkdir(data,{recursive:false});marker={format:'all-items-synthetic',installationId:randomUUID()};await writeFile(path.join(data,'synthetic-installation.json'),JSON.stringify(marker),{flag:'wx',mode:0o600});
  }
  await assertSynthetic(data,marker.installationId,personal,repository);
  if(values['check-only']){console.log(JSON.stringify({sha,url:env.ALL_ITEMS_ORIGIN,data}));return;}
  if(!values.owner)await new Promise<void>((resolve,reject)=>{const probe=createServer();probe.once('error',()=>reject(new Error('Preview port is occupied; choose --port without stopping another installation')));probe.listen(port,'127.0.0.1',()=>probe.close(error=>error?reject(error):resolve()));});
  const release=await buildRelease(repository,root,sha);
  await command(process.execPath,['--import','tsx','src/auth/check-config.ts'],release,env);
  await command(process.execPath,['--import','tsx','src/db/migrate.ts'],release,env);
  console.log(`All Items preview ${sha}\n${env.ALL_ITEMS_ORIGIN}\nIsolated data: ${data}\nUse a separate browser profile. Ctrl+C stops only this preview.`);
  if(values.owner){serve(release,['--import','tsx','src/auth/cli.ts','owner'],env);return;}
  console.log('First installation only: rerun with --owner to explicitly create its account. No default credentials are installed.');
  serve(release,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],env);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Preview failed');process.exitCode=1;});
