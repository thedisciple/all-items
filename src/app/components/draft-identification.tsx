"use client";
import type { MessageKey } from '@/i18n/messages';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { analysisPhoto } from '@/media/browser-photo';
import { browserUUID } from '@/lib/browser-crypto';
import { categories, categoryMessageKey } from '@/items/categories';
import { suggestionSchema, type Suggestion } from '@/ai/contracts';
type Values = {
    name: string;
    brand: string;
    model: string;
    description: string;
    categories: string[];
};
const fields = { name: 'itemName', brand: 'itemBrand', model: 'itemModel', description: 'itemDescription', categories: 'category' } as const;
export function DraftIdentification({ file, photoId, active, endpoint, current, onApply }: {
    file: File;
    photoId: string;
    active: boolean;
    endpoint: string;
    current: Values;
    onApply: (patch: Partial<Values>) => void;
}) {
    const { t, locale } = useI18n(), [pending, setPending] = useState(false), [error, setError] = useState<MessageKey | null>(null), [proposal, setProposal] = useState<Suggestion | null>(null), [values, setValues] = useState<Values>({ name: '', brand: '', model: '', description: '', categories: [] }), [selected, setSelected] = useState<string[]>([]);
    const trigger = useRef<HTMLButtonElement>(null);
    const controller = useRef<AbortController | null>(null), generation = useRef(0), baseline = useRef<Values>(current), latest = useRef({ file, photoId, active, current });
    latest.current = { file, photoId, active, current };
    function cancel() { generation.current++; controller.current?.abort(); setPending(false); setProposal(null); setSelected([]); }
    useEffect(() => { cancel(); return () => { generation.current++; controller.current?.abort(); }; }, [file, photoId, active]);
    useEffect(() => { setSelected(old => old.filter(key => JSON.stringify(current[key as keyof Values]) === JSON.stringify(baseline.current[key as keyof Values]))); }, [current]);
    async function identify() {
        cancel();
        setError(null);
        const token = ++generation.current, abort = new AbortController(), requestId = browserUUID(), input = file;
        controller.current = abort;
        baseline.current = structuredClone(current);
        setPending(true);
        try {
            const image = await analysisPhoto(input);
            if (abort.signal.aborted)
                return;
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': image.type, 'x-all-items-ai-request': requestId, 'x-all-items-locale': locale }, body: image, signal: abort.signal });
            const result = await response.json();
            if (!response.ok || result.requestId !== requestId)
                throw new Error(result.error ?? "aiInvalid");
            const suggestion = suggestionSchema.parse(result.suggestion);
            if (token !== generation.current || !latest.current.active || latest.current.file !== input || latest.current.photoId !== photoId)
                return;
            setProposal(suggestion);
            setValues(suggestion);
            setSelected(Object.keys(fields).filter(key => { const value = latest.current.current[key as keyof Values]; return (Array.isArray(value) ? !value.length : !value) && JSON.stringify(value) === JSON.stringify(baseline.current[key as keyof Values]); }));
        }
        catch (error) {
            if (!abort.signal.aborted && token === generation.current)
                setError(error instanceof Error && ["aiBusy", "aiTimeout", "aiUnavailable", "aiInvalid", "aiIncompatible", "aiCancelled"].includes(error.message) ? error.message as MessageKey : "aiInvalid");
        }
        finally {
            if (token === generation.current)
                setPending(false);
        }
    }
    function apply() { if (!active || pending || !proposal)
        return; const patch: Partial<Values> = {}; for (const key of selected)
        if (JSON.stringify(current[key as keyof Values]) === JSON.stringify(baseline.current[key as keyof Values]))
            Object.assign(patch, { [key]: key === 'categories' ? [...new Set([...current.categories, ...values.categories])] : values[key as keyof Values] }); onApply(patch); cancel(); trigger.current?.focus(); }
    return <section className="draft-identification" aria-label={t('aiDraftIdentify')} onKeyDown={event=>{
        // Editing a proposal must not implicitly submit the surrounding item form.
        if(event.key==='Enter'&&event.target instanceof HTMLInputElement)event.preventDefault();
    }}><p>{t('aiLocal')} · Ollama</p><small>{t('aiDraftPrimary')}</small><div className="dialog-actions"><button ref={trigger} type="button" className="quiet-button" disabled={!active || pending} onClick={() => void identify()}>{t('aiDraftIdentify')}</button>{pending || proposal ? <button type="button" className="quiet-button" onClick={() => { cancel(); trigger.current?.focus(); }}>{t('cancel')}</button> : null}</div>{pending ? <p role="status">{t('aiProcessing')}</p> : null}{error ? <p role="alert">{t(error)}</p> : null}
 {proposal ? <div className="ai-suggestions"><p>{t('aiNotVerified')} · {t(proposal.uncertainty === 'likely' ? 'aiLikely' : proposal.uncertainty === 'unknown' ? 'aiUnknown' : 'aiUncertain')}</p>{proposal.uncertainties.map((text, i) => <p key={i}>{text}</p>)}{proposal.visibleMarking ? <p>{t('aiVisibleMarking')}: {proposal.visibleMarking}</p> : null}
 {Object.entries(fields).map(([key, label]) => <div className="ai-field" key={key}><label className="ai-use"><input type="checkbox" checked={selected.includes(key)} onChange={event => { if (event.target.checked) {
                baseline.current = { ...baseline.current, [key]: structuredClone(current[key as keyof Values]) };
                setSelected(old => [...old, key]);
            }
            else
                setSelected(old => old.filter(value => value !== key)); }}/>{t('aiUse')} {t(label)}</label><small>{t('aiCurrent')}: {key === 'categories' ? current.categories.map(category => { const label = categoryMessageKey(category); return label ? t(label) : category; }).join(', ') || '—' : current[key as keyof Omit<Values, 'categories'>] || '—'}</small>
 {key === 'categories' ? <div className="ai-categories">{categories.map(category => <label key={category}><input type="checkbox" checked={values.categories.includes(category)} onChange={event => setValues(old => ({ ...old, categories: event.target.checked ? [...old.categories, category] : old.categories.filter(value => value !== category) }))}/>{t(categoryMessageKey(category)!)}</label>)}</div> : <label className="field"><span>{t(label)}</span><input value={values[key as keyof Omit<Values, 'categories'>]} maxLength={key === 'description' ? 1000 : key === 'brand' ? 120 : 160} onChange={event => setValues(old => ({ ...old, [key]: event.target.value }))}/></label>}</div>)}<button type="button" className="quiet-button" disabled={!selected.length} onClick={apply}>{t('aiDraftUse')}</button></div> : null}</section>;
}
