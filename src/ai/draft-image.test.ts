import { it, expect } from 'vitest';
import sharp from 'sharp';
import { draftBytes } from './draft-image';
it('bounds the stream before buffering and rejects unsupported content types', async () => {
    for (const [type, size] of [['text/plain', 10], ['image/jpeg', 512 * 1024 + 1], ['image/jpeg', 0]] as const)
        await expect(draftBytes(new Request('http://localhost', { method: 'POST', headers: { 'content-type': type }, body: new Uint8Array(size) }))).rejects.toThrow();
    const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).jpeg().toBuffer();
    expect(await draftBytes(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(bytes) }))).toEqual(bytes);
});
it('cancels a stalled stream without retaining the reader', async () => {
    const abort = new AbortController();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
    const request = new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body, signal: abort.signal, duplex: 'half' } as RequestInit);
    const result = draftBytes(request);
    abort.abort();
    await expect(result).rejects.toMatchObject({ key: 'aiCancelled' });
    expect(cancelled).toBe(true);
});
