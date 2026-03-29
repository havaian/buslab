import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type RequestDocument = Request & Document;

const FileSubSchema = {
  filename: String,
  originalName: String,
  mimetype: String,
  size: Number,
  ref: String,
  source: { type: String, default: "web" },
};

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

  @Prop({ default: null, type: Number })
  adminChatMessageId: number | null;

  @Prop({ default: null, type: Number })
  adminAnswerMessageId: number | null;

  // Extended fields for web panel
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

  // Files attached by citizen when submitting the request
  @Prop({ type: [FileSubSchema], default: [] })
  requestFiles: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    ref: string;
    source: string;
  }[];

  // Files attached by student in their answer
  @Prop({ type: [FileSubSchema], default: [] })
  answerFiles: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    ref: string;
    source: string;
  }[];
}

export const RequestSchema = SchemaFactory.createForClass(Request);

RequestSchema.index({ status: 1 });
RequestSchema.index({ userId: 1 });
RequestSchema.index({ studentId: 1 });
RequestSchema.index({ categoryId: 1 });
RequestSchema.index({ createdAt: -1 });
