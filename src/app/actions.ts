"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createItem, photoFirstItemValues, saveStock, updateItem, type ItemFields } from "@/items/service";
import { createItemWithPhoto, deleteItemWithMedia, removePrimaryPhoto, replacePrimaryPhoto, MediaValidationError } from "@/media/service";
import { addItemToCollection, addItemsToCollection, createCollection, deleteCollection, removeItemFromCollection, renameCollection, setCollectionCover } from "@/items/collections";
import { replaceCollectionCoverUpload } from "@/media/collection-covers";
import { getLocale } from "@/i18n/server";
import { locales, translate, type MessageKey, type Locale } from "@/i18n/messages";

export type ActionFeedback = { status: "idle" | "success" | "error"; message: string; itemId?: string; collectionId?: string; count?: number };
export type PhotoActionFeedback = ActionFeedback & { mediaId?: string };

export async function setLanguageAction(formData: FormData) {
  const locale = z.enum(locales).parse(formData.get("locale"));
  (await cookies()).set("all-items-language", locale, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

function errorMessage(error: unknown, fallback: MessageKey, locale: Locale) {
  if (!(error instanceof Error) || !error.message) return translate(locale, fallback);
  const known: Record<string, MessageKey> = {
    "Вещь не найдена": "itemNotFound",
    "Коллекция не найдена.": "collectionNotFound",
    "Такая коллекция уже есть.": "collectionAlreadyExists",
    "Для уникальной вещи количество должно быть равно 1": "stockUniqueInvalid",
    "Укажите каждое место хранения один раз": "stockLocationsDuplicate",
  };
  return known[error.message] ? translate(locale, known[error.message]!) : translate(locale, fallback);
}

function formValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""), model: String(formData.get("model") ?? ""), brand: String(formData.get("brand") ?? ""),
    category: String(formData.get("category") ?? ""), originalMarking: String(formData.get("originalMarking") ?? ""),
    notes: String(formData.get("notes") ?? ""), description: String(formData.get("description") ?? ""),
    identificationStatus: String(formData.get("identificationStatus") ?? "unknown"), trackingMode: String(formData.get("trackingMode") ?? "unique"),
    saleIntent: String(formData.get("saleIntent") ?? "not_for_sale"), askingPrice: String(formData.get("askingPrice") ?? ""),
    askingCurrency: String(formData.get("askingCurrency") ?? "RUB"),
  };
}

export async function addItemAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const uploaded = formData.get("photo");
  const file = uploaded instanceof File && uploaded.size > 0 ? uploaded : null;
  const sourceInput = formData.get("photoSource");
  const sourceFile = sourceInput instanceof File && sourceInput.size > 0 ? sourceInput : file;
  const cropValue = String(formData.get("crop") ?? "");
  const values = photoFirstItemValues(formValues(formData) as ItemFields, file !== null);
  const name = values.name.trim();
  if (!name && !file) return { status: "error", message: t("invalidItem") };
  let item: { id: string };
  try {
    item = file
      ? await createItemWithPhoto(values as ItemFields, file, sourceFile ?? file, cropValue)
      : await createItem(values as ItemFields);
  } catch (error) {
    if (error instanceof MediaValidationError) return { status: "error", message: t("invalidPhoto") };
    return { status: "error", message: file ? t("itemSaveFailed") : errorMessage(error, "itemSaveGeneric", locale) };
  }
  revalidatePath("/");
  return { status: "success", message: t("itemAdded"), itemId: item.id };
}

export async function replacePhotoAction(_previous: PhotoActionFeedback, formData: FormData): Promise<PhotoActionFeedback> {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const id = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return { status: "error", message: t("missingPhotoItem") };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: t("choosePhoto") };
  const sourceInput = formData.get("photoSource");
  const sourceFile = sourceInput instanceof File && sourceInput.size > 0 ? sourceInput : file;
  const cropValue = String(formData.get("crop") ?? "");
  try {
    const saved = await replacePrimaryPhoto(id.data, file, sourceFile, cropValue);
    revalidatePath("/"); revalidatePath(`/items/${id.data}`);
    return { status: "success", message: t("photoSaved"), mediaId: saved.id };
  } catch (error) {
    const message = error instanceof MediaValidationError ? t("invalidPhoto") : errorMessage(error, "photoSaveGeneric", locale);
    return { status: "error", message };
  }
}

