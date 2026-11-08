import {trustedOrigin} from "./policy";

export const TELEGRAM_ISSUER="https://oauth.telegram.org";
export const TELEGRAM_CALLBACK="/auth/telegram/callback";
export type TelegramConfig={clientId:string;clientSecret:string;redirectUri:string};
export function telegramConfig():TelegramConfig|null{
  const clientId=process.env.ALL_ITEMS_TELEGRAM_CLIENT_ID,clientSecret=process.env.ALL_ITEMS_TELEGRAM_CLIENT_SECRET;
  if(!clientId&&!clientSecret)return null;
  if(!clientId||!clientSecret||!/^[1-9]\d{0,19}$/.test(clientId)||!/^[\x21-\x7e]{16,256}$/.test(clientSecret))throw new Error("Incomplete Telegram OIDC configuration");
  const origin=trustedOrigin();
  if(process.env.ALL_ITEMS_PROXY_MODE!=="https-proxy"||origin.protocol!=="https:")throw new Error("Telegram OIDC requires the configured HTTPS proxy origin");
  return{clientId,clientSecret,redirectUri:origin.origin+TELEGRAM_CALLBACK};
}
