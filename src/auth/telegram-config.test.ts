import {afterEach,beforeEach,expect,it} from "vitest";
import {randomBytes} from "node:crypto";
import {telegramConfig} from "./telegram-config";

const names=["ALL_ITEMS_ORIGIN","ALL_ITEMS_PROXY_MODE","ALL_ITEMS_PROXY_SECRET","ALL_ITEMS_TELEGRAM_CLIENT_ID","ALL_ITEMS_TELEGRAM_CLIENT_SECRET"] as const;
const original=Object.fromEntries(names.map(name=>[name,process.env[name]]));
beforeEach(()=>{for(const name of names)delete process.env[name];});
afterEach(()=>{for(const name of names){const value=original[name];if(value===undefined)delete process.env[name];else process.env[name]=value;}});
it("hides Telegram without credentials and rejects partial or loopback configuration",()=>{
  expect(telegramConfig()).toBeNull();
  process.env.ALL_ITEMS_TELEGRAM_CLIENT_ID="123456789";expect(()=>telegramConfig()).toThrow();
  process.env.ALL_ITEMS_TELEGRAM_CLIENT_SECRET="synthetic-client-secret-123456789";expect(()=>telegramConfig()).toThrow();
  process.env.ALL_ITEMS_ORIGIN="https://pilot.example.test";expect(()=>telegramConfig()).toThrow();
});
it("accepts only an exact HTTPS proxy origin with server-side credentials",()=>{
  process.env.ALL_ITEMS_TELEGRAM_CLIENT_ID="123456789";
  process.env.ALL_ITEMS_TELEGRAM_CLIENT_SECRET="synthetic-client-secret-123456789";
  process.env.ALL_ITEMS_ORIGIN="https://pilot.example.test";
  process.env.ALL_ITEMS_PROXY_MODE="https-proxy";
  process.env.ALL_ITEMS_PROXY_SECRET=randomBytes(32).toString("base64url");
  expect(telegramConfig()?.redirectUri).toBe("https://pilot.example.test/auth/telegram/callback");
  process.env.ALL_ITEMS_TELEGRAM_CLIENT_ID="attacker";expect(()=>telegramConfig()).toThrow();
});
