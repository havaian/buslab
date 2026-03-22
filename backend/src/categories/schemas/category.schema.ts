import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true, collection: "categories" })
export class Category {
  // Legacy field — kept for backward compat and bot category matching
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, unique: true })
  hashtag: string;

  // Localized names — ru is required, uz/en fall back to name if empty
  @Prop({
    type: { ru: String, uz: String, en: String },
    default: { ru: "", uz: "", en: "" },
  })
  names: { ru: string; uz: string; en: string };
}

export const CategorySchema = SchemaFactory.createForClass(Category);
