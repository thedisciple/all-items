// This bounded milestone accepts one explicit origin. Forwarding never establishes trust.
export function trustedOrigin(){
  const url=new URL(process.env.ALL_ITEMS_ORIGIN??"http://127.0.0.1:3000");
  if(url.username||url.password||url.pathname!=="/"||url.search||url.hash||!["http:","https:"].includes(url.protocol))throw new Error("Invalid trusted application origin");
  if(url.protocol==="http:"&&!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new Error("Plain HTTP requires loopback");
  return url;
}
export function validRequest(headers:Pick<Headers,"get">,mutation=false){
  const trusted=trustedOrigin(),host=headers.get("host");
  if(host!==trusted.host||headers.get("forwarded"))return false;
  if(headers.get("x-forwarded-host")&&headers.get("x-forwarded-host")!==host)return false;
  if(headers.get("x-forwarded-proto")&&headers.get("x-forwarded-proto")!==trusted.protocol.slice(0,-1))return false;
  if(headers.get("x-forwarded-port")&&headers.get("x-forwarded-port")!==(trusted.port||(trusted.protocol==="https:"?"443":"80")))return false;
  // Forwarded client addresses are not used for identity or throttle partitioning.
  if(mutation&&(headers.get("origin")!==trusted.origin||headers.get("sec-fetch-site")==="cross-site"))return false;
  return true;
}
