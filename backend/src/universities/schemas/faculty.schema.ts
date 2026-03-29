import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type FacultyDocument = Faculty & Document;

@Schema({ timestamps: true, collection: "faculties" })
export class Faculty {
  @Prop({ required: true, type: Types.ObjectId, ref: "University" })
  universityId: Types.ObjectId;

  @Prop({ required: true })
  code: string;

  @Prop({ type: Object, required: true })
  names: { ru: string; uz: string; en: string };

  @Prop({ default: true })
  active: boolean;
}

export const FacultySchema = SchemaFactory.createForClass(Faculty);
FacultySchema.index({ universityId: 1 });
FacultySchema.index({ code: 1 });
