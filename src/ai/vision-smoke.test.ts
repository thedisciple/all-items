import {it,expect} from 'vitest';
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {OllamaProvider} from './ollama';
import {suggestionSchema} from './contracts';

// Explicit opt-in only; never runs an installed model during ordinary tests/CI.
it.skipIf(process.env.ALL_ITEMS_OLLAMA_SMOKE!=='1')('accepts one original synthetic equipment drawing through installed local vision',async()=>{
  const image=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#eee"/><rect x="292" y="38" width="56" height="180" rx="18" fill="#d54a35"/><rect x="311" y="215" width="18" height="150" fill="#999"/><path d="M311 365 L329 365 L333 410 L307 410Z" fill="#666"/></svg>')).jpeg().toBuffer();
  const start=performance.now(),result=await new OllamaProvider('qwen3.5:4b').identify({images:[image],locale:'en',signal:AbortSignal.timeout(90000)});expect(suggestionSchema.safeParse(result).success).toBe(true);
  const elapsedMs=Math.round(performance.now()-start),ps=await fetch('http://127.0.0.1:11434/api/ps').then(response=>response.json()),model=ps.models?.find((model:{name:string})=>model.name==='qwen3.5:4b');
  const evidence={model:'qwen3.5:4b',elapsedMs,visionRequestAccepted:true,schemaValid:true,residentVramBytes:model?.size_vram??null,accuracy:'not measured; one synthetic drawing'};
  await writeFile(path.join(os.tmpdir(),'all-items-m5a-vision-smoke.json'),JSON.stringify(evidence));console.log('Local synthetic vision smoke:',evidence);
},110_000);
