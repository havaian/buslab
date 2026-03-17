import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type RequestDocument = Request & Document;

// Matches existing bot's Request model
@Schema({ timestamps: true, collection: "requests" })
export class Request {
  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: "Category" })
  categoryId: Types.ObjectId;

  @Prop({ required: true, minlength: 150, maxlength: 3500 })
  text: string;

  @Prop({
    enum: ["pending", "approved", "declined", "assigned", "answered", "closed"],
    default: "pending",
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: "User", default: null })
  studentId: Types.ObjectId | null;

  @Prop({ default: null })
  assignedAt: Date | null;

  @Prop({ default: null })
  answerText: string | null;

  @Prop({ default: null })
  adminComment: string | null;

  @Prop({ default: null, type: Number })
  studentChatMessageId: number | null;

  // Extended fields for web panel (not in bot schema, added by panel)
  @Prop({ default: null })
  declineReason: string | null;

  @Prop({ default: null })
  finalAnswerText: string | null;

  @Prop({ default: null })
  timerDeadline: Date | null;

  @Prop({ default: false })
  timerWarningSent: boolean;

  @Prop({ default: false })
  timerExpiredNotified: boolean;
}

export const RequestSchema = SchemaFactory.createForClass(Request);

RequestSchema.index({ status: 1 });
RequestSchema.index({ userId: 1 });
RequestSchema.index({ studentId: 1 });
RequestSchema.index({ categoryId: 1 });
RequestSchema.index({ createdAt: -1 });
