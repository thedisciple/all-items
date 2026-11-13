import {it,expect} from 'vitest';
import {observe,classifyStatus,loopbackFetch} from './observation';
import {createServer} from 'node:http';
const sha='a'.repeat(40),old='b'.repeat(40),record={sha,release:'/managed/'+sha,runtime:'/private/runtime.env',data:'/synthetic/data'};
const good={state:'verified-response',sha,http:200} as const,bad={state:'unavailable',sha:null,http:null} as const;
it('sends the exact protected Host and assertions over actual loopback HTTP',async()=>{
  const server=createServer((request,response)=>{expect(request.headers.host).toBe('synthetic.example.ts.net');if(request.headers['x-test-legacy']){response.writeHead(404);response.end('x'.repeat(10000));return;}expect(request.headers['x-all-items-proxy-secret']).toBe('synthetic-assertion');response.end(JSON.stringify({status:'ok',version:'0.1.0',revision:sha}));});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const address=server.address();if(!address||typeof address==='string')throw new Error('Missing isolated port');const url=`http://127.0.0.1:${address.port}/api/health`;expect(await observe(url,{Host:'synthetic.example.ts.net','x-all-items-proxy-secret':'synthetic-assertion'},loopbackFetch)).toEqual(good);expect(await observe(url,{Host:'synthetic.example.ts.net','x-test-legacy':'true'},loopbackFetch)).toEqual({state:'version-unknown',sha:null,http:404});}finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
it('validates a bounded health body without following redirects or exposing private responses',async()=>{
  const fetcher=(async(_url,init)=>{expect(init?.redirect).toBe('manual');return new Response(JSON.stringify({status:'ok',version:'0.1.0',revision:sha}));}) as typeof fetch;
  expect(await observe('http://127.0.0.1:3000/api/health',{},fetcher)).toEqual(good);
  for(const response of[new Response('x'.repeat(4097)),new Response('{}'),new Response(null,{status:302})])expect((await observe('http://localhost',{},(async()=>response) as typeof fetch)).sha).toBeNull();
});
it('does not confuse the saved SHA with the running SHA, binding, reachability or acceptance',()=>{
  const services={app:'Running',caddy:'Running',binding:{release:record.release,runtime:record.runtime}},health={backend:good,proxy:good,external:good};
  expect(classifyStatus(services,record,health,false,false)).toMatchObject({state:'running-and-version-verified',deployedSha:sha,recordedSha:sha});
  expect(classifyStatus(services,record,{...health,backend:{...good,sha:old}},false,false)).toMatchObject({state:'running-version-mismatch',deployedSha:old,recordedSha:sha});
  expect(classifyStatus({...services,binding:null},record,health,false,false).state).toBe('running-version-mismatch');
  expect(classifyStatus(services,null,{backend:{...good,sha:null},proxy:good,external:good},false,false).state).toBe('running-version-unknown');
  expect(classifyStatus({...services,caddy:'Stopped'},record,health,false,false).state).toBe('proxy-unavailable');
  expect(classifyStatus(services,record,{...health,external:bad},false,false).state).toBe('remote-unreachable');
  expect(classifyStatus(services,record,health,false,true).state).toBe('acceptance-failed');
  expect(classifyStatus(services,record,health,true,true).state).toBe('recovery-required');
});
