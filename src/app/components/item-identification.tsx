"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useRouter} from 'next/navigation';
import {useI18n} from '@/i18n/provider';
import {useInventory} from './inventory-provider';
import {PrivateImage} from './private-image';
import {categories,categoryMessageKey} from '@/items/categories';
import type {ItemPhotoDTO} from '@/media/service';
import type {Proposal} from '@/ai/contracts';
import type {ReviewedPatch} from '@/items/review';
import type {MessageKey} from '@/i18n/messages';

type Values={name:string;brand:string;model:string;description:string;categories:string[]};
const fields={name:'itemName',brand:'itemBrand',model:'itemModel',description:'itemDescription',categories:'category'} as const;
const errorKeys=['aiUnavailable','aiIncompatible','aiBusy','aiTimeout','aiInvalid','aiCancelled','aiStale'] as const;
export function ItemIdentification({itemId,photos,current,revision,dirty,onBusy,onApplied}:{itemId:string;photos:ItemPhotoDTO[];current:Values;revision:string;dirty:boolean;onBusy:(busy:boolean)=>void;onApplied:(values:Values)=>void}){
  const {t,locale}=useI18n(),{base}=useInventory(),router=useRouter();
  const [open,setOpen]=useState(false),[pending,setPending]=useState(false),[applying,setApplying]=useState(false),[error,setError]=useState<MessageKey|null>(null);
  const [ids,setIds]=useState<string[]>([photos.find(photo=>photo.isPrimary)?.id??photos[0]!.id]),[context,setContext]=useState(false);
  const [proposal,setProposal]=useState<Proposal|null>(null),[values,setValues]=useState<Values>({name:'',brand:'',model:'',description:'',categories:[]}),[selected,setSelected]=useState<string[]>([]);
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),controller=useRef<AbortController|null>(null),selection=useRef('');
  useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function call(method:string,value:unknown,signal?:AbortSignal){const response=await fetch(`${base}/items/${itemId}/identify`,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal});const body=await response.json();if(!response.ok)throw new Error(errorKeys.includes(body.error)?body.error:'aiUnavailable');return body;}
  function close(){if(applying)return;controller.current?.abort();setPending(false);dialog.current?.close();setOpen(false);trigger.current?.focus();}
  async function identify(){
    controller.current?.abort();const abort=new AbortController();controller.current=abort;setPending(true);setError(null);
    try{const result:Proposal=await call('POST',{revision,photoIds:ids,includeContext:context,locale},abort.signal);if(abort.signal.aborted)return;setProposal(result);setValues(result.suggestion);selection.current=JSON.stringify([ids,context]);setSelected(Object.keys(fields).filter(key=>{const value=result.suggestion[key as keyof Values],old=current[key as keyof Values];return (Array.isArray(old)?old.length===0:!old)&&(Array.isArray(value)?value.length>0:Boolean(value));}));}
    catch(error){if(!abort.signal.aborted)setError(error instanceof Error&&errorKeys.includes(error.message as typeof errorKeys[number])?error.message as MessageKey:'aiUnavailable');}
    finally{if(!abort.signal.aborted)setPending(false);}
  }
  async function apply(){
    if(!proposal||dirty||!selected.length)return;const patch:ReviewedPatch={};for(const key of selected){if(key==='categories')patch.categories=values.categories as ReviewedPatch['categories'];else Object.assign(patch,{[key]:values[key as keyof Values]});}
    setApplying(true);onBusy(true);setError(null);
    try{const result=await call('PATCH',{revision:proposal.revision,patch});onApplied(result.values);dialog.current?.close();setOpen(false);router.refresh();trigger.current?.focus();}
    catch(error){setError(error instanceof Error&&errorKeys.includes(error.message as typeof errorKeys[number])?error.message as MessageKey:'aiUnavailable');}
    finally{setApplying(false);onBusy(false);}
  }
  const categoryLabel=(key:string)=>{const message=categoryMessageKey(key);return message?t(message):key;};
  const changed=selection.current!==JSON.stringify([ids,context]);
  return <div className="ai-identification">
    <button ref={trigger} type="button" className="quiet-button" onClick={()=>setOpen(true)}>{t('aiIdentify')}</button>
    {open?createPortal(<dialog ref={dialog} className="ai-review-dialog" aria-labelledby="ai-review-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
      <div className="dialog-heading"><h2 id="ai-review-title">{t('aiReview')}</h2><button type="button" className="quiet-button" disabled={applying} onClick={close}>{t('cancel')}</button></div>
      <p className="muted">{t('aiLocal')} · {t('aiNotVerified')}</p>
      <details open={!proposal}><summary>{t('aiSelectPhotos')} ({ids.length}/3)</summary><div className="ai-photo-choices">
        {photos.map((photo,index)=><label key={photo.id}><input type="checkbox" checked={ids.includes(photo.id)} disabled={pending||applying||(!ids.includes(photo.id)&&ids.length>=3)} onChange={event=>setIds(value=>event.target.checked?[...value,photo.id]:value.filter(id=>id!==photo.id))}/><PrivateImage variant="thumbnail" src={`${base}/media/${itemId}/${photo.id}?variant=thumbnail`} alt={`${t('photo')} ${index+1}`} width={64} height={64}/></label>)}
      </div><label><input type="checkbox" checked={context} disabled={pending||applying} onChange={event=>setContext(event.target.checked)}/>{t('aiContext')}</label></details>
      {pending?<p role="status">{t('aiProcessing')}</p>:null}
      {proposal?<section aria-label={t('aiSuggestions')} className="ai-suggestions">
        <p>{t(proposal.suggestion.uncertainty==='likely'?'aiLikely':proposal.suggestion.uncertainty==='uncertain'?'aiUncertain':'aiUnknown')}</p>
        {proposal.suggestion.uncertainties.length?<ul>{proposal.suggestion.uncertainties.map((text,index)=><li key={index}>{text}</li>)}</ul>:null}
        {proposal.suggestion.visibleMarking?<p>{t('aiVisibleMarking')}: {proposal.suggestion.visibleMarking}</p>:null}
        {Object.entries(fields).map(([key,label])=><div className="ai-field" key={key}>
          <label className="ai-use"><input type="checkbox" checked={selected.includes(key)} disabled={pending||applying} onChange={event=>setSelected(old=>event.target.checked?[...old,key]:old.filter(value=>value!==key))}/>{t('aiUse')} {t(label)}</label>
          <small>{t('aiCurrent')}: {key==='categories'?current.categories.map(categoryLabel).join(', ')||'—':current[key as keyof Omit<Values,'categories'>]||'—'}</small>
          {key==='categories'?<div className="ai-categories">{categories.map(category=><label key={category}><input type="checkbox" checked={values.categories.includes(category)} disabled={pending||applying} onChange={event=>setValues(old=>({...old,categories:event.target.checked?[...old.categories,category]:old.categories.filter(value=>value!==category)}))}/>{categoryLabel(category)}</label>)}</div>:
          <label className="field"><span className="visually-hidden">{t(label)}</span>{key==='description'?<textarea value={values.description} maxLength={1000} disabled={pending||applying} onChange={event=>setValues(old=>({...old,description:event.target.value}))}/>:<input value={values[key as keyof Omit<Values,'categories'>]} maxLength={key==='brand'?120:160} disabled={pending||applying} onChange={event=>setValues(old=>({...old,[key]:event.target.value}))}/>}</label>}
        </div>)}
        <small className="muted">Ollama · {proposal.provenance.model} · {new Date(proposal.provenance.generatedAt).toLocaleString(locale)}</small>
      </section>:null}
      {error?<p role="alert" className="error-status">{t(error)}</p>:null}
      {dirty?<p role="status">{t('aiSaveFirst')}</p>:null}
      <div className="dialog-actions"><button type="button" className="quiet-button" disabled={pending||applying||ids.length===0} onClick={()=>void identify()}>{t('aiIdentify')}</button>{proposal?<button type="button" className="primary-button" disabled={pending||applying||dirty||changed||!selected.length||(selected.includes('name')&&!values.name.trim())} onClick={()=>void apply()}>{t('aiApply')}</button>:null}</div>
    </dialog>,document.body):null}
  </div>;
}
