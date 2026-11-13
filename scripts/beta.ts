import {parseArgs} from "node:util";
import {readFile,writeFile,mkdir,access} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";
import {loadConfig,status,windowsAdapter} from "../src/operations/windows-adapter";
import {deployedSchema,prepare,deploy,rollback,stopSharing,type Plan,type State} from "../src/operations/release";
import {within,withReleaseLock} from "../src/operations/paths";

async function main(){
  const {values,positionals}=parseArgs({allowPositionals:true,options:{config:{type:'string'},sha:{type:'string'},plan:{type:'string'},approve:{type:'string'}}});
  if(!values.config)throw new Error('Pass --config with an explicit private beta configuration outside Git');
  const file=path.resolve(values.config),config=await loadConfig(file),adapter=windowsAdapter(config,file),stateFile=path.join(config.releaseRoot,'state.json');
  let state:State|null=null;try{state=z.object({current:deployedSchema,previous:deployedSchema.extend({backup:z.object({id:z.uuid(),source:z.string(),semanticHash:z.string().regex(/^[a-f0-9]{64}$/)})}).optional()}).strict().parse(JSON.parse(await readFile(stateFile,'utf8')));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const action=positionals[0];
  if(action==='status'||action==='dry-run'){
    const report=await status(config,state,adapter);let candidate='not-requested';if(values.sha){try{await adapter.candidate(values.sha);candidate='pushed-draft-PR-CI-green';}catch{candidate='not-verified';report.blocks.push('candidate-PR-CI-not-green');}}
    console.log(JSON.stringify({...report,candidate,requestedSha:values.sha??null,activation:'not performed',approvalRequired:config.installationId},null,2));return;
  }
  await withReleaseLock(config.releaseRoot,async()=>{
  if(action==='stop-sharing'){await stopSharing(config,values.approve??'',adapter);console.log('Caddy adapter stopped; backend, Funnel configuration and unrelated services retained.');return;}
  let interrupted=false;try{await access(path.join(config.releaseRoot,'recovery-required.json'));interrupted=true;}catch{/* No interrupted switch recorded. */}if(interrupted)throw new Error('Review interrupted operation before continuing');
  if(!state)throw new Error('No verified deployed baseline receipt. Follow the documented approved baseline-adoption gate; checkout HEAD is not proof of deployed build.');
  for(const deployed of[state.current,state.previous].filter(Boolean)){
    if(deployed!.release!==path.join(config.releaseRoot,deployed!.sha))throw new Error('Unmanaged baseline release refused');
    const receipt=JSON.parse(await readFile(path.join(deployed!.release,'.all-items-release.json'),'utf8'));if(receipt.sha!==deployed!.sha)throw new Error('Baseline build receipt mismatch');
  }
  if(action==='prepare'){
    if(!values.sha)throw new Error('Pass an exact --sha');const plan=await prepare(config,state,values.sha,adapter),destination=path.join(config.releaseRoot,'plans',plan.id+'.json');await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({candidate:plan.candidate,plan:destination,backup:plan.preflight.id,restoreDrill:'verified',approvalRequired:config.installationId}));return;
  }
  if(action==='deploy'){
    if(!values.plan||!within(path.join(config.releaseRoot,'plans'),values.plan))throw new Error('Use a generated private plan path');
    const text=await readFile(values.plan,'utf8');if(text.length>32_000)throw new Error('Oversized plan');const plan=JSON.parse(text) as Plan;
    if(plan.format!==1||!z.uuid().safeParse(plan.id).success||!Number.isSafeInteger(plan.createdAt)||plan.release!==path.join(config.releaseRoot,plan.candidate))throw new Error('Invalid plan');
    const receipt=JSON.parse(await readFile(path.join(plan.release,'.all-items-release.json'),'utf8'));if(receipt.sha!==plan.candidate)throw new Error('Prepared build receipt changed');
    console.log(JSON.stringify(await deploy(config,state,plan,values.approve??'',adapter)));return;
  }
  if(action==='rollback'){console.log(JSON.stringify(await rollback(config,state,values.approve??'',adapter)));return;}
  throw new Error('Usage: npm run beta -- status|dry-run|prepare|deploy|rollback|stop-sharing --config PRIVATE.json [--sha SHA] [--plan PLAN] [--approve INSTALLATION_UUID]');
  });
}
main().catch(error=>{const detail=error instanceof z.ZodError?'Invalid private configuration or release state.':error instanceof Error&&!('code' in error)?error.message:'Private operation I/O failed.';console.error(detail);console.error('Beta operation refused or failed. Inspect the private journal and run status; do not assume services are healthy or overwrite personal data.');process.exitCode=1;});
