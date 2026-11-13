"use client";

import {useEffect,useId,useRef,useState,type KeyboardEvent} from "react";
import {ChevronDown} from "lucide-react";

type Option={value:string;label:string;description?:string};
// Limited to aspect/currency: other selects retain their native interaction.
export function ChoicePicker({label,value,options,onChange,name,disabled=false}:{label:string;value:string;options:Option[];onChange:(value:string)=>void;name?:string;disabled?:boolean}){
  const id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  const [supported,setSupported]=useState(false),[open,setOpen]=useState(false),[active,setActive]=useState(0);
  const typed=useRef({text:"",at:0});
  useEffect(()=>setSupported("showPopover" in HTMLElement.prototype),[]);
  function place(){
    if(!trigger.current||!panel.current)return;
    const rect=trigger.current.getBoundingClientRect(),viewport=window.visualViewport;
    const left=viewport?.offsetLeft??0,top=viewport?.offsetTop??0,width=viewport?.width??innerWidth,height=viewport?.height??innerHeight;
    const menuWidth=Math.min(Math.max(rect.width,160),width-20),below=top+height-rect.bottom-8,above=rect.top-top-8;
    const available=Math.max(80,Math.min(320,Math.max(below,above)-10));
    const element=panel.current;
    element.style.width=`${menuWidth}px`;element.style.maxHeight=`${available}px`;
    element.style.left=`${Math.max(left+10,Math.min(rect.left,left+width-menuWidth-10))}px`;
    element.style.top=`${below>=Math.min(240,above)?rect.bottom+6:Math.max(top+10,rect.top-Math.min(element.scrollHeight,available)-6)}px`;
  }
  useEffect(()=>{
    if(!open)return;
    place();const viewport=window.visualViewport;
    const resize=()=>place();window.addEventListener("resize",resize);window.addEventListener("scroll",resize,true);viewport?.addEventListener("resize",resize);
    return()=>{window.removeEventListener("resize",resize);window.removeEventListener("scroll",resize,true);viewport?.removeEventListener("resize",resize);};
  },[open]);
  useEffect(()=>{if(disabled&&panel.current?.matches(":popover-open"))panel.current.hidePopover();},[disabled]);
  function focus(index:number){setActive(index);panel.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]?.focus();}
  function show(index=options.findIndex(option=>option.value===value)){
    const next=Math.max(0,index);setActive(next);panel.current?.showPopover();setOpen(true);place();requestAnimationFrame(()=>focus(next));
  }
  function hide(){panel.current?.hidePopover();setOpen(false);trigger.current?.focus();}
  function keys(event:KeyboardEvent){
    if(event.key==="Escape"){event.preventDefault();event.stopPropagation();hide();return;}
    if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)){
      event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?options.length-1:(active+(event.key==="ArrowDown"?1:options.length-1))%options.length;focus(next);
    }else if(event.key==="Tab"){hide();}
    else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey){
      const now=Date.now();typed.current={text:(now-typed.current.at<800?typed.current.text:"")+event.key.toLocaleLowerCase(),at:now};
      const index=options.findIndex(option=>(option.label+" "+(option.description??"")).toLocaleLowerCase().startsWith(typed.current.text));if(index>=0){event.preventDefault();focus(index);}
    }
  }
  if(!supported)return <select aria-label={label} name={name} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)}>{options.map(option=><option key={option.value} value={option.value} aria-label={option.description?`${option.label} — ${option.description}`:option.label}>{option.label}</option>)}</select>;
  return <div className="choice-picker">
    {name?<input type="hidden" name={name} value={value} disabled={disabled}/>:null}
    <button ref={trigger} type="button" className="choice-trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} disabled={disabled} onClick={()=>open?hide():show()} onKeyDown={event=>{if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)){event.preventDefault();show(event.key==="End"?options.length-1:undefined);}}}>
      <span>{options.find(option=>option.value===value)?.label??value}</span><ChevronDown size={16} aria-hidden="true"/>
    </button>
    <div ref={panel} id={id} popover="auto" role="listbox" aria-label={label} className="choice-options" onToggle={event=>{const shown=(event.nativeEvent as ToggleEvent).newState==="open";setOpen(shown);}} onKeyDown={keys}>
      {options.map((option,index)=><button type="button" role="option" data-value={option.value} aria-selected={option.value===value} aria-label={option.description?`${option.label} — ${option.description}`:option.label} title={option.description} tabIndex={active===index?0:-1} key={option.value} onFocus={()=>setActive(index)} onClick={()=>{onChange(option.value);hide();}}>{option.label}</button>)}
    </div>
  </div>;
}
