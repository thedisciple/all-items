"use client";

import { LockKeyhole } from "lucide-react";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { addItemAction, type ActionFeedback } from "@/app/actions";
import { PhotoAcquisition, type PhotoDraft } from "./photo-acquisition";
import { DraftConflict, draftToFile, fileToDraft, readDraft, writeDraft, type DraftFields, type DraftRecord } from "@/drafts/recovery-store";
import type { Presentation } from "@/items/inventory-presentation";
import { FormSubmitButton } from "./form-submit-button";
import { InventoryStockFields, validStockDraft, type StockDraft } from "./inventory-stock-fields";
import { CategoryField } from "./category-field";
import { useInventory } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";

const idle: ActionFeedback = { status: "idle", message: "" };
type Draft = { name: string; model: string; brand: string; categories: string[]; trackingMode: string; originalMarking: string; description: string; notes: string; identificationStatus: string; saleIntent: string; askingPrice: string; askingCurrency: string };

export function AddItemForm() {
  const { t } = useI18n();
  const { base, inventory } = useInventory();
  const [feedback, action, pending] = useActionState(addItemAction, idle);
  const [draft, setDraft] = useState<Draft>({ name: "", model: "", brand: "", categories: [], trackingMode: "unique", originalMarking: "", description: "", notes: "", identificationStatus: "unknown", saleIntent: "not_for_sale", askingPrice: "", askingCurrency: "RUB" });
  const [rows, setRows] = useState<StockDraft[]>([{ location: "", quantity: "1" }]);
  const [categoryDraft, setCategoryDraft] = useState<Presentation[]>([]);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const [photoDirty, setPhotoDirty] = useState(false);
  const submitLocked = useRef(false);
  const [resetToken, setResetToken] = useState(0);
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft | null>(null);
  const [photoRecovery, setPhotoRecovery] = useState<{ token: number; photo: PhotoDraft } | null>(null);
  const [storedDraft, setStoredDraft] = useState<DraftRecord | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState<"" | "draftStorageFailed" | "draftStorageConflict" | "draftSavedCleanupFailed">("");
  const revision = useRef<string | null>(null);
  const storageEnabled = useRef(true);
  const finalizing = useRef(false);
  const hasQueued = useRef(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const draftKey = `${inventory.workspaceId}:add-item`;
  const dirty = Boolean(draft.name || draft.model || draft.brand || draft.categories.length || draft.originalMarking || draft.description || draft.notes || draft.identificationStatus !== "unknown" || draft.saleIntent !== "not_for_sale" || draft.askingPrice || draft.askingCurrency !== "RUB" || draft.trackingMode !== "unique" || rows.some(row => row.location || row.quantity !== "1")) || photoDirty;
  const meaningful = Boolean([draft.name, draft.model, draft.brand, draft.originalMarking, draft.description, draft.notes, draft.askingPrice].some(value => value.trim()) || draft.categories.length || draft.identificationStatus !== "unknown" || draft.saleIntent !== "not_for_sale" || draft.askingCurrency !== "RUB" || draft.trackingMode !== "unique" || rows.some(row => row.location.trim() || row.quantity !== "1") || photoDraft);
  const update = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  function enqueue(record: DraftRecord | null) {
    hasQueued.current = Boolean(record);
    const operation = queue.current.then(async () => {
      if (!storageEnabled.current) throw new Error("Draft storage unavailable");
      await writeDraft(record, draftKey, revision.current);
      revision.current = record?.revision ?? null;
    });
    queue.current = operation.catch(error => {
      storageEnabled.current = false;
      setStorageError(error instanceof DraftConflict ? "draftStorageConflict" : "draftStorageFailed");
    });
    return operation;
  }

  useEffect(() => {
    let active = true;
    void readDraft(draftKey).then(value => {
      if (!active) return;
      revision.current = value?.revision ?? null;
      setStoredDraft(value);
      setStorageReady(true);
    }).catch(() => { if (active) { storageEnabled.current = false; setStorageError("draftStorageFailed"); setStorageReady(true); } });
    return () => { active = false; };
  }, [draftKey]);

  useEffect(() => {
    if (!storageReady || storedDraft || !storageEnabled.current || finalizing.current || cleanupPending) return;
    if (!meaningful) { if (hasQueued.current || revision.current) void enqueue(null).catch(() => {}); return; }
    const photo = photoDraft ? {
      selected: photoDraft.selected ? fileToDraft(photoDraft.selected) : null,
      source: photoDraft.source ? fileToDraft(photoDraft.source) : null,
      pending: photoDraft.pending ? fileToDraft(photoDraft.pending) : null,
      crop: photoDraft.crop,
    } : null;
    const record: DraftRecord = { version: 1, key: draftKey, revision: crypto.randomUUID(), updatedAt: Date.now(), fields: draft as DraftFields, rows, categoryPresentation: categoryDraft.filter(entry => draft.categories.includes(entry.category)), photo };
    void enqueue(record).catch(() => {});
  // Changes are serialized; a later write compares against the preceding committed revision.
  }, [storageReady, storedDraft, meaningful, draft, rows, categoryDraft, photoDraft, draftKey, cleanupPending]);

  function restoreStored() {
    if (!storedDraft) return;
    setDraft(storedDraft.fields); setRows(storedDraft.rows); setCategoryDraft(storedDraft.categoryPresentation);
    if (storedDraft.photo) {
      const photo: PhotoDraft = { selected: storedDraft.photo.selected ? draftToFile(storedDraft.photo.selected) : null, source: storedDraft.photo.source ? draftToFile(storedDraft.photo.source) : null, pending: storedDraft.photo.pending ? draftToFile(storedDraft.photo.pending) : null, crop: storedDraft.photo.crop };
      setPhotoDraft(photo); setPhotoDirty(Boolean(photo.selected || photo.pending)); setPhotoRecovery({ token: Date.now(), photo });
    }
    setStoredDraft(null);
  }

  async function discardStored() {
    try { await enqueue(null); setStoredDraft(null); }
    catch { /* Keep the choice available when another tab changed the draft. */ }
  }

  useEffect(() => {
    if (feedback.status === "success" && feedback.itemId) {
      const savedId = feedback.itemId;
      finalizing.current = true;
      setCleanupPending(true);
      void (async () => {
        try {
          if (storageEnabled.current && (revision.current !== null || meaningful || hasQueued.current)) await enqueue(null);
          else if (!storageEnabled.current && (revision.current !== null || hasQueued.current)) throw new Error("Draft cleanup unavailable");
        }
        catch { setStorageError("draftSavedCleanupFailed"); }
        setDraft({ name: "", model: "", brand: "", categories: [], trackingMode: "unique", originalMarking: "", description: "", notes: "", identificationStatus: "unknown", saleIntent: "not_for_sale", askingPrice: "", askingCurrency: "RUB" });
        setRows([{ location: "", quantity: "1" }]);
        setCategoryDraft([]);
        setResetToken((value) => value + 1);
        setPhotoDirty(false);
        setPhotoDraft(null);
        setPhotoRecovery(null);
        setOpen(false);
        finalizing.current = false;
        setCleanupPending(false);
        submitLocked.current = false;
        router.push(`${base}?added=${savedId}`);
      })();
    }
    if (feedback.status === "error") submitLocked.current = false;
  }, [feedback, router, base]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type='hidden']):not(.visually-hidden),select:not([disabled]),textarea:not([disabled])")?.focus();
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" className="add-button add-dialog-trigger" onClick={() => setOpen(true)}><Plus size={17} aria-hidden="true"/><span>{t("addItem")}</span></button>
    {storageError && !open ? <p className="form-error" role="alert">{t(storageError)}</p> : null}
    <div className="photo-source-overlay add-dialog-overlay" role="presentation" hidden={!open}>
      <section ref={dialogRef} className="photo-source-dialog add-item-dialog" role="dialog" aria-modal="true" aria-labelledby="add-item-title" onKeyDown={(event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('[role="dialog"]') !== event.currentTarget) return;
        if (event.key === "Escape") { if (!dirty && !pending && !cleanupPending) { setOpen(false); triggerRef.current?.focus(); } return; }
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type='hidden']):not(.visually-hidden),select:not([disabled]),textarea:not([disabled]),[tabindex='0']"));
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <div className="dialog-heading"><h2 id="add-item-title">{t("addItem")}</h2><button type="button" className="icon-button" aria-label={t("close")} disabled={pending || cleanupPending} onClick={() => { setOpen(false); triggerRef.current?.focus(); }}><X size={18} aria-hidden="true"/></button></div>
        {storageError ? <p className="form-error" role="alert">{t(storageError)}</p> : null}
        {cleanupPending ? <p role="status">{t("addingItem")}</p> : null}
        {!storageReady ? <p role="status">{t("draftLoading")}</p> : storedDraft ? <div className="draft-recovery" role="group" aria-label={t("draftRecoveryTitle")}><h3>{t("draftRecoveryTitle")}</h3><p>{t("draftRecoveryPrompt")}</p><div className="dialog-actions"><button type="button" className="add-button" onClick={restoreStored}>{t("draftRestore")}</button><button type="button" className="quiet-button" onClick={() => void discardStored()}>{t("draftDiscardSaved")}</button></div></div> : <form aria-busy={pending || cleanupPending} inert={pending || cleanupPending} className="photo-add-form" onSubmit={(event) => { event.preventDefault(); if (!submitLocked.current) { submitLocked.current = true; const data = new FormData(event.currentTarget); startTransition(() => action(data)); } }}>
          <PhotoAcquisition name="photo" resetToken={resetToken} recovery={photoRecovery} onRecoveryChange={setPhotoDraft} onDraftChange={(value) => { setPhotoDirty(value); }}/>
          <div className="photo-add-fields">
            <label className="field"><span>{t("itemName")}</span><input name="name" value={draft.name} placeholder={t("itemNamePlaceholder")} maxLength={160} onChange={update("name")}/></label>
            <label className="field"><span>{t("itemModel")}</span><input name="model" value={draft.model} placeholder={t("itemModelPlaceholder")} maxLength={160} onChange={update("model")}/></label>
            <label className="field"><span>{t("itemBrand")}</span><input name="brand" value={draft.brand} placeholder={t("brandPlaceholder")} maxLength={120} onChange={update("brand")}/></label>
            <CategoryField key={resetToken} values={draft.categories} onValueChange={(categories) => setDraft((current) => ({ ...current, categories }))} presentations={categoryDraft} onPresentationChange={setCategoryDraft}/>
          </div>
          <InventoryStockFields mode={draft.trackingMode} rows={rows} onModeChange={trackingMode => setDraft(value => ({ ...value, trackingMode }))} onRowsChange={setRows}/>
          <details className="advanced-fields"><summary>{t("additionalDetails")}</summary><div className="detail-grid advanced-item-fields">
            <label className="field"><span>{t("itemOriginalMarking")}</span><input name="originalMarking" value={draft.originalMarking} placeholder={t("markingPlaceholder")} maxLength={160} onChange={update("originalMarking")}/></label>
            <label className="field"><span>{t("identificationStatus")}</span><select name="identificationStatus" value={draft.identificationStatus} onChange={(event) => setDraft((current) => ({ ...current, identificationStatus: event.target.value }))}><option value="unknown">{t("itemStatusUnknown")}</option><option value="user_confirmed">{t("itemStatusConfirmed")}</option><option value="source_verified">{t("itemStatusVerified")}</option></select></label>
            <label className="field"><span className="private-field-label"><LockKeyhole size={12} aria-hidden="true"/>{t("saleIntent")}</span><select name="saleIntent" value={draft.saleIntent} onChange={(event) => setDraft((current) => ({ ...current, saleIntent: event.target.value }))}><option value="not_for_sale">{t("saleNo")}</option><option value="considering">{t("saleConsidering")}</option><option value="willing_to_sell">{t("saleYes")}</option></select></label>
            <label className="field"><span className="private-field-label"><LockKeyhole size={12} aria-hidden="true"/>{t("askingPrice")}</span><input type="number" min="0" step="0.01" name="askingPrice" value={draft.askingPrice} onChange={(event) => setDraft((current) => ({ ...current, askingPrice: event.target.value }))}/></label>
            <label className="field"><span>{t("currency")}</span><select name="askingCurrency" value={draft.askingCurrency} onChange={(event) => setDraft((current) => ({ ...current, askingCurrency: event.target.value }))}><option>RUB</option><option>EUR</option><option>USD</option><option>HUF</option></select></label>
            <label className="field full-field"><span>{t("itemDescription")}</span><textarea name="description" maxLength={4000} value={draft.description} onChange={update("description")}/></label>
            <label className="field full-field"><span className="private-field-label"><LockKeyhole size={12} aria-hidden="true"/>{t("itemNotes")}</span><textarea name="notes" maxLength={2000} value={draft.notes} onChange={update("notes")}/></label>
          </div></details>

          {feedback.status === "error" && feedback.message ? <p className="form-error" role="alert">{feedback.message ? t(feedback.message, feedback.values) : ""}</p> : null}
          <div className="dialog-actions"><FormSubmitButton className="add-button" disabled={pending || !validStockDraft(rows, draft.trackingMode)} pendingLabel={t("addingItem")}><Plus size={16} aria-hidden="true"/><span>{pending ? t("addingItem") : t("saveItem")}</span></FormSubmitButton><button type="button" className="text-button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>{t("close")}</button>{dirty ? <button type="button" className="text-button" onClick={() => { if (window.confirm(t("discardDraftConfirm"))) { if (storageEnabled.current) void enqueue(null).catch(() => {}); setDraft({ name: "", model: "", brand: "", categories: [], trackingMode: "unique", originalMarking: "", description: "", notes: "", identificationStatus: "unknown", saleIntent: "not_for_sale", askingPrice: "", askingCurrency: "RUB" }); setRows([{ location: "", quantity: "1" }]); setCategoryDraft([]); setResetToken((value) => value + 1); setPhotoDirty(false); setPhotoDraft(null); } }}>{t("discardDraft")}</button> : null}</div>
        </form>}
      </section>
    </div>
  </>;
}
