import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type CategoryDocument = Category & Document;

// Matches existing bot's Category model
@Schema({ timestamps: true, collection: "categories" })
export class Category {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, unique: true })
  hashtag: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
