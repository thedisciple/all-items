import {afterEach,expect,it,vi} from "vitest";
import {browserSHA256,browserUUID} from "./browser-crypto";

afterEach(()=>vi.unstubAllGlobals());
it("uses native UUID where available",()=>{const randomUUID=vi.fn(()=>"01234567-89ab-4cde-8fab-0123456789ab");vi.stubGlobal("crypto",{randomUUID});expect(browserUUID()).toBe("01234567-89ab-4cde-8fab-0123456789ab");expect(randomUUID).toHaveBeenCalledOnce();});
it("uses cryptographic bytes and sets UUID v4 and variant on an insecure context",()=>{vi.stubGlobal("crypto",{getRandomValues:(v:Uint8Array)=>v.fill(255)});expect(browserUUID()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");});
it("fails closed without secure randomness",()=>{vi.stubGlobal("crypto",{});expect(()=>browserUUID()).toThrow("Secure random generation is unavailable");});
it("hashes identically without SubtleCrypto",async()=>{vi.stubGlobal("crypto",{});expect(await browserSHA256(new TextEncoder().encode("abc").buffer)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");});
