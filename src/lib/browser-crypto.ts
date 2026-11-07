/** Identifiers are cryptographically random even when randomUUID is restricted to secure contexts. */
export function browserUUID(): string {
  const provider = globalThis.crypto;
  if (typeof provider?.randomUUID === "function") return provider.randomUUID();
  if (typeof provider?.getRandomValues !== "function") throw new Error("Secure random generation is unavailable");
  const bytes = provider.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export async function browserSHA256(bytes: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  const hash = subtle ? new Uint8Array(await subtle.digest("SHA-256", bytes)) : (await import("@noble/hashes/sha256")).sha256(new Uint8Array(bytes));
  return Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
}
