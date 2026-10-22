"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createItem, photoFirstItemValues, saveStock, updateItem, type ItemFields } from "@/items/service";
import { createItemWithPhoto, deleteItemWithMedia, removePrimaryPhoto, replacePrimaryPhoto } from "@/media/service";

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

export async function addItem(formData: FormData) {
  const uploaded = formData.get("photo");
  const file = uploaded instanceof File && uploaded.size > 0 ? uploaded : null;
  const values = photoFirstItemValues(formValues(formData) as ItemFields, file !== null);
  const name = values.name.trim();
  if (!name && !file) redirect("/?error=photo-or-name");
  let item: { id: string };
  try {
    item = file
      ? await createItemWithPhoto(values as ItemFields, file)
      : await createItem(values as ItemFields);
  } catch {
    redirect(file ? "/?error=photo" : "/?error=validation");
  }
  revalidatePath("/");
  redirect(`/items/${item.id}`);
}

export async function replacePhoto(formData: FormData) {
  const id = z.string().uuid().parse(String(formData.get("id") ?? ""));
  const file = formData.get("photo");
  let failed = false;
  if (!(file instanceof File) || file.size === 0) failed = true;
  else {
    try { await replacePrimaryPhoto(id, file); }
    catch { failed = true; }
  }
  revalidatePath("/"); revalidatePath(`/items/${id}`);
  redirect(`/items/${id}${failed ? "?error=photo" : ""}`);
}

export async function removePhoto(formData: FormData) {
  const id = z.string().uuid().parse(String(formData.get("id") ?? ""));
  z.literal("on", { error: "Подтвердите удаление фотографии" }).parse(formData.get("confirm"));
  await removePrimaryPhoto(id);
  revalidatePath("/"); revalidatePath(`/items/${id}`);
  redirect(`/items/${id}`);
}

export async function editItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await updateItem(id, formValues(formData) as ItemFields);
  revalidatePath("/"); revalidatePath(`/items/${id}`);
  redirect(`/items/${id}`);
}

export async function updateStock(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const lines = String(formData.get("stock") ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  const entries = lines.map((line) => {
    const [location, quantity, ...extra] = line.split("|");
    if (extra.length || quantity === undefined || !/^\d+$/.test(quantity.trim())) throw new Error("Формат строки: место хранения | количество");
    return { location: location?.trim() ?? "", quantity: Number(quantity.trim()) };
  });
  await saveStock(id, entries);
  revalidatePath("/"); revalidatePath(`/items/${id}`);
  redirect(`/items/${id}`);
}

export async function removeItem(formData: FormData) {
  const id = z.string().uuid().parse(String(formData.get("id") ?? ""));
  z.literal("on", { error: "Подтвердите удаление вещи" }).parse(formData.get("confirm"));
  await deleteItemWithMedia(id);
  revalidatePath("/");
  redirect("/");
}
