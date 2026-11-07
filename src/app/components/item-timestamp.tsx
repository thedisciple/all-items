"use client";
import {useEffect,useState} from "react";
import {formatItemInstant} from "@/i18n/item-dates";
import {useI18n} from "@/i18n/provider";

export function ItemTimestamp({value,kind="dateAdded"}:{value:string;kind?:"dateAdded"|"dateUpdated"}){
  const {locale,t}=useI18n();const [rendered,setRendered]=useState<string|null>(null);
  // The server cannot know the viewer's time zone. Do not render a misleading server-zone date.
  useEffect(()=>{setRendered(formatItemInstant(value,locale));},[value,locale]);
  return rendered?<span className="item-timestamp"><span>{t(kind)}: </span><time dateTime={value}>{rendered}</time></span>:null;
}
