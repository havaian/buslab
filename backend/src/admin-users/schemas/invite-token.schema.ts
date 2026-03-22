import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type InviteTokenDocument = InviteToken & Document;

@Schema({ timestamps: true, collection: "invite_tokens" })
export class InviteToken {
  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", default: null })
  usedBy: Types.ObjectId | null;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: null })
  usedAt: Date | null;
}

export const InviteTokenSchema = SchemaFactory.createForClass(InviteToken);
InviteTokenSchema.index({ token: 1 });
InviteTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
