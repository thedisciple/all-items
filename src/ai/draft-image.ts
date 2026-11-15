import 'server-only';
import sharp from 'sharp';
import { IdentificationError, suggestionSchema, type IdentificationProvider } from './contracts';
import { withInference } from './service';
import type { InventoryContext } from '@/items/inventory-context';
export async function draftBytes(request: Request, signal = request.signal) {
    const type = request.headers.get('content-type');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type ?? ''))
        throw new IdentificationError('aiInvalid');
    if (!request.body)
        throw new IdentificationError('aiInvalid');
    const reader = request.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    const abort = () => { void reader.cancel().catch(() => { }); };
    signal.addEventListener('abort', abort, { once: true });
    try {
        while (true) {
            if (signal.aborted)
                throw new IdentificationError('aiCancelled');
            const value = await reader.read();
            if (signal.aborted)
                throw new IdentificationError('aiCancelled');
            if (value.done)
                break;
            size += value.value.length;
            if (size > 512 * 1024)
                throw new IdentificationError('aiInvalid');
            chunks.push(value.value);
        }
        if (!size)
            throw new IdentificationError('aiInvalid');
        return Buffer.concat(chunks);
    }
    finally {
        signal.removeEventListener('abort', abort);
        await reader.cancel().catch(() => { });
    }
}
export async function identifyDraft(context: InventoryContext, userId: string, request: Request, provider: IdentificationProvider, locale: string, signal = request.signal) {
    return withInference(context, userId, signal, async () => {
        const bytes = await draftBytes(request, signal);
        const format = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png' : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
        if (!format || format !== request.headers.get('content-type'))
            throw new IdentificationError('aiInvalid');
        const image = sharp(bytes, { limitInputPixels: 1024 * 1024, animated: false });
        const metadata = await image.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || !metadata.width || !metadata.height || metadata.width > 1024 || metadata.height > 1024 || (metadata.pages ?? 1) > 1)
            throw new IdentificationError('aiInvalid');
        const normalized = await image.rotate().jpeg({ quality: 80 }).toBuffer();
        if (normalized.length > 512 * 1024)
            throw new IdentificationError('aiInvalid');
        if (signal.aborted)
            throw new IdentificationError('aiCancelled');
        const suggestion = suggestionSchema.parse(await provider.identify({ images: [normalized], locale, signal: signal }));
        if (signal.aborted)
            throw new IdentificationError('aiCancelled');
        return { suggestion, provenance: { provider: 'ollama', model: provider.model, generatedAt: new Date().toISOString(), basedOn: 'image_only' } };
    });
}
