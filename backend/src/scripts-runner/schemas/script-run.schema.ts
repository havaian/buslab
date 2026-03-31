import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type ScriptRunDocument = ScriptRun & Document;

@Schema({ timestamps: true, collection: "scriptruns" })
export class ScriptRun {
  @Prop({ required: true })
  script: string; // идентификатор скрипта, напр. "parse-poll"

  @Prop({ enum: ["running", "success", "error"], default: "running" })
  status: string;

  @Prop({ default: "" })
  output: string; // stdout + stderr накопленные

  @Prop({ default: null })
  exitCode: number | null;

  @Prop({ default: null })
  finishedAt: Date | null;
}

export const ScriptRunSchema = SchemaFactory.createForClass(ScriptRun);
