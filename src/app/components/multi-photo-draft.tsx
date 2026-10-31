"use client";

import dynamic from "next/dynamic";
import {useEffect,useMemo,useRef,useState} from "react";
import {NEW_ITEM_PHOTO_LIMIT,MAX_CREATION_PHOTO_BYTES} from "@/media/limits";
import {draftThumbnail,PhotoInputError,preflightPhoto} from "@/media/browser-photo";
import {useI18n} from "@/i18n/provider";
import type {MessageKey} from "@/i18n/messages";
import {PhotoAcquisition,type PhotoDraft} from "./photo-acquisition";
import {PhotoViewer} from "./photo-viewer";
import {PrivateImage} from "./private-image";
import {DestructiveConfirmation} from "./destructive-confirmation";

const GalleryRail=dynamic(()=>import("./gallery-rail"),{ssr:false});
export type DraftGalleryPhoto=PhotoDraft&{id:string};
export type DraftGallery={photos:DraftGalleryPhoto[];primaryId:string|null;selectedId:string|null};
export const emptyDraftGallery=():DraftGallery=>({photos:[],primaryId:null,selectedId:null});

function Thumbnail({file}:{file:File|null}){
  const [url,setUrl]=useState<string|null>(null);
  useEffect(()=>{
    let active=true,created:string|null=null;setUrl(null);
    if(file)void draftThumbnail(file).then(blob=>{if(active){created=URL.createObjectURL(blob);setUrl(created);}}).catch(()=>{});
    return()=>{active=false;if(created)URL.revokeObjectURL(created);};
  },[file]);
  return url?<PrivateImage variant="thumbnail" src={url} alt="" width={64} height={64}/>:<span className="draft-thumbnail-placeholder" aria-hidden="true"/>;
}

