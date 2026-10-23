"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, ImageIcon } from "lucide-react";
import { useI18n } from "@/i18n/provider";

type Props = { src: string; alt: string; className?: string; variant: "thumbnail" | "detail" | "cover" | "card" | "preview"; width?: number; height?: number };

export function PrivateImage(props: Props) {
  return <ImageState key={props.src} {...props}/>;
}

function ImageState({ src, alt, className, variant, width, height }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const retried = useRef(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // A request can finish before hydration attaches React's event handlers.
    const image = imageRef.current;
    if (image?.complete) setState(image.naturalWidth > 0 ? "loaded" : "error");
  }, [attempt]);
  useEffect(() => {
    if (state !== "error" || retried.current) return;
    const retry = () => {
      retried.current = true;
      setState("loading");
      setAttempt(1);
    };
    window.addEventListener("online", retry, { once: true });
    return () => window.removeEventListener("online", retry);
  }, [state]);

  return <span className={`private-image-frame media-${variant}`} data-image-state={state}>
    <img ref={imageRef} key={attempt} className={className} src={src} alt={alt} width={width} height={height} onLoad={() => setState("loaded")} onError={() => setState("error")} style={{ visibility: state === "loaded" ? "visible" : "hidden" }}/>
    {state !== "loaded" ? <span className="private-image-placeholder" aria-hidden={alt ? undefined : true} role={alt ? state === "loading" ? "status" : "img" : undefined} aria-label={alt ? `${alt}: ${t(state === "loading" ? "imageLoading" : "imageUnavailable")}` : undefined}>{state === "loading" ? <ImageIcon size={22} aria-hidden="true"/> : <ImageOff size={22} aria-hidden="true"/>}</span> : null}
  </span>;
}
