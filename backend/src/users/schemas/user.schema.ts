import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  telegramId: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ default: "" })
  lastName: string;

  @Prop({ default: "" })
  username: string;

  // Default language is uz per TZ
  @Prop({ default: "uz", enum: ["ru", "uz", "en"] })
  language: string;

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({ default: "" })
  photoUrl: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
