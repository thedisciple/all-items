"use server";

import { revalidatePath } from "next/cache";
import { createItem } from "@/items/service";

export async function addItem(formData: FormData) {
  const name = formData.get("name");
  const model = formData.get("model");
  if (typeof name !== "string" || (model !== null && typeof model !== "string")) {
    throw new Error("Некорректные данные формы");
  }
  await createItem({ name, model: model ?? "" });
  revalidatePath("/");
}
