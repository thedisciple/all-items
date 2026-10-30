"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createItem, photoFirstItemValues, updateItem, type ItemFields } from "@/items/service";
import { createItemWithPhoto, deleteItemWithMedia, removePrimaryPhoto, replacePrimaryPhoto, MediaValidationError } from "@/media/service";
import { addItemToCollection, addItemsToCollection, createCollection, deleteCollection, removeItemFromCollection, renameCollection, setCollectionCover } from "@/items/collections";
import { replaceCollectionCoverUpload } from "@/media/collection-covers";
import { resolveInventory } from "@/items/inventories";
import { inventoryPath, inventoryReturnPath } from "@/items/inventory-context";
import { locales, type MessageKey } from "@/i18n/messages";



export type ActionFeedback = { status: "idle" | "success" | "error"; message: MessageKey | ""; values?: Record<string,string|number>; itemId?: string; collectionId?: string; count?: number };
export type PhotoActionFeedback = ActionFeedback & { mediaId?: string };

export async function setLanguageAction(formData: FormData) {
  const locale = z.enum(locales).parse(formData.get("locale"));
  (await cookies()).set("all-items-language", locale, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

function errorMessage(error: unknown, fallback: MessageKey) {
  if (!(error instanceof Error) || !error.message) return fallback;
  const known: Record<string, MessageKey> = {
    "Item not found": "itemNotFound",
    "Single item requires one unit and one location": "stockModeConflict",
    "Duplicate stock locations": "stockLocationsDuplicate",
    "Вещь не найдена": "itemNotFound",
    "Коллекция не найдена.": "collectionNotFound",
    "Такая коллекция уже есть.": "collectionAlreadyExists",
    "Для уникальной вещи количество должно быть равно 1": "stockUniqueInvalid",
    "Укажите каждое место хранения один раз": "stockLocationsDuplicate",
  };
  return known[error.message] ? known[error.message]! : fallback;
}

function formValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""), model: String(formData.get("model") ?? ""), brand: String(formData.get("brand") ?? ""),
    categories: formData.getAll("categories"), categoryPresentation: JSON.parse(String(formData.get("categoryPresentation") ?? "[]")), originalMarking: String(formData.get("originalMarking") ?? ""),
    notes: String(formData.get("notes") ?? ""), description: String(formData.get("description") ?? ""),
    identificationStatus: String(formData.get("identificationStatus") ?? "unknown"), trackingMode: String(formData.get("trackingMode") ?? "unique"),
    saleIntent: String(formData.get("saleIntent") ?? "not_for_sale"), askingPrice: String(formData.get("askingPrice") ?? ""),
    askingCurrency: String(formData.get("askingCurrency") ?? "RUB"),
  };
}

export async function addItemAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  const uploaded = formData.get("photo");
  const file = uploaded instanceof File && uploaded.size > 0 ? uploaded : null;
  const sourceInput = formData.get("photoSource");
  const sourceFile = sourceInput instanceof File && sourceInput.size > 0 ? sourceInput : file;
  const cropValue = String(formData.get("crop") ?? "");
  let item: { id: string };
  try {
    const values = photoFirstItemValues(formValues(formData) as ItemFields, file !== null);
    if (!values.name.trim() && !file) return { status: "error", message: "invalidItem" };
    item = file
      ? await createItemWithPhoto(context, values as ItemFields, file, sourceFile ?? file, cropValue, JSON.parse(String(formData.get("stock") ?? "[]")))
      : await createItem(context, values as ItemFields, JSON.parse(String(formData.get("stock") ?? "[]")));
  } catch (error) {
    if (error instanceof MediaValidationError) return { status: "error", message: "invalidPhoto" };
    return { status: "error", message: file ? "itemSaveFailed" : errorMessage(error, "itemSaveGeneric") };
  }
  revalidatePath(inventoryPath(context), "layout");
  return { status: "success", message: "itemAdded", itemId: item.id };
}

