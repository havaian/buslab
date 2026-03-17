import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type FaqDocument = Faq & Document;

// Matches existing bot's FAQ model — collection name is 'faqs'
@Schema({ timestamps: true, collection: "faqs" })
export class Faq {
  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ required: true, type: Types.ObjectId, ref: "Category" })
  categoryId: Types.ObjectId;
}

export const FaqSchema = SchemaFactory.createForClass(Faq);
FaqSchema.index({ categoryId: 1 });
