"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createItem, photoFirstItemValues, saveStock, updateItem, type ItemFields } from "@/items/service";
import { createItemWithPhoto, deleteItemWithMedia, removePrimaryPhoto, replacePrimaryPhoto, MediaValidationError } from "@/media/service";
import { addItemToCollection, createCollection, deleteCollection, removeItemFromCollection, renameCollection } from "@/items/collections";

export type ActionFeedback = { status: "idle" | "success" | "error"; message: string };
export type PhotoActionFeedback = ActionFeedback & { mediaId?: string };

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;
  return /^[А-Яа-яЁё]/u.test(error.message) ? error.message : fallback;
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
  const uploaded = formData.get("photo");
  const file = uploaded instanceof File && uploaded.size > 0 ? uploaded : null;
  const values = photoFirstItemValues(formValues(formData) as ItemFields, file !== null);
  const name = values.name.trim();
  if (!name && !file) return { status: "error", message: "Добавьте фотографию или укажите название вещи." };
  let item: { id: string };
  try {
    item = file
      ? await createItemWithPhoto(values as ItemFields, file)
      : await createItem(values as ItemFields);
  } catch (error) {
    if (error instanceof MediaValidationError) return { status: "error", message: error.message };
    return { status: "error", message: file ? "Фотографию не удалось сохранить. Проверьте файл и попробуйте ещё раз." : errorMessage(error, "Проверьте название и сведения о вещи.") };
  }
  revalidatePath("/");
  redirect(`/items/${item.id}`);
}

export async function replacePhotoAction(_previous: PhotoActionFeedback, formData: FormData): Promise<PhotoActionFeedback> {
  const id = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return { status: "error", message: "Не удалось определить вещь для фотографии." };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Выберите фотографию для загрузки." };
  try {
    const saved = await replacePrimaryPhoto(id.data, file);
    revalidatePath("/"); revalidatePath(`/items/${id.data}`);
    return { status: "success", message: "Фото сохранено", mediaId: saved.id };
  } catch (error) {
    const message = error instanceof MediaValidationError ? error.message : errorMessage(error, "Не удалось сохранить фотографию. Попробуйте ещё раз.");
    return { status: "error", message };
  }
}

export async function removePhoto(formData: FormData) {
  const id = z.string().uuid().parse(String(formData.get("id") ?? ""));
  z.literal("on", { error: "Подтвердите удаление фотографии" }).parse(formData.get("confirm"));
  await removePrimaryPhoto(id);
  revalidatePath("/"); revalidatePath(`/items/${id}`);
  redirect(`/items/${id}`);
}

export async function updateItemAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const id = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return { status: "error", message: "Не удалось определить вещь." };
  try {
    await updateItem(id.data, formValues(formData) as ItemFields);
    revalidatePath("/"); revalidatePath(`/items/${id.data}`); revalidatePath("/collections");
    return { status: "success", message: "Изменения сохранены" };
  } catch (error) { return { status: "error", message: errorMessage(error, "Проверьте сведения и попробуйте ещё раз.") }; }
}

export async function updateStockAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const id = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) return { status: "error", message: "Не удалось определить вещь." };
  const locations = formData.getAll("location");
  const quantities = formData.getAll("quantity");
  const parsedLocations = z.array(z.string()).max(50).safeParse(locations);
  const parsedQuantities = z.array(z.string()).max(50).safeParse(quantities);
  if (!parsedLocations.success || !parsedQuantities.success || locations.length !== quantities.length || locations.length > 50) {
    return { status: "error", message: "Проверьте строки мест хранения." };
  }
  const rows = z.array(z.object({ location: z.string().max(120), quantity: z.string().regex(/^\d{1,7}$/, "Укажите целое неотрицательное количество.") })).max(50).safeParse(
    locations.map((location, index) => ({ location, quantity: quantities[index] })),
  );
  if (!rows.success) return { status: "error", message: rows.error.issues[0]?.message ?? "Проверьте количество и места хранения." };
  try {
    await saveStock(id.data, rows.data.map((row) => ({ location: row.location, quantity: Number(row.quantity) })));
    revalidatePath("/"); revalidatePath(`/items/${id.data}`);
    return { status: "success", message: "Запас сохранён" };
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Не удалось сохранить запас.") };
  }
}

export async function createCollectionAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  try {
    await createCollection({ name: formData.get("name") });
    revalidatePath("/collections");
    return { status: "success", message: "Коллекция создана" };
  } catch (error) { return { status: "error", message: errorMessage(error, "Не удалось создать коллекцию.") }; }
}

export async function renameCollectionAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "Не удалось определить коллекцию." };
  try {
    await renameCollection(id.data, { name: formData.get("name") });
    revalidatePath("/collections"); revalidatePath(`/collections/${id.data}`);
    return { status: "success", message: "Название сохранено" };
  } catch (error) { return { status: "error", message: errorMessage(error, "Не удалось изменить название.") }; }
}

export async function deleteCollectionAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const confirmed = z.literal("on").safeParse(formData.get("confirm"));
  if (!id.success || !confirmed.success) return { status: "error", message: "Подтвердите удаление коллекции." };
  await deleteCollection(id.data);
  revalidatePath("/collections"); revalidatePath(`/collections/${id.data}`); revalidatePath("/");
  redirect("/collections");
}

export async function addCollectionMembershipAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const itemId = z.string().uuid().safeParse(formData.get("itemId"));
  const collectionId = z.string().uuid().safeParse(formData.get("collectionId"));
  if (!itemId.success || !collectionId.success) return { status: "error", message: "Выберите коллекцию." };
  try {
    await addItemToCollection(collectionId.data, itemId.data);
    revalidatePath(`/items/${itemId.data}`); revalidatePath("/collections");
    return { status: "success", message: "Добавлено в коллекцию" };
  } catch (error) { return { status: "error", message: errorMessage(error, "Не удалось добавить вещь.") }; }
}

export async function removeCollectionMembershipAction(_previous: ActionFeedback, formData: FormData): Promise<ActionFeedback> {
  const itemId = z.string().uuid().safeParse(formData.get("itemId"));
  const collectionId = z.string().uuid().safeParse(formData.get("collectionId"));
  if (!itemId.success || !collectionId.success) return { status: "error", message: "Не удалось определить связь." };
  await removeItemFromCollection(collectionId.data, itemId.data);
  revalidatePath(`/items/${itemId.data}`); revalidatePath(`/collections/${collectionId.data}`);
  return { status: "success", message: "Убрано из коллекции" };
}

export async function removeItem(formData: FormData) {
  const id = z.string().uuid().parse(String(formData.get("id") ?? ""));
  z.literal("on", { error: "Подтвердите удаление вещи" }).parse(formData.get("confirm"));
  await deleteItemWithMedia(id);
  revalidatePath("/");
  redirect("/");
}
