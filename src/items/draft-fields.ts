import {z} from "zod";

// Raw editable text is shared by browser drafts and creation commands.
export const draftFieldsSchema=z.object({
  name:z.string().max(160),model:z.string().max(160),brand:z.string().max(120),
  categories:z.array(z.string().max(80)).max(20),trackingMode:z.enum(["unique","bulk","consumable"]),
  originalMarking:z.string().max(160),description:z.string().max(4000),notes:z.string().max(2000),
  identificationStatus:z.enum(["unknown","user_confirmed","source_verified"]),
  saleIntent:z.enum(["not_for_sale","considering","willing_to_sell"]),
  askingPrice:z.string().max(40),askingCurrency:z.string().max(80),
});