export function MultiPhotoDraft({value,onChange,disabled,active,restoreToken,onBusyChange,itemName}:{
  value:DraftGallery;onChange:(value:DraftGallery)=>void;disabled:boolean;active:boolean;restoreToken:number;onBusyChange:(busy:boolean)=>void;itemName:string;
}){
  const {t}=useI18n();
  const root=useRef<HTMLDivElement>(null),busy=useRef(false);
  const [reading,setReading]=useState(false),[dragging,setDragging]=useState(false);
  const [error,setError]=useState<{key:MessageKey;values?:Record<string,number>}|null>(null);
  const [focusId,setFocusId]=useState<string|undefined>(undefined);
  const selected=value.photos.find(photo=>photo.id===value.selectedId)??value.photos[0];
  const index=value.photos.findIndex(photo=>photo.id===selected?.id);
  const file=selected?.selected??selected?.pending??selected?.source??null;
  const [preview,setPreview]=useState<string|null>(null);
  useEffect(()=>{if(!file){setPreview(null);return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  const recoveryToken=useMemo(()=>Date.now(),[selected?.id,restoreToken]);
  const locked=!active||disabled||reading||dragging||value.photos.some(photo=>Boolean(photo.pending));
  useEffect(()=>{onBusyChange(reading||dragging);},[reading,dragging,onBusyChange]);
  useEffect(()=>()=>onBusyChange(false),[onBusyChange]);
  const previousCount=useRef(value.photos.length);
  useEffect(()=>{if(previousCount.current&&!value.photos.length)root.current?.querySelector<HTMLButtonElement>(".draft-photo-intake button")?.focus();previousCount.current=value.photos.length;},[value.photos.length]);

  async function acquire(files:File[]){
    if(disabled||busy.current||!files.length)return;
    const slots=NEW_ITEM_PHOTO_LIMIT-value.photos.length;
    if(files.length>slots){setError({key:"creationSlotsExceeded",values:{count:slots}});return;}
    busy.current=true;setReading(true);setError(null);
    try{
      const checked:File[]=[];for(const file of files)checked.push(await preflightPhoto(file));
      const blobs=new Set<File>();for(const photo of value.photos)for(const input of [photo.selected,photo.source,photo.pending])if(input)blobs.add(input);for(const input of checked)blobs.add(input);
      if([...blobs].reduce((total,file)=>total+file.size,0)>MAX_CREATION_PHOTO_BYTES){setError({key:"creationByteLimit",values:{size:MAX_CREATION_PHOTO_BYTES/1024/1024}});return;}
      const additions:DraftGalleryPhoto[]=checked.map(file=>({id:crypto.randomUUID(),selected:checked.length===1?null:file,source:checked.length===1?null:file,pending:checked.length===1?file:null,crop:null,pendingCrop:null}));
      onChange({photos:[...value.photos,...additions],primaryId:value.primaryId??additions[0]!.id,selectedId:additions[0]!.id});
    }catch(error){setError({key:error instanceof PhotoInputError?error.code:"photoSelectionFailed"});}
    finally{busy.current=false;setReading(false);}
  }
  function updatePhoto(photo:PhotoDraft|null){
    if(!selected)return false;
    if(!photo){remove(selected.id);return true;}
    const candidate={...photo,id:selected.id};
    const photos=value.photos.map(entry=>entry.id===selected.id?candidate:entry);
    const inputs=new Set<File>();for(const entry of photos)for(const file of [entry.selected,entry.source,entry.pending])if(file)inputs.add(file);
    if([...inputs].reduce((sum,file)=>sum+file.size,0)>MAX_CREATION_PHOTO_BYTES){setError({key:"creationByteLimit",values:{size:MAX_CREATION_PHOTO_BYTES/1024/1024}});return false;}
    setError(null);onChange({...value,photos});return true;
  }
  function remove(id:string){
    const photos=value.photos.filter(photo=>photo.id!==id),next=photos[Math.min(Math.max(0,index),photos.length-1)]??photos[0];
    setFocusId(next?.id);setError(null);
    onChange({photos,primaryId:value.primaryId===id?photos[0]?.id??null:value.primaryId,selectedId:value.selectedId===id?next?.id??null:value.selectedId});
  }
  function select(position:number){const next=value.photos[position];if(next&&!locked)onChange({...value,selectedId:next.id});}

  return <div ref={root} className="draft-photo-gallery" aria-label={t("gallery")} aria-busy={disabled||reading}>
    {preview&&selected?<>
      <div className="photo-preview-frame draft-main-preview"><PhotoViewer src={preview} alt={`${t("photo")}: ${itemName}`} navigation={{index,total:value.photos.length,disabled:locked,select}}/></div>
      <GalleryRail photos={value.photos.map(photo=>({id:photo.id,primary:value.primaryId===photo.id,preview:<Thumbnail file={photo.selected??photo.pending??photo.source}/>}))} selectedId={selected.id} restoreFocusId={focusId} disabled={!active||disabled||reading||value.photos.some(photo=>Boolean(photo.pending))} onSelect={id=>select(value.photos.findIndex(photo=>photo.id===id))} onPrimary={id=>{if(!locked)onChange({...value,primaryId:id});}} onReorder={ids=>onChange({...value,photos:ids.map(id=>value.photos.find(photo=>photo.id===id)!)})} onDraggingChange={setDragging}/>
      <PhotoAcquisition key={selected.id} name="selectedPhoto" disabled={!active||disabled||reading||dragging} active={active} recovery={{token:recoveryToken,photo:selected}} onRecoveryChange={updatePhoto} externalPreview hideAcquire hideRemove/>
      {!locked?<div className="gallery-actions"><DestructiveConfirmation key={selected.id} iconOnly refreshOnSuccess={false} label={t("photoDelete")} description={t("creationPhotoDeleteWarning")} fields={{}} action={()=>{remove(selected.id);return{status:"success",message:""};}}/></div>:null}
    </>:null}
    <div className="draft-photo-intake" inert={disabled||reading||dragging||value.photos.some(photo=>Boolean(photo.pending))}>
      <p className="photo-slots">{t("gallerySlots",{count:Math.max(0,NEW_ITEM_PHOTO_LIMIT-value.photos.length)})}</p>
      {value.photos.length<NEW_ITEM_PHOTO_LIMIT?<PhotoAcquisition name="photo" multiple active={active} disabled={disabled||reading||dragging||value.photos.some(photo=>Boolean(photo.pending))} onAcquireFiles={acquire}/>:<p>{t("galleryLimit",{count:NEW_ITEM_PHOTO_LIMIT})}</p>}
    </div>
    {reading?<p role="status">{t("creationReadingPhotos")}</p>:null}
    {error?<p className="form-error" role="alert">{t(error.key,error.values)}</p>:null}
  </div>;
}