export async function removePhoto(formData: FormData) {
  const locale = await getLocale();
  const id = z.string().uuid().parse(String(formData.get("id") ?? ""));
  z.literal("on", { error: translate(locale, "photoDeleteConfirm") }).parse(formData.get("confirm"));
  await removePrimaryPhoto(id);
  revalidatePath("/"); revalidatePath(`/items/${id}`);
  redirect(`/items/${id}`);
}

export async function updateItemAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const id = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return { status: "error", message: t("missingItemId") };
  const returnValue = String(formData.get("returnTo") ?? "/");
  const returnTo = z.union([z.literal("/"), z.string().regex(/^\/collections\/[0-9a-f-]{36}$/i)]).safeParse(returnValue);
  if (!returnTo.success) return { status: "error", message: t("itemUpdateGeneric") };
  try {
    await updateItem(id.data, formValues(formData) as ItemFields);
    revalidatePath("/"); revalidatePath(`/items/${id.data}`); revalidatePath("/collections");
    return { status: "success", message: t("changesSaved"), collectionId: returnTo.data.startsWith("/collections/") ? returnTo.data.split("/")[2] : undefined };
  } catch (error) { return { status: "error", message: errorMessage(error, "itemUpdateGeneric", locale) }; }
}

export async function updateStockAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const id = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return { status: "error", message: t("missingItemId") };
  const locations = formData.getAll("location");
  const quantities = formData.getAll("quantity");
  const parsedLocations = z.array(z.string()).max(50).safeParse(locations);
  const parsedQuantities = z.array(z.string()).max(50).safeParse(quantities);
  if (!parsedLocations.success || !parsedQuantities.success || locations.length !== quantities.length || locations.length > 50) {
    return { status: "error", message: t("stockRowsInvalid") };
  }
  const rows = z.array(z.object({ location: z.string().max(120), quantity: z.string().regex(/^\d{1,7}$/) })).max(50).safeParse(
    locations.map((location, index) => ({ location, quantity: quantities[index] })),
  );
  if (!rows.success) return { status: "error", message: t("stockQuantityInvalid") };
  try {
    await saveStock(id.data, rows.data.map((row) => ({ location: row.location, quantity: Number(row.quantity) })));
    revalidatePath("/"); revalidatePath(`/items/${id.data}`);
    return { status: "success", message: t("stockSaved") };
  } catch (error) {
    return { status: "error", message: errorMessage(error, "stockSaveGeneric", locale) };
  }
}

export async function createCollectionAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const locale = await getLocale();
  try {
    const collection = await createCollection({ name: formData.get("name"), icon: formData.get("icon") });
    revalidatePath("/collections");
    return { status: "success", message: translate(locale, "collectionCreated"), collectionId: collection.id };
  } catch (error) { return { status: "error", message: errorMessage(error, "collectionCreateGeneric", locale) }; }
}

export async function addItemsToCollectionAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const collectionId = z.string().uuid().safeParse(formData.get("collectionId"));
  const itemIds = z.array(z.string().uuid()).min(1).max(500).safeParse(formData.getAll("itemId").map(String));
  if (!collectionId.success || !itemIds.success) return { status: "error", message: t("chooseItems") };
  try {
    const result = await addItemsToCollection(collectionId.data, itemIds.data);
    revalidatePath("/"); revalidatePath("/collections"); revalidatePath(`/collections/${collectionId.data}`);
    return { status: "success", message: translate(locale, "collectionItemsAdded", { count: result.added }), count: result.added };
  } catch (error) { return { status: "error", message: errorMessage(error, "membershipAddGeneric", locale) }; }
}