export async function replacePhotoAction(_previous: PhotoActionFeedback, formData: FormData): Promise<PhotoActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  const id = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return { status: "error", message: "missingPhotoItem" };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "choosePhoto" };
  const sourceInput = formData.get("photoSource");
  const sourceFile = sourceInput instanceof File && sourceInput.size > 0 ? sourceInput : file;
  const cropValue = String(formData.get("crop") ?? "");
  try {
    const saved = await replacePrimaryPhoto(context, id.data, file, sourceFile, cropValue);
    revalidatePath(inventoryPath(context), "layout"); revalidatePath(inventoryPath(context,`/items/${id.data}`));
    return { status: "success", message: "photoSaved", mediaId: saved.id };
  } catch (error) {
    const message = error instanceof MediaValidationError ? "invalidPhoto" : errorMessage(error, "photoSaveGeneric");
    return { status: "error", message };
  }
}

export async function removePhoto(formData: FormData): Promise<void | ActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  const id = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return {status:"error",message:"operationFailed"};
  try {
  z.literal("on", { error: "photoDeleteConfirm" }).parse(formData.get("confirm"));
  await removePrimaryPhoto(context, id.data);
  } catch { return {status:"error",message:"operationFailed"}; }
  revalidatePath(inventoryPath(context), "layout"); revalidatePath(inventoryPath(context,`/items/${id.data}`));
  redirect(inventoryPath(context,`/items/${id.data}`));
}

export async function updateItemAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  const id = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return { status: "error", message: "missingItemId" };
  let returnTo: string;
  try { returnTo = inventoryReturnPath(context, formData.get("returnTo")); }
  catch { return { status: "error", message: "itemUpdateGeneric" }; }
  try {
    await updateItem(context, id.data, formValues(formData) as ItemFields, JSON.parse(String(formData.get("stock") ?? "[]")));
    revalidatePath(inventoryPath(context), "layout"); revalidatePath(inventoryPath(context,`/items/${id.data}`)); revalidatePath(inventoryPath(context,"/collections"));
    return { status: "success", message: "changesSaved", collectionId: returnTo.startsWith(inventoryPath(context,"/collections/")) ? returnTo.split("/").at(-1) : undefined };
  } catch (error) { return { status: "error", message: errorMessage(error, "itemUpdateGeneric") }; }
}

export async function createCollectionAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  try {
    const collection = await createCollection(context, { name: formData.get("name"), icon: formData.get("icon") });
    revalidatePath(inventoryPath(context), "layout"); revalidatePath(inventoryPath(context,"/collections"));
    return { status: "success", message: "collectionCreated", collectionId: collection.id };
  } catch (error) { return { status: "error", message: errorMessage(error, "collectionCreateGeneric") }; }
}

export async function addItemsToCollectionAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  const collectionId = z.string().uuid().safeParse(formData.get("collectionId"));
  const itemIds = z.array(z.string().uuid()).min(1).max(500).safeParse(formData.getAll("itemId").map(String));
  if (!collectionId.success || !itemIds.success) return { status: "error", message: "chooseItems" };
  try {
    const result = await addItemsToCollection(context, collectionId.data, itemIds.data);
    revalidatePath(inventoryPath(context), "layout"); revalidatePath(inventoryPath(context,"/collections")); revalidatePath(inventoryPath(context,`/collections/${collectionId.data}`));
    return { status: "success", message: "collectionItemsAdded", values: { count: result.added }, count: result.added };
  } catch (error) { return { status: "error", message: errorMessage(error, "membershipAddGeneric") }; }
}

