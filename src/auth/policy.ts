import {timingSafeEqual} from "node:crypto";

const PROXY_HEADER="x-all-items-proxy-secret";
function proxyMode(){
  const mode=process.env.ALL_ITEMS_PROXY_MODE;
  if(mode===undefined||mode==="")return false;
  if(mode!=="https-proxy")throw new Error("Invalid proxy mode");
  return true;
}
function proxySecret(){
  const secret=process.env.ALL_ITEMS_PROXY_SECRET;
  if(!secret||!/^[A-Za-z0-9_-]{43}$/.test(secret))throw new Error("Invalid proxy secret");
  return secret;
}
export function trustedOrigin(){
  const url=new URL(process.env.ALL_ITEMS_ORIGIN??"http://127.0.0.1:3000");
  if(url.username||url.password||url.pathname!=="/"||url.search||url.hash||!["http:","https:"].includes(url.protocol))throw new Error("Invalid trusted application origin");
  if(proxyMode()){
    if(url.protocol!=="https:")throw new Error("HTTPS proxy mode requires an HTTPS origin");
    proxySecret();
  }else{
    if(url.protocol!=="http:"||!["localhost","127.0.0.1","[::1]"].includes(url.hostname)||process.env.ALL_ITEMS_PROXY_SECRET)throw new Error("Local mode requires loopback HTTP without proxy credentials");
  }
  return url;
}
export function validRequest(headers:Pick<Headers,"get">,mutation=false){
  const trusted=trustedOrigin(),host=headers.get("host");
  if(host!==trusted.host||headers.get("forwarded"))return false;
  const forwardedHost=headers.get("x-forwarded-host"),forwardedProto=headers.get("x-forwarded-proto"),forwardedPort=headers.get("x-forwarded-port");
  const port=trusted.port||(trusted.protocol==="https:"?"443":"80");
  if(proxyMode()){
    const candidate=headers.get(PROXY_HEADER),secret=proxySecret();
    if(!candidate||candidate.length!==secret.length||!timingSafeEqual(Buffer.from(candidate),Buffer.from(secret)))return false;
    if(forwardedHost!==host||forwardedProto!=="https"||forwardedPort!==port)return false;
  }else{
    if(headers.get(PROXY_HEADER))return false;
    // Next may add matching forwarding fields internally even on direct loopback requests.
    if(forwardedHost&&forwardedHost!==host)return false;
    if(forwardedProto&&forwardedProto!=="http")return false;
    if(forwardedPort&&forwardedPort!==port)return false;
  }
  // Forwarded client addresses are not used for identity or throttle partitioning.
  if(mutation&&(headers.get("origin")!==trusted.origin||headers.get("sec-fetch-site")==="cross-site"))return false;
  return true;
}
