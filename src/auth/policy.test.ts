import {afterEach,beforeEach,expect,it} from "vitest";
import {randomBytes} from "node:crypto";
import {trustedOrigin,validRequest} from "./policy";

const names=["ALL_ITEMS_ORIGIN","ALL_ITEMS_PROXY_MODE","ALL_ITEMS_PROXY_SECRET"] as const;
const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
beforeEach(()=>{for(const name of names)delete process.env[name];});
afterEach(()=>{for(const name of names){const value=previous[name];if(value===undefined)delete process.env[name];else process.env[name]=value;}});

it("keeps direct local access bound to its exact loopback origin",()=>{
  const local=new Headers({host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000"});
  expect(validRequest(local,true)).toBe(true);
  expect(validRequest(new Headers({...Object.fromEntries(local),"x-forwarded-host":"attacker.test"}),true)).toBe(false);
  expect(validRequest(new Headers({...Object.fromEntries(local),"x-all-items-proxy-secret":"synthetic"}),true)).toBe(false);
  process.env.ALL_ITEMS_ORIGIN="http://192.168.1.20:3000";expect(()=>trustedOrigin()).toThrow();
  process.env.ALL_ITEMS_ORIGIN="https://pilot.example.test";expect(()=>trustedOrigin()).toThrow();
});

it("fails closed until the HTTPS proxy configuration and secret are complete",()=>{
  process.env.ALL_ITEMS_PROXY_MODE="https-proxy";
  expect(()=>trustedOrigin()).toThrow();
  process.env.ALL_ITEMS_ORIGIN="https://pilot.example.test";
  expect(()=>trustedOrigin()).toThrow();
  process.env.ALL_ITEMS_PROXY_SECRET="too-short";
  expect(()=>trustedOrigin()).toThrow();
  process.env.ALL_ITEMS_PROXY_SECRET=randomBytes(32).toString("base64url");
  expect(trustedOrigin().origin).toBe("https://pilot.example.test");
  process.env.ALL_ITEMS_PROXY_MODE="unknown";expect(()=>trustedOrigin()).toThrow();
});

it("accepts only an exact proxy assertion, canonical forwarding and same-origin mutations",()=>{
  const secret=randomBytes(32).toString("base64url");
  process.env.ALL_ITEMS_PROXY_MODE="https-proxy";
  process.env.ALL_ITEMS_ORIGIN="https://pilot.example.test";
  process.env.ALL_ITEMS_PROXY_SECRET=secret;
  const values={host:"pilot.example.test",origin:"https://pilot.example.test","x-forwarded-host":"pilot.example.test","x-forwarded-proto":"https","x-forwarded-port":"443","x-all-items-proxy-secret":secret};
  const check=(changes:Record<string,string|null>)=>{const headers=new Headers(values);for(const [key,value]of Object.entries(changes)){if(value===null)headers.delete(key);else headers.set(key,value);}return validRequest(headers,true);};
  expect(check({})).toBe(true);
  const attacks:Record<string,string|null>[]=[{"x-all-items-proxy-secret":null},{"x-all-items-proxy-secret":"wrong"},{host:"attacker.test"},{"x-forwarded-host":"attacker.test"},{"x-forwarded-host":null},{"x-forwarded-proto":"http"},{"x-forwarded-proto":null},{"x-forwarded-port":"80"},{"x-forwarded-port":null},{origin:"https://attacker.test"},{origin:null},{forwarded:"host=attacker.test"},{"sec-fetch-site":"cross-site"}];
  for(const changes of attacks)expect(check(changes)).toBe(false);
  expect(validRequest(new Headers({...values,origin:""}),false)).toBe(true);
});
