"use client";

import { useState } from "react";
import { Archive, Download, FileSpreadsheet } from "lucide-react";
import { type Locale, translate } from "@/i18n/messages";

type ExportKind = "archive" | "csv";

export function ExportControls({ locale }: { locale: Locale }) {
  const [pending, setPending] = useState<ExportKind | null>(null);
  const [feedback, setFeedback] = useState("");
  async function download(kind: ExportKind) {
    if (pending) return;
    setPending(kind); setFeedback("");
    try {
      const response = await fetch(`/api/export/${kind}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || translate(locale, kind === "archive" ? "exportArchiveFailed" : "exportCsvFailed"));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `all-items-${kind}`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setFeedback(translate(locale, "exportReady"));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : translate(locale, kind === "archive" ? "exportArchiveFailed" : "exportCsvFailed"));
    } finally { setPending(null); }
  }
  return <>
    <div className="export-actions">
      <button className="add-button" type="button" disabled={pending !== null} onClick={() => void download("archive")}>{pending === "archive" ? <Download size={16} aria-hidden="true"/> : <Archive size={16} aria-hidden="true"/>}{pending === "archive" ? translate(locale, "exportPreparing") : translate(locale, "downloadArchive")}</button>
      <button className="text-button" type="button" disabled={pending !== null} onClick={() => void download("csv")}>{pending === "csv" ? <Download size={16} aria-hidden="true"/> : <FileSpreadsheet size={16} aria-hidden="true"/>}{pending === "csv" ? translate(locale, "exportPreparing") : translate(locale, "exportCsv")}</button>
    </div>
    <p className="export-note">{translate(locale, "exportCsvNote")}</p>
    <p className={`form-feedback ${feedback && feedback !== translate(locale, "exportReady") ? "error" : "success"}`} role="status" aria-live="polite">{feedback}</p>
  </>;
}
