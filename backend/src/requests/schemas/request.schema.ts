import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { RequestStatus } from "../../common/enums/request-status.enum";

// Unified file attachment structure for both bot-uploaded and web-uploaded files
export interface AttachedFile {
  filename: string; // stored filename (uuid-based for web uploads)
  originalName: string;
  mimetype: string;
  size: number;
  // For bot uploads: telegram file_id; for web uploads: relative path under /uploads
  ref: string;
  source: "telegram" | "web";
}

export type RequestDocument = Request & Document;

@Schema({ timestamps: true })
export class Request {
  // Citizen info (denormalized for quick display without join)
  @Prop({ required: true })
  telegramUserId: string;

  @Prop({ required: true })
  userFirstName: string;

  @Prop({ default: "" })
  userLastName: string;

  @Prop({ default: "" })
  userUsername: string;

  @Prop({ default: "uz" })
  userLanguage: string;

  @Prop({ required: true, type: Types.ObjectId, ref: "Category" })
  categoryId: Types.ObjectId;

  @Prop({ required: true })
  text: string;

  // Files attached by citizen via bot
  @Prop({ type: Array, default: [] })
  files: AttachedFile[];

  @Prop({ enum: RequestStatus, default: RequestStatus.PENDING })
  status: RequestStatus;

  // Admin rejection reason
  @Prop({ default: "" })
  declineReason: string;

  // Assigned student (AdminUser)
  @Prop({ type: Types.ObjectId, ref: "AdminUser", default: null })
  studentId: Types.ObjectId;

  // Student's original submitted answer
  @Prop({ default: "" })
  studentAnswer: string;

  @Prop({ type: Array, default: [] })
  studentAnswerFiles: AttachedFile[];

  // Final answer (may be edited by admin before closing)
  @Prop({ default: "" })
  finalAnswer: string;

  @Prop({ type: Array, default: [] })
  finalAnswerFiles: AttachedFile[];

  // Admin's comment when returning answer back to student for revision
  @Prop({ default: "" })
  adminComment: string;

  // Timer fields
  @Prop({ default: null })
  timerStart: Date;

  @Prop({ default: null })
  timerDeadline: Date;

  // Prevents sending the 2h warning more than once
  @Prop({ default: false })
  timerWarningSent: boolean;

  // Prevents sending the expired notification more than once
  @Prop({ default: false })
  timerExpiredNotified: boolean;
}

export const RequestSchema = SchemaFactory.createForClass(Request);

// Index for frequent queries
RequestSchema.index({ status: 1 });
RequestSchema.index({ telegramUserId: 1 });
RequestSchema.index({ studentId: 1 });
RequestSchema.index({ categoryId: 1 });
RequestSchema.index({ createdAt: -1 });
