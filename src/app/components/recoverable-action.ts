"use client";

// Transport failure must return to the mounted editor with its actual Files/fields.
export function recoverableAction<T>(action: (previous: T, data: FormData) => Promise<T>, failure: T) {
  return async (previous: T, data: FormData): Promise<T> => {
    try { return await action(previous, data); }
    catch { return failure; }
  };
}
