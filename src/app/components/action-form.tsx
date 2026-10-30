"use client";

import { createContext, startTransition, useContext, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { useExitEditor } from "./item-exit";

const SubmissionPending = createContext(false);

export function useSubmissionPending() {
  const inherited = useContext(SubmissionPending);
  const status = useFormStatus();
  return inherited || status.pending;
}

// Manual dispatch preserves uncontrolled fields and File inputs on recoverable errors.
export function ActionForm({ action, pending, children, onSubmit, ...props }: Omit<ComponentProps<"form">,"action"> & {action:(data:FormData)=>void;pending:boolean}) {
  useExitEditor(false,pending);
  return <SubmissionPending.Provider value={pending}><form {...props} onSubmit={event=>{
    onSubmit?.(event);
    if(event.defaultPrevented)return;
    event.preventDefault();
    if(!pending){const data=new FormData(event.currentTarget);startTransition(()=>action(data));}
  }}>{children}</form></SubmissionPending.Provider>;
}
