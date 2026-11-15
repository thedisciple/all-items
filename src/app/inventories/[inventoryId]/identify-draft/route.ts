import { z } from 'zod';
import { assertMutationOrigin, accessFailure } from '@/auth/http';
import { requestUser } from '@/auth/request';
import { resolveInventory } from '@/items/inventories';
import { aiConfiguration } from '@/ai/config';
import { OllamaProvider } from '@/ai/ollama';
import { identifyDraft } from '@/ai/draft-image';
import { IdentificationError } from '@/ai/contracts';
export const runtime = 'nodejs';
export async function POST(request: Request, { params }: {
    params: Promise<{
        inventoryId: string;
    }>;
}) {
    const deadline = AbortSignal.timeout(95000);
    try {
        assertMutationOrigin(request);
        const user = await requestUser(), context = await resolveInventory((await params).inventoryId), config = aiConfiguration();
        if (!config)
            throw new IdentificationError();
        const requestId = z.uuid().parse(request.headers.get('x-all-items-ai-request')), locale = z.enum(['ru', 'en', 'uk', 'sr-Latn', 'zh-Hans']).parse(request.headers.get('x-all-items-locale'));
        const signal = AbortSignal.any([request.signal, deadline]);
        const result = await identifyDraft(context, user.id, request, new OllamaProvider(config.model), locale, signal);
        return Response.json({ ...result, requestId }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch (error) {
        return accessFailure(error) ?? Response.json({ error: deadline.aborted ? 'aiTimeout' : error instanceof IdentificationError ? error.key : 'aiInvalid' }, { status: error instanceof IdentificationError && error.key === 'aiBusy' ? 429 : 400, headers: { 'Cache-Control': 'private, no-store' } });
    }
}
