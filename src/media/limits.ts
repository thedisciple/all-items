// Intake policy only: persisted and imported galleries may exceed this count.
export const NEW_ITEM_PHOTO_LIMIT = 10;
export const MAX_CREATION_PHOTO_BYTES = 64 * 1024 * 1024;
export class PhotoLimitError extends Error {}
