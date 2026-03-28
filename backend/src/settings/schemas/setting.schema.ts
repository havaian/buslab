import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type SettingDocument = Setting & Document;

@Schema({ timestamps: true, collection: "settings" })
export class Setting {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ type: Object, default: {} })
  value: Record<string, string>;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);