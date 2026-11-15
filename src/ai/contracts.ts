import {z} from 'zod';
import {categories} from '@/items/categories';

// All provider output is untrusted data; provenance is added by our server, never by a model.
export const suggestionSchema=z.object({version:z.literal(1),name:z.string().max(160),brand:z.string().max(120),model:z.string().max(160),categories:z.array(z.enum(categories)).max(3),description:z.string().max(1000),visibleMarking:z.string().max(160),uncertainty:z.enum(['likely','uncertain','unknown']),uncertainties:z.array(z.string().max(200)).max(5)}).strict();
export type Suggestion=z.infer<typeof suggestionSchema>;
export type Proposal={suggestion:Suggestion;revision:string;provenance:{provider:'ollama';model:string;photoIds:string[];generatedAt:string;basedOn:'image_only'|'image_and_context'}};
export const identifyInput=z.object({revision:z.string().regex(/^[a-f0-9]{64}$/).optional(),photoIds:z.array(z.uuid()).min(1).max(3).refine(ids=>new Set(ids).size===ids.length),includeContext:z.boolean().default(false),locale:z.enum(['ru','en','uk','sr-Latn','zh-Hans']).default('en')}).strict();
export class IdentificationError extends Error{constructor(public key:'aiUnavailable'|'aiIncompatible'|'aiBusy'|'aiTimeout'|'aiInvalid'|'aiCancelled'|'aiStale'='aiUnavailable'){super(key);}}
export type IdentificationInput={images:Buffer[];context?:{brand:string;model:string;marking:string};locale:string;signal:AbortSignal};
export interface IdentificationProvider{readonly model:string;identify(input:IdentificationInput):Promise<Suggestion>}
