import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type FaqDocument = Faq & Document;

@Schema({ timestamps: true, collection: "faqs" })
export class Faq {
  // Legacy fields — kept as Russian defaults
  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ required: true, type: Types.ObjectId, ref: "Category" })
  categoryId: Types.ObjectId;

  // Localized translations — ru falls back to question/answer if empty
  @Prop({
    type: {
      ru: { question: String, answer: String },
      uz: { question: String, answer: String },
      en: { question: String, answer: String },
    },
    default: {
      ru: { question: "", answer: "" },
      uz: { question: "", answer: "" },
      en: { question: "", answer: "" },
    },
  })
  translations: {
    ru: { question: string; answer: string };
    uz: { question: string; answer: string };
    en: { question: string; answer: string };
  };
}

export const FaqSchema = SchemaFactory.createForClass(Faq);
FaqSchema.index({ categoryId: 1 });
