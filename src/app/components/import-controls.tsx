"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { type Locale, translate } from "@/i18n/messages";
import type { ImportPreview } from "@/export/import";

const maxArchiveBytes = 128 * 1024 * 1024;

export function ImportControls({ locale }: { locale: Locale }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [pending, setPending] = useState<"checking" | "restoring" | null>(null);
  const [error, setError] = useState("");
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(locale, key, params);

  async function upload(selected: File, action: "preview" | "restore") {
    const response = await fetch(`/api/import/${action}`, { method: "POST", headers: { "Content-Type": "application/zip", "X-All-Items-Import": "1" }, body: selected });
    const data = await response.json() as ImportPreview & { error?: string };
    if (!response.ok) throw new Error(data.error || t("importFailed"));
    return data;
  }

  async function choose(selected: File | null) {
    setFile(selected); setPreview(null); setError("");
    if (!selected) return;
    if (selected.size < 1 || selected.size > maxArchiveBytes) { setError(t("importInvalid")); return; }
    setPending("checking");
    try { setPreview(await upload(selected, "preview")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("importInvalid")); }
    finally { setPending(null); }
  }

  async function restore() {
    if (!file || !preview || pending) return;
    setPending("restoring"); setError("");
    try { await upload(file, "restore"); router.push("/"); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("importFailed")); setPending(null); }
  }

  function cancel() { setFile(null); setPreview(null); setError(""); if (input.current) input.current.value = ""; }

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
    {error ? <p className="inline-status error-status" role="alert">{error}</p> : null}
  </section>;
}
