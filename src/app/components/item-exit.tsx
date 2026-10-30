"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/provider";

type Editor = { dirty: boolean; pending: boolean; save?: () => boolean };
type HistoryNavigationEvent = Event & { navigationType: string; destination: { url: string } };
type ExitContext = { update: (id: string, value: Editor | null) => void; request: (destination: string) => void; saved: (fallback: string) => void; failed: () => void };
const Context = createContext<ExitContext | null>(null);

export function useItemExit() { return useContext(Context); }
export function useExitEditor(dirty: boolean, pending: boolean, save?: () => boolean) {
  const context = useContext(Context);
  const id = useId();
  useLayoutEffect(() => { context?.update(id, { dirty, pending, save }); }, [context,id,dirty,pending,save]);
  useEffect(() => () => context?.update(id,null), [context,id]);
}

export function ItemExitProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  const [editors,setEditors] = useState<Record<string,Editor>>({});
  const editorsRef = useRef(editors);

  const [destination,setDestination] = useState<string|null>(null);
  const saveDestination = useRef<string|null>(null);
  const allowed = useRef(false);
  const [invalid,setInvalid] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const priorFocus = useRef<HTMLElement|null>(null);
  const entryUrl = useRef("");
  const entryState = useRef<unknown>(null);
  const update = useCallback((id:string,value:Editor|null)=>{
    const current=editorsRef.current;
    if(!value){if(!(id in current))return;const next={...current};delete next[id];editorsRef.current=next;setEditors(next);return;}
    const prior=current[id];if(prior?.dirty===value.dirty&&prior.pending===value.pending&&prior.save===value.save)return;
    if(value.dirty||value.pending){entryUrl.current=location.pathname+location.search;entryState.current=history.state;}
    allowed.current=false;
    const next={...current,[id]:value};editorsRef.current=next;setEditors(next);
  },[]);
  const navigate = useCallback((target:string)=>{allowed.current=true;setDestination(null);router.push(target);},[router]);
  const request = useCallback((target:string)=>{
    if(allowed.current||!Object.values(editorsRef.current).some(editor=>editor.dirty||editor.pending)){navigate(target);return;}
    priorFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setInvalid(false);setDestination(target);
  },[navigate]);
  const saved=useCallback((fallback:string)=>{const target=saveDestination.current??fallback;saveDestination.current=null;navigate(target);},[navigate]);
  const failed=useCallback(()=>{saveDestination.current=null;allowed.current=false;},[]);
  const context=useMemo(()=>({update,request,saved,failed}),[update,request,saved,failed]);
  useLayoutEffect(()=>{
    entryUrl.current=location.pathname+location.search;entryState.current=history.state;
    const click=(event:MouseEvent)=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||allowed.current)return;
      const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>("a[href]"):null;
      if(!anchor||anchor.target==="_blank"||anchor.hasAttribute("download"))return;
      const url=new URL(anchor.href);if(url.origin!==location.origin)return;
      const target=url.pathname+url.search;
      if(target===location.pathname+location.search||!Object.values(editorsRef.current).some(editor=>editor.dirty||editor.pending))return;
      event.preventDefault();event.stopPropagation();request(target);
    };
    const unload=(event:BeforeUnloadEvent)=>{if(!allowed.current&&Object.values(editorsRef.current).some(editor=>editor.dirty||editor.pending)){event.preventDefault();event.returnValue="";}};
    const back=(event:PopStateEvent)=>{
      if(allowed.current||!Object.values(editorsRef.current).some(editor=>editor.dirty||editor.pending))return;
      const target=location.pathname+location.search;
      event.stopImmediatePropagation();history.pushState(entryState.current,"",entryUrl.current);request(target);
    };
    // Modern Edge exposes cancellation before a history traversal changes the route.
    const navigation=(window as Window & {navigation?:EventTarget}).navigation;
    const beforeNavigate=(event:Event)=>{
      const change=event as HistoryNavigationEvent;
      if(change.navigationType!=="traverse"||!event.cancelable||allowed.current||!Object.values(editorsRef.current).some(editor=>editor.dirty||editor.pending))return;
      const url=new URL(change.destination.url);
      if(url.origin!==location.origin)return;
      event.preventDefault();request(url.pathname+url.search);
    };
    navigation?.addEventListener("navigate",beforeNavigate);
    document.addEventListener("click",click,true);window.addEventListener("beforeunload",unload);window.addEventListener("popstate",back,true);
    return()=>{navigation?.removeEventListener("navigate",beforeNavigate);document.removeEventListener("click",click,true);window.removeEventListener("beforeunload",unload);window.removeEventListener("popstate",back,true);};
  },[request]);
  useEffect(()=>{if(destination)dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();},[destination]);
  const states=Object.values(editors);
  const pending=states.some(editor=>editor.pending);
  const dirty=states.filter(editor=>editor.dirty);
  const save=dirty.length===1?dirty[0]?.save:undefined;
  useEffect(()=>{if(destination&&!pending&&!dirty.length){setDestination(null);navigate(destination);}},[destination,pending,dirty.length,navigate]);
  const stay=()=>{setDestination(null);priorFocus.current?.focus();};
  return <Context.Provider value={context}>{children}{destination?<div className="photo-source-overlay destructive-overlay">
    <section ref={dialog} className="photo-source-dialog item-exit-dialog" role="alertdialog" aria-modal="true" aria-labelledby="item-exit-title" onKeyDown={event=>{
      if(event.key==="Escape"){event.preventDefault();stay();}
      if(event.key!=="Tab")return;const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }}>
      <div className="dialog-heading"><h2 id="item-exit-title">{t("itemLeaveTitle")}</h2></div>
      <p role={pending?"status":undefined}>{t(pending?"itemLeavePending":"itemLeavePrompt")}</p>
      {invalid?<p role="alert" className="form-error">{t("itemLeaveInvalid")}</p>:null}
      <div className="dialog-actions"><button type="button" className="quiet-button" onClick={stay}>{t("itemLeaveStay")}</button>
        {!pending&&save?<button type="button" className="add-button" onClick={()=>{saveDestination.current=destination;if(save()){setDestination(null);}else{saveDestination.current=null;setInvalid(true);dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();}}}>{t("itemLeaveSave")}</button>:null}
        {!pending?<button type="button" className="text-button" onClick={()=>navigate(destination)}>{t("itemLeaveDiscard")}</button>:null}
      </div>
    </section>
  </div>:null}</Context.Provider>;
}

export function ItemDone({returnTo}:{returnTo:string}){
  const {t}=useI18n();
  return <Link className="quiet-button item-done" href={returnTo}>{t("itemDone")}</Link>;
}
