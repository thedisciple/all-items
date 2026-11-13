import {parseArgs} from "node:util";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";
import {loadConfig,status,windowsAdapter} from "../src/operations/windows-adapter";
import {prepare,deploy,rollback,stopSharing,type Plan} from "../src/operations/release";
import {within} from "../src/operations/paths";
import {readState,withCurrentState,recoveryRequired} from "../src/operations/state";
import {prepareClean,readCleanPlan,activateClean} from '../src/operations/clean';
import {spawn} from 'node:child_process';
import {isolatedEnvironment} from '../src/operations/environment';
import {serve} from '../src/operations/process';

async function main(){
  const {values,positionals}=parseArgs({allowPositionals:true,options:{config:{type:'string'},sha:{type:'string'},plan:{type:'string'},approve:{type:'string'},account:{type:'string'}}});
  if(!values.config)throw new Error('Pass --config with an explicit private beta configuration outside Git');
  const file=path.resolve(values.config),config=await loadConfig(file),adapter=windowsAdapter(config,file);
  const action=positionals[0];
  // Emergency closure must remain possible with corrupt state, stale locks or unavailable data.
  if(action==='stop-sharing'){const result=await stopSharing(config,values.approve??'',adapter);console.log('Caddy adapter stopped; verify external unreachability. '+(result.journalRecorded?'Private journal recorded.':'Warning: private journal unavailable.'));return;}
  if(action==='status'||action==='dry-run'){
    let state=null,stateUnreadable=false;try{state=await readState(config.releaseRoot);}catch{stateUnreadable=true;}
    const report=await status(config,state,adapter,{stateUnreadable});let candidate='not-requested';if(values.sha){try{await adapter.candidate(values.sha);candidate='pushed-draft-PR-CI-green';}catch{candidate='not-verified';report.blocks.push('candidate-PR-CI-not-green');}}
    console.log(JSON.stringify({...report,candidate,requestedSha:values.sha??null,activation:'not performed',approvalRequired:config.installationId},null,2));return;
  }
  await withCurrentState(config.releaseRoot,async(state)=>{
  if(await recoveryRequired(config.releaseRoot))throw new Error('Review interrupted operation before continuing');
  if(['prepare-new','accounts-new','preview-new','activate-new'].includes(action??'')){
    if(state)throw new Error('Managed state already exists; use prepare/deploy instead');
    if(action==='prepare-new'){
      if(!values.sha)throw new Error('Pass exact --sha');const plan=await prepareClean(config,values.sha,adapter),destination=path.join(config.releaseRoot,'plans',plan.id+'.json');await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({candidate:plan.candidate,plan:destination,backup:plan.preflight.id,restoreDrill:'verified',activation:'not performed',approvalRequired:config.installationId}));return;
    }
    if(!values.plan)throw new Error('Pass generated --plan');const plan=await readCleanPlan(config,path.resolve(values.plan));
    if(action==='preview-new'){
      await adapter.assertData(plan.data);console.log(`Synthetic staged beta ${plan.candidate}: http://127.0.0.1:3201. Use a separate browser profile; stop this preview before activation.`);
      const child=serve(plan.release,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3201'],isolatedEnvironment(plan.data,'http://127.0.0.1:3201',plan.candidate));
      await new Promise<void>((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0||code===null?resolve():reject(new Error('Staged preview failed')));});return;
    }
    if(action==='accounts-new'){
      if(!['owner','invite'].includes(values.account??''))throw new Error('Use --account owner or invite for staged synthetic accounts');await adapter.assertData(plan.data);
      await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','src/auth/cli.ts',values.account!],{cwd:plan.release,env:isolatedEnvironment(plan.data,'http://127.0.0.1:3201',plan.candidate),stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Staged account operation failed')));});return;
    }
    console.log(JSON.stringify(await activateClean(config,plan,values.approve??'',adapter)));return;
  }
  if(!state)throw new Error('No verified deployed baseline. Use prepare-new for a separate clean synthetic installation; checkout HEAD is not deployed identity.');
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
  throw new Error('Usage: npm run beta -- status|dry-run|prepare-new|accounts-new|preview-new|activate-new|prepare|deploy|rollback|stop-sharing --config PRIVATE.json [--sha SHA] [--plan PLAN] [--account owner|invite] [--approve INSTALLATION_UUID]');
  });
}
main().catch(error=>{const detail=error instanceof z.ZodError?'Invalid private configuration or release state.':error instanceof Error&&!('code' in error)?error.message:'Private operation I/O failed.';console.error(detail);console.error('Beta operation refused or failed. Inspect the private journal and run status; do not assume services are healthy or overwrite personal data.');process.exitCode=1;});
