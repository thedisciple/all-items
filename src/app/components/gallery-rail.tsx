"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { DragDropProvider, useDragDropManager } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Accessibility, AutoScroller, Feedback, Cursor, PreventSelection, KeyboardSensor, PointerActivationConstraints, PointerSensor, type Draggable, type DragStartEvent, type DragOverEvent, type DragEndEvent } from "@dnd-kit/dom";
import { Star } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export type RailPhoto = { id: string; primary: boolean; preview: ReactNode };
type Props = { photos: RailPhoto[]; selectedId?: string; disabled?: boolean; onSelect: (id: string) => void; onPrimary: (id: string) => void; restoreFocusId?: string; onReorder: (ids: string[], sourceId?: string) => void; onDraggingChange?: (value: boolean) => void };

function CancelOnBlur() {
  const manager = useDragDropManager();
  useEffect(() => {
    const cancel = () => { if (manager && !manager.dragOperation.status.idle) manager.actions.stop({ canceled: true }); };
    window.addEventListener("blur", cancel);
    const visibility = () => { if (document.hidden) cancel(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", visibility); };
  }, [manager]);
  return null;
}

function Thumbnail({ photo, index, selected, disabled, sorting, instructions, suppressClick, reduced, onSelect, onPrimary }: { photo: RailPhoto; index: number; selected: boolean; disabled: boolean; sorting: boolean; instructions: string; suppressClick: React.RefObject<boolean>; reduced: boolean; onSelect: Props["onSelect"]; onPrimary: Props["onPrimary"] }) {
  const { t } = useI18n();
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({ id: photo.id, index, disabled, transition: reduced ? null : {duration:120} });
  return <div ref={ref} className="gallery-thumb-wrap" data-photo-id={photo.id} data-dragging={isDragging} data-insertion={isDropTarget}>
    <button ref={handleRef} type="button" className="gallery-thumbnail" disabled={disabled} aria-describedby={instructions} aria-current={selected?"true":undefined} aria-roledescription={t("galleryReorderPhoto")} aria-label={`${t("galleryPhoto",{number:index+1})}${photo.primary ? ` — ${t("galleryPrimary")}` : ""}`} onClick={event=>{ if(suppressClick.current){event.preventDefault();return;}onSelect(photo.id); }}>{photo.preview}</button>
    <button type="button" className="gallery-primary-button icon-button" disabled={disabled||sorting} aria-pressed={photo.primary} title={t(photo.primary?"galleryPrimary":"galleryMakePrimary")} aria-label={`${t(photo.primary?"galleryPrimary":"galleryMakePrimary")} — ${t("galleryPhoto",{number:index+1})}`} onClick={()=>onPrimary(photo.id)}><Star size={18} fill={photo.primary?"currentColor":"none"} aria-hidden="true"/></button>
  </div>;
}

export default function GalleryRail({photos,selectedId,disabled=false,onSelect,onPrimary,onReorder,onDraggingChange,restoreFocusId}:Props){
  const { t }=useI18n();
  const id=useId();
  const rail=useRef<HTMLDivElement>(null);
  const suppressClick=useRef(false);
  const resetTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [reduced,setReduced]=useState(false);
  const [sorting,setSorting]=useState(false);
  useEffect(()=>{const query=matchMedia("(prefers-reduced-motion: reduce)");const change=()=>setReduced(query.matches);change();query.addEventListener("change",change);return()=>query.removeEventListener("change",change);},[]);
  useEffect(()=>()=>{if(resetTimer.current)clearTimeout(resetTimer.current);},[]);
  useEffect(()=>{const selected=[...rail.current?.querySelectorAll<HTMLElement>("[data-photo-id]")??[]].find(node=>node.dataset.photoId===selectedId);selected?.scrollIntoView({block:"nearest",inline:"nearest",behavior:reduced?"instant":"smooth"});},[selectedId,reduced]);
  useEffect(()=>{if(!restoreFocusId||disabled)return;[...rail.current?.querySelectorAll<HTMLElement>("[data-photo-id]")??[]].find(node=>node.dataset.photoId===restoreFocusId)?.querySelector<HTMLButtonElement>(".gallery-thumbnail")?.focus();},[restoreFocusId,disabled]);
  const sensors=useMemo(()=>[PointerSensor.configure({activationConstraints:event=>[new PointerActivationConstraints.Delay({value:event.pointerType==="touch"?350:200,tolerance:6})]}),KeyboardSensor.configure({offset:96,keyboardCodes:{start:["Space","Enter"],end:["Space","Enter"],cancel:["Escape","Tab"],left:["ArrowLeft"],right:["ArrowRight"],up:["ArrowUp"],down:["ArrowDown"]}})],[]);
  const position=(source:Draggable|null)=>isSortable(source)?source.index+1:1;
  const plugins=useMemo(()=>[Cursor,PreventSelection,AutoScroller.configure({threshold:{x:.18,y:0}}),Feedback.configure({dropAnimation:reduced?null:{duration:120},keyboardTransition:reduced?null:{duration:100}}),Accessibility.configure({screenReaderInstructions:{draggable:t("galleryDragInstructions")},announcements:{dragstart:({operation}:DragStartEvent)=>t("galleryDragStarted",{number:position(operation.source)}),dragover:({operation}:DragOverEvent)=>t("galleryDragPosition",{number:position(operation.source),total:photos.length}),dragend:(event:DragEndEvent)=>event.canceled?t("galleryDragCancelled"):t("galleryDragPlaced",{number:position(event.operation.source)})}})],[t,reduced,photos.length]);
  return <div className="gallery-rail-region" data-sorting={sorting}>
    <p id={id} className="visually-hidden">{t("galleryDragInstructions")}</p>
    <DragDropProvider sensors={sensors} plugins={plugins}
      onDragStart={()=>{setSorting(true);suppressClick.current=true;onDraggingChange?.(true);}}
      onDragEnd={event=>{setSorting(false);onDraggingChange?.(false);if(resetTimer.current)clearTimeout(resetTimer.current);resetTimer.current=setTimeout(()=>{suppressClick.current=false;},300);const source=event.operation.source;if(event.canceled||!isSortable(source)||source.index===source.initialIndex)return;const ids=photos.map(photo=>photo.id);const [moved]=ids.splice(source.initialIndex,1);ids.splice(source.index,0,moved!);onReorder(ids,String(source.id));}}>
      <CancelOnBlur/>
      <div ref={rail} className="gallery-strip" role="group" aria-label={t("gallery")}>
        {photos.map((photo,index)=><Thumbnail key={photo.id} photo={photo} index={index} selected={photo.id===selectedId} disabled={disabled} sorting={sorting} instructions={id} suppressClick={suppressClick} reduced={reduced} onSelect={onSelect} onPrimary={onPrimary}/>)}
      </div>
    </DragDropProvider>
  </div>;
}
