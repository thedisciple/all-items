"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createItem, deleteItem, saveStock, updateItem, type ItemFields } from "@/items/service";

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
  const item = await createItem(formValues(formData) as ItemFields);
  revalidatePath("/");
  redirect(`/items/${item.id}`);
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
  await deleteItem(id);
  revalidatePath("/");
  redirect("/");
}
