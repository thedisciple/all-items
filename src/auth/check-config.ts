import {trustedOrigin} from "./policy";
import {telegramConfig} from "./telegram-config";

try{
  const origin=trustedOrigin();
  const telegram=telegramConfig();
  console.log(`Validated ${process.env.ALL_ITEMS_PROXY_MODE==="https-proxy"?"HTTPS proxy":"local loopback"} origin: ${origin.origin}`);
  if(telegram)console.log(`Validated Telegram OIDC callback: ${telegram.redirectUri}`);
}catch{
  console.error("Invalid application origin or proxy configuration. Check the private deployment configuration before startup.");
  process.exitCode=1;
}
