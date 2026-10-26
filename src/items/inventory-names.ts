/** Names remain user text; normalization is only for duplicate detection. */
export function normalizedInventoryName(name:string) {
  return name.trim().normalize("NFKC").toLocaleLowerCase("ru-RU");
}

export function suggestInventoryName(name:string,existing:readonly string[]) {
  const base=name.trim().slice(0,120) || "Inventory";
  const used=new Set(existing.map(normalizedInventoryName));
  if(!used.has(normalizedInventoryName(base)))return base;
  for(let number=2;number<=100_000;number++) {
    const suffix=` (${number})`;
    const prefix=base.slice(0,120-suffix.length).replace(/[\uD800-\uDBFF]$/,"").trimEnd();
    const candidate=prefix+suffix;
    if(!used.has(normalizedInventoryName(candidate)))return candidate;
  }
  throw new Error("Unable to suggest a unique inventory name");
}
