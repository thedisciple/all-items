import { MAX_ARCHIVE_BYTES } from "./archive";

export async function readArchiveRequest(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const host = request.headers.get("host");
  if (!host || origin && new URL(origin).host !== host || site && site !== "same-origin" || request.headers.get("x-all-items-import") !== "1" || request.headers.get("content-type") !== "application/zip") throw new Error("invalid-request");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid-request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_ARCHIVE_BYTES) { await reader.cancel(); throw new Error("archive-too-large"); }
    chunks.push(value);
  }
  if (!size) throw new Error("invalid-request");
  return new Uint8Array(Buffer.concat(chunks));
}
