"use client";

import { useInventory } from "./inventory-provider";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { type Locale, type MessageKey, isMessageKey, translate } from "@/i18n/messages";
import type { ImportPreview } from "@/export/import";

const maxArchiveBytes = 128 * 1024 * 1024;

export function ImportControls({ locale }: { locale: Locale }) {
  const { base } = useInventory();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [pending, setPending] = useState<"checking" | "restoring" | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(locale, key, params);

  async function upload(selected: File, action: "preview" | "restore") {
    const response = await fetch(`${base}/api/import/${action}`, { method: "POST", headers: { "Content-Type": "application/zip", "X-All-Items-Import": "1" }, body: selected });
    const data = await response.json() as ImportPreview & { error?: string };
    if (!response.ok) throw new Error(isMessageKey(data.error) ? data.error : "importFailed");
    return data;
  }

  async function choose(selected: File | null) {
    setFile(selected); setPreview(null); setError(null);
    if (!selected) return;
    if (selected.size < 1 || selected.size > maxArchiveBytes) { setError("importInvalid"); return; }
    setPending("checking");
    try { setPreview(await upload(selected, "preview")); }
    catch (cause) { setError(cause instanceof Error && isMessageKey(cause.message) ? cause.message : "importInvalid"); }
    finally { setPending(null); }
  }

  async function restore() {
    if (!file || !preview || pending) return;
    setPending("restoring"); setError(null);
    try { await upload(file, "restore"); router.push(base); router.refresh(); }
    catch (cause) { setError(cause instanceof Error && isMessageKey(cause.message) ? cause.message : "importFailed"); setPending(null); }
  }

  function cancel() { setFile(null); setPreview(null); setError(null); if (input.current) input.current.value = ""; }

  return <section className="import-panel" aria-labelledby="import-heading">
    <h2 id="import-heading">{t("importArchive")}</h2>
    <input ref={input} className="visually-hidden" tabIndex={-1} aria-hidden="true" type="file" accept=".zip,application/zip" onChange={(event) => void choose(event.target.files?.[0] ?? null)}/>
    {!preview ? <button type="button" className="quiet-button import-pick-button" disabled={pending !== null} onClick={() => input.current?.click()}><Upload size={17} aria-hidden="true"/>{pending === "checking" ? t("importChecking") : t("importArchive")}</button> : <div className="import-preview" role="group" aria-labelledby="import-preview-heading">
      <h3 id="import-preview-heading">{t("importPreview")}</h3>
      <p className="import-file-name">{file?.name}</p>
      <div className="import-summary"><span>{t("importItems", { count: preview.items })}</span><span>{t("importCollections", { count: preview.collections })}</span><span>{t("importPhotos", { count: preview.photos })}</span><span>{t("importExported", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(preview.exportedAt)) })}</span></div>
      <div className="import-actions"><button type="button" className="text-button" disabled={pending !== null} onClick={cancel}>{t("cancel")}</button><button type="button" className="add-button" disabled={pending !== null} onClick={() => void restore()}>{pending === "restoring" ? t("importRunning") : t("importConfirm")}</button></div>
    </div>}
    {pending ? <p className="visually-hidden" role="status">{pending === "checking" ? t("importChecking") : t("importRunning")}</p> : null}
    {error ? <p className="inline-status error-status" role="alert">{t(error)}</p> : null}
  </section>;
}
