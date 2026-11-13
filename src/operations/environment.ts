import {z} from "zod";

export const revision=z.string().regex(/^[a-f0-9]{40}$/);
// Start from a scrubbed process environment; never inherit live All Items settings.
export function isolatedEnvironment(data:string,origin:string,sha:string,base:NodeJS.ProcessEnv=process.env):NodeJS.ProcessEnv{
  const env={...base};for(const key of Object.keys(env))if(key.startsWith("ALL_ITEMS_")||key==="NODE_OPTIONS")delete env[key];
  const url=new URL(origin);if(url.protocol!=="http:"||!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=="/")throw new Error("Loopback preview origin required");
  return{...env,ALL_ITEMS_DATA_DIR:data,ALL_ITEMS_ORIGIN:url.origin,ALL_ITEMS_RELEASE_SHA:revision.parse(sha),ALL_ITEMS_NEXT_DIST:".next"};
}

export function runtimeValues(text:string){
  const result:Record<string,string>={};const allowed=new Set(['ALL_ITEMS_DOMAIN','ALL_ITEMS_ORIGIN','ALL_ITEMS_PROXY_MODE','ALL_ITEMS_PROXY_SECRET','ALL_ITEMS_DATA_DIR','ALL_ITEMS_TELEGRAM_CLIENT_ID','ALL_ITEMS_TELEGRAM_CLIENT_SECRET']);
  for(const line of text.split(/\r?\n/)){if(!line.trim()||line.trimStart().startsWith('#'))continue;const match=/^([A-Z_]+)=(.*)$/.exec(line);if(!match||!allowed.has(match[1])||match[1] in result)throw new Error("Invalid private runtime configuration");result[match[1]]=match[2];}
  return result;
}
export function pinnedFunnel(value:unknown,origin:string){
  const schema=z.object({AllowFunnel:z.record(z.string(),z.boolean()),TCP:z.record(z.string(),z.object({TCPForward:z.string().optional(),TerminateTLS:z.string().optional(),ProxyProtocol:z.number().optional()}).passthrough())}).passthrough();
  const parsed=schema.safeParse(value),url=new URL(origin);return parsed.success&&parsed.data.AllowFunnel[url.host+':443']===true&&parsed.data.TCP['443']?.TCPForward==='127.0.0.1:8787'&&parsed.data.TCP['443']?.TerminateTLS===url.hostname&&!(parsed.data.TCP['443']?.ProxyProtocol);
}
