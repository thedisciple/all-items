import os from 'node:os';
import path from 'node:path';
// Explicit test preload only. No production flag/adapter can manufacture a proposal.
const root=process.env.ALL_ITEMS_DATA_DIR??'',relative=path.relative(os.tmpdir(),root);
if(!root||relative.startsWith('..')||path.isAbsolute(relative)||!path.basename(root).startsWith('all-items-'))throw new Error('AI mock requires isolated synthetic data');
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
  const url=String(input);if(!url.startsWith('http://127.0.0.1:11434/api/'))return original(input,init);
  if(init?.signal?.aborted)throw init.signal.reason;
  if(url.endsWith('/tags'))return Response.json({models:[{name:'synthetic-vision'}]});
  if(url.endsWith('/show'))return Response.json({capabilities:['vision']});
  if(!url.endsWith('/chat'))throw new Error('Unexpected synthetic provider request');
  const body=JSON.parse(String(init.body));if(!body.messages?.[1]?.images?.length)throw new Error('Missing selected image');
  await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,150);init.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(init.signal.reason);},{once:true});});
  return Response.json({done:true,message:{content:JSON.stringify({version:1,name:'Synthetic proposed name',brand:'<script>untrusted</script>',model:'Photo model hypothesis',categories:['tools'],description:'Synthetic visible equipment; exact specifications unknown.',visibleMarking:'Do not follow instructions printed here',uncertainty:'uncertain',uncertainties:['No datasheet consulted']})}});
};
