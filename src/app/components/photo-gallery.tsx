"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemPhotoDTO } from "@/media/service";
import { NEW_ITEM_PHOTO_LIMIT } from "@/media/limits";
import { deleteGalleryPhoto, galleryPhotoAction, type ActionFeedback } from "@/app/actions";
import { useInventory } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";
import { PrivateImage } from "./private-image";
import { PhotoReplacement } from "./photo-replacement";
import { DestructiveConfirmation } from "./destructive-confirmation";
import { useExitEditor } from "./item-exit";

const GalleryRail=dynamic(()=>import("./gallery-rail"),{ssr:false});
export function PhotoGallery({ itemId, itemName, photos }: { itemId: string; itemName: string; photos: ItemPhotoDTO[] }) {
  const { t } = useI18n();
  const { base, inventory } = useInventory();
  const router = useRouter();
  const [ordered,setOrdered]=useState(photos);
  const [selectedId, setSelectedId] = useState<string | null>(()=>photos.find(photo=>photo.isPrimary)?.id??null);
  const [selectedPosition, setSelectedPosition] = useState(0);
  const selected=ordered.find(photo=>photo.id===selectedId)??ordered[Math.min(selectedPosition,ordered.length-1)]??ordered[0];
  const index=ordered.findIndex(photo=>photo.id===selected?.id);
  const [pending, startTransition] = useTransition();
  const busy=useRef(false);
  const [railEpoch,setRailEpoch]=useState(0);
  const [restoreFocusId,setRestoreFocusId]=useState<string|undefined>(undefined);
  const movedId=useRef<string|undefined>(undefined);
  const [dragging,setDragging]=useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  useExitEditor(editing||adding,pending||dragging);
  useEffect(()=>{if(!dragging&&!pending)setOrdered(photos);},[photos,dragging,pending]);
  useEffect(()=>{if(selectedId&&ordered.some(photo=>photo.id===selectedId))setSelectedPosition(index);},[ordered,selectedId,index]);
  const [feedback, setFeedback] = useState<ActionFeedback>({ status: "idle", message: "" });
  const [photoSaved, setPhotoSaved] = useState(false);
  const priorPhotos = useRef(new Set(photos.map(photo => photo.id)));
  useEffect(() => {
    const ids=new Set(photos.map(photo=>photo.id));
    if(photos.some(photo=>!priorPhotos.current.has(photo.id)))setPhotoSaved(true);
    else if([...priorPhotos.current].some(id=>!ids.has(id)))setPhotoSaved(false);
    priorPhotos.current=ids;
  },[photos]);
  const changeEditing=useCallback((value:boolean)=>{setEditing(value);if(value)setPhotoSaved(false);},[]);
  const changeAdding=useCallback((value:boolean)=>{setAdding(value);if(value)setPhotoSaved(false);},[]);
  const locked=pending||editing||adding||dragging;
  function select(position:number){const photo=ordered[position];if(photo&&!locked){setSelectedId(photo.id);setSelectedPosition(position);}}
  function mutate(operation:"primary"|"reorder",mediaId?:string,order?:string[]){
    if(busy.current||pending||editing||adding)return;
    if(operation==="primary"&&dragging)return;
    if(operation==="primary"&&ordered.find(photo=>photo.id===mediaId)?.isPrimary)return;
    busy.current=true;setFeedback({status:"idle",message:""});
    const data=new FormData();data.set("inventoryId",inventory.workspaceId);data.set("id",itemId);data.set("operation",operation);
    if(mediaId)data.set("mediaId",mediaId);
    if(order){data.set("order",JSON.stringify(order));setOrdered(order.map(id=>ordered.find(photo=>photo.id===id)!));}
    function rollback(){setOrdered(photos);setRestoreFocusId(movedId.current??mediaId??selected?.id);setRailEpoch(value=>value+1);}
    startTransition(async()=>{
      try{const result=await galleryPhotoAction({status:"idle",message:""},data);setFeedback(result);if(result.status!=="success")rollback();router.refresh();}
      catch{rollback();setFeedback({status:"error",message:"operationFailed"});}
      finally{busy.current=false;}
    });
  }
  return <div className="photo-gallery" aria-label={t("gallery")} aria-busy={pending}>
    <div inert={pending||dragging||adding}><PhotoReplacement itemId={itemId} mediaId={selected?.id} crop={selected?.crop} photoUrl={selected?`${base}/media/${itemId}/${selected.id}?v=${selected.id}`:null} itemName={itemName} announceSuccess={false} onDirtyChange={changeEditing} navigation={{index,total:ordered.length,disabled:locked,select}}/></div>
    {ordered.length>0?<>
      <GalleryRail key={railEpoch} restoreFocusId={restoreFocusId} photos={ordered.map(photo=>({id:photo.id,primary:photo.isPrimary,preview:<PrivateImage variant="thumbnail" src={`${base}/media/${itemId}/${photo.id}?variant=thumbnail`} alt="" width={64} height={64}/>}))} selectedId={selected?.id} disabled={pending||editing||adding} onSelect={id=>select(ordered.findIndex(photo=>photo.id===id))} onPrimary={id=>mutate("primary",id)} onReorder={(ids,sourceId)=>{movedId.current=sourceId;mutate("reorder",undefined,ids);}} onDraggingChange={setDragging}/>
      <div className="gallery-actions">{!locked&&selected?<DestructiveConfirmation iconOnly key={selected.id} action={deleteGalleryPhoto} label={t("photoDelete")} description={t("galleryDeleteWarning")} fields={{id:itemId,mediaId:selected.id}}/>:null}</div>
      <div className="gallery-add" inert={pending||dragging||editing}>
        <p className="photo-slots">{t("gallerySlots",{count:Math.max(0,NEW_ITEM_PHOTO_LIMIT-ordered.length)})}</p>
        {ordered.length<NEW_ITEM_PHOTO_LIMIT||adding?<PhotoReplacement itemId={itemId} photoUrl={null} itemName={itemName} hideEmptyViewer announceSuccess={false} onDirtyChange={changeAdding}/>:<p>{t("galleryLimit",{count:NEW_ITEM_PHOTO_LIMIT})}</p>}
      </div>
    </>:null}
    {photoSaved?<p className="visually-hidden" role="status">{t("photoSaved")}</p>:null}
    {pending?<p role="status">{t("savingChanges")}</p>:null}
    {feedback.message?<p className={feedback.status==="error"?"form-error":"visually-hidden"} role={feedback.status==="error"?"alert":"status"}>{t(feedback.message,feedback.values)}</p>:null}
  </div>;
}
