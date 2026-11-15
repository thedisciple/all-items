import {z} from 'zod';
export const modelName=z.string().min(1).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9._/:\-]*$/).refine(value=>!value.endsWith(':cloud')&&!value.includes('..'));
export function aiConfiguration(env:Readonly<Record<string,string|undefined>>=process.env){
  // This first slice is deliberately unavailable through the HTTPS beta proxy.
  if(env.ALL_ITEMS_AI_PROVIDER!=='ollama'||env.ALL_ITEMS_PROXY_MODE)return null;
  let origin:URL;try{origin=new URL(env.ALL_ITEMS_ORIGIN??'http://127.0.0.1:3000');}catch{return null;}if(origin.protocol!=='http:'||!['127.0.0.1','localhost'].includes(origin.hostname))return null;
  const model=modelName.safeParse(env.ALL_ITEMS_AI_MODEL);return model.success?{model:model.data}:null;
}