export async function setCollectionCoverAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  const collectionId = z.string().uuid().safeParse(formData.get("collectionId"));
  if (!collectionId.success) return { status: "error", message: "missingCollectionId" };
  const type = z.enum(["item_photo", "upload", "emoji", "default"]).safeParse(formData.get("coverType"));
  if (!type.success) return { status: "error", message: "collectionCoverSaveFailed" };
  try {
    if (type.data === "upload") {
      const file = formData.get("coverFile");
      if (!(file instanceof File) || file.size < 1) return { status: "error", message: "choosePhoto" };
      await replaceCollectionCoverUpload(context, collectionId.data, file);
    } else if (type.data === "item_photo") {
      const selected = z.string().regex(/^[0-9a-f-]{36}:[0-9a-f-]{36}$/i).safeParse(formData.get("selectedPhoto"));
      if (!selected.success) return { status: "error", message: "collectionCoverSaveFailed" };
      const [itemId, mediaId] = selected.data.split(":");
      await setCollectionCover(context, collectionId.data, { type: type.data, itemId, mediaId });
    } else if (type.data === "emoji") {
      await setCollectionCover(context, collectionId.data, { type: type.data, icon: formData.get("icon") });
    } else {
      await setCollectionCover(context, collectionId.data, { type: type.data });
    }
    revalidatePath(inventoryPath(context,"/collections")); revalidatePath(inventoryPath(context,`/collections/${collectionId.data}`));
    return { status: "success", message: "collectionCoverSaved" };
  } catch (error) {
    const message = error instanceof MediaValidationError ? "invalidPhoto" : errorMessage(error, "collectionCoverSaveFailed");
    return { status: "error", message };
  }
}

export async function renameCollectionAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "missingCollectionId" };
  try {
    await renameCollection(context, id.data, { name: formData.get("name"), icon: formData.get("icon") });
    revalidatePath(inventoryPath(context,"/collections")); revalidatePath(inventoryPath(context,`/collections/${id.data}`));
    return { status: "success", message: "collectionRenameSaved" };
  } catch (error) { return { status: "error", message: errorMessage(error, "collectionRenameGeneric") }; }
}

export async function deleteCollectionAction(formData: FormData): Promise<void | ActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return {status:"error",message:"operationFailed"};
  try {
  z.literal("on", { error: "collectionDeleteConfirmError" }).parse(formData.get("confirm"));
  await deleteCollection(context, id.data);
  } catch { return {status:"error",message:"operationFailed"}; }
  revalidatePath(inventoryPath(context,"/collections")); revalidatePath(inventoryPath(context,`/collections/${id.data}`)); revalidatePath(inventoryPath(context), "layout");
  redirect(inventoryPath(context,"/collections"));
}

export async function addCollectionMembershipAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  const itemId = z.string().uuid().safeParse(formData.get("itemId"));
  const collectionId = z.string().uuid().safeParse(formData.get("collectionId"));
  if (!itemId.success || !collectionId.success) return { status: "error", message: "chooseCollection" };
  try {
    await addItemToCollection(context, collectionId.data, itemId.data);
    revalidatePath(inventoryPath(context,`/items/${itemId.data}`)); revalidatePath(inventoryPath(context,"/collections"));
    return { status: "success", message: "collectionAdded" };
  } catch (error) { return { status: "error", message: errorMessage(error, "membershipAddGeneric") }; }
}

export async function removeCollectionMembershipAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  const itemId = z.string().uuid().safeParse(formData.get("itemId"));
  const collectionId = z.string().uuid().safeParse(formData.get("collectionId"));
  if (!itemId.success || !collectionId.success) return { status: "error", message: "membershipUnknown" };
  try { await removeItemFromCollection(context, collectionId.data, itemId.data); }
  catch (error) { return {status:"error",message:errorMessage(error,"operationFailed")}; }
  revalidatePath(inventoryPath(context,`/items/${itemId.data}`)); revalidatePath(inventoryPath(context,`/collections/${collectionId.data}`));
  return { status: "success", message: "collectionRemoved" };
}

export async function removeItem(formData: FormData): Promise<void | ActionFeedback> {
  const context = await resolveInventory(formData.get("inventoryId")).catch(() => null);
  if (!context) return { status: "error", message: "inventoryNotFound" };
  const id = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return {status:"error",message:"operationFailed"};
  try {
  z.literal("on", { error: "itemDeleteConfirmError" }).parse(formData.get("confirm"));
  await deleteItemWithMedia(context, id.data);
  } catch { return {status:"error",message:"operationFailed"}; }
  revalidatePath(inventoryPath(context), "layout");
  redirect(inventoryPath(context));
}