export async function setCollectionCoverAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const collectionId = z.string().uuid().safeParse(formData.get("collectionId"));
  if (!collectionId.success) return { status: "error", message: t("missingCollectionId") };
  const type = z.enum(["item_photo", "upload", "emoji", "default"]).safeParse(formData.get("coverType"));
  if (!type.success) return { status: "error", message: t("collectionCoverSaveFailed") };
  try {
    if (type.data === "upload") {
      const file = formData.get("coverFile");
      if (!(file instanceof File) || file.size < 1) return { status: "error", message: t("choosePhoto") };
      await replaceCollectionCoverUpload(collectionId.data, file);
    } else if (type.data === "item_photo") {
      const selected = z.string().regex(/^[0-9a-f-]{36}:[0-9a-f-]{36}$/i).safeParse(formData.get("selectedPhoto"));
      if (!selected.success) return { status: "error", message: t("collectionCoverSaveFailed") };
      const [itemId, mediaId] = selected.data.split(":");
      await setCollectionCover(collectionId.data, { type: type.data, itemId, mediaId });
    } else if (type.data === "emoji") {
      await setCollectionCover(collectionId.data, { type: type.data, icon: formData.get("icon") });
    } else {
      await setCollectionCover(collectionId.data, { type: type.data });
    }
    revalidatePath("/collections"); revalidatePath(`/collections/${collectionId.data}`);
    return { status: "success", message: t("collectionCoverSaved") };
  } catch (error) {
    const message = error instanceof MediaValidationError ? t("invalidPhoto") : errorMessage(error, "collectionCoverSaveFailed", locale);
    return { status: "error", message };
  }
}

export async function renameCollectionAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: t("missingCollectionId") };
  try {
    await renameCollection(id.data, { name: formData.get("name"), icon: formData.get("icon") });
    revalidatePath("/collections"); revalidatePath(`/collections/${id.data}`);
    return { status: "success", message: t("collectionRenameSaved") };
  } catch (error) { return { status: "error", message: errorMessage(error, "collectionRenameGeneric", locale) }; }
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = z.string().uuid().parse(formData.get("id"));
  z.literal("on", { error: translate(locale, "collectionDeleteConfirmError") }).parse(formData.get("confirm"));
  await deleteCollection(id);
  revalidatePath("/collections"); revalidatePath(`/collections/${id}`); revalidatePath("/");
  redirect("/collections");
}

export async function addCollectionMembershipAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const itemId = z.string().uuid().safeParse(formData.get("itemId"));
  const collectionId = z.string().uuid().safeParse(formData.get("collectionId"));
  if (!itemId.success || !collectionId.success) return { status: "error", message: t("chooseCollection") };
  try {
    await addItemToCollection(collectionId.data, itemId.data);
    revalidatePath(`/items/${itemId.data}`); revalidatePath("/collections");
    return { status: "success", message: t("collectionAdded") };
  } catch (error) { return { status: "error", message: errorMessage(error, "membershipAddGeneric", locale) }; }
}

export async function removeCollectionMembershipAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const itemId = z.string().uuid().safeParse(formData.get("itemId"));
  const collectionId = z.string().uuid().safeParse(formData.get("collectionId"));
  if (!itemId.success || !collectionId.success) return { status: "error", message: t("membershipUnknown") };
  await removeItemFromCollection(collectionId.data, itemId.data);
  revalidatePath(`/items/${itemId.data}`); revalidatePath(`/collections/${collectionId.data}`);
  return { status: "success", message: t("collectionRemoved") };
}

export async function removeItem(formData: FormData) {
  const locale = await getLocale();
  const id = z.string().uuid().parse(String(formData.get("id") ?? ""));
  z.literal("on", { error: translate(locale, "itemDeleteConfirmError") }).parse(formData.get("confirm"));
  await deleteItemWithMedia(id);
  revalidatePath("/");
  redirect("/");
}
