import {trustedOrigin} from "./policy";

try{
  const origin=trustedOrigin();
  console.log(`Validated ${process.env.ALL_ITEMS_PROXY_MODE==="https-proxy"?"HTTPS proxy":"local loopback"} origin: ${origin.origin}`);
}catch{
  console.error("Invalid application origin or proxy configuration. Check the private deployment configuration before startup.");
  process.exitCode=1;
}
