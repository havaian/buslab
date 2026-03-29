import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type UniversityDocument = University & Document;

@Schema({ timestamps: true, collection: "universities" })
export class University {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ type: Object, required: true })
  names: { ru: string; uz: string; en: string };

  // Available course years for this university
  @Prop({ type: [Number], default: [1, 2, 3, 4] })
  courses: number[];

  @Prop({ default: true })
  active: boolean;
}

export const UniversitySchema = SchemaFactory.createForClass(University);
