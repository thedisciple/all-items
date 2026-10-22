import { z } from "zod";

const maxImageSide = 12_000;

export const cropDataSchema = z.object({
  x: z.number().finite().min(-maxImageSide).max(maxImageSide),
  y: z.number().finite().min(-maxImageSide).max(maxImageSide),
  width: z.number().finite().positive().max(maxImageSide),
  height: z.number().finite().positive().max(maxImageSide),
  rotate: z.number().finite().min(-3600).max(3600),
  scaleX: z.number().finite().min(-4).max(4),
  scaleY: z.number().finite().min(-4).max(4),
}).strict();

export type CropData = z.infer<typeof cropDataSchema>;
