import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type UserDocument = User & Document;

// Single collection for all roles - matches existing bot's User model
@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, unique: true, type: Number })
  telegramId: number;

  @Prop({ enum: ["user", "student", "admin"], default: "user" })
  role: string;

  @Prop({ default: "" })
  firstName: string;

  @Prop({ default: "" })
  lastName: string;

  @Prop({ default: "" })
  username: string;

  @Prop({ enum: ["ru", "uz", "en", "kk"], default: "ru" })
  language: string;

  @Prop({ default: false })
  isBanned: boolean;

  @Prop({ default: false })
  offerAccepted: boolean;

  @Prop({ type: Types.ObjectId, ref: "Request", default: null })
  currentAssignmentId: Types.ObjectId | null;

  // Source tracking - last seen source
  @Prop({ enum: ["miniapp", "panel", "bot"], default: null })
  lastSeenSource: string | null;

  // Whether user has ever logged in via miniapp
  @Prop({ default: false })
  hasUsedMiniapp: boolean;

  // Whether user has ever logged in via web panel
  @Prop({ default: false })
  hasUsedPanel: boolean;

  @Prop({ default: null })
  university: string | null;

  @Prop({ default: null })
  faculty: string | null;

  @Prop({ default: null, type: Number })
  course: number | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
