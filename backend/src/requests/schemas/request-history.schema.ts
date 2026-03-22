import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type RequestHistoryDocument = RequestHistory & Document;

export enum RequestHistoryAction {
  REQUEST_SUBMITTED = "request_submitted", // citizen submitted
  REQUEST_APPROVED = "request_approved", // admin approved
  REQUEST_REJECTED = "request_rejected", // admin rejected
  STUDENT_TOOK = "student_took", // student took from queue
  STUDENT_ASSIGNED = "student_assigned", // admin assigned directly
  STUDENT_UNASSIGNED = "student_unassigned", // admin unassigned
  STUDENT_DECLINED = "student_declined", // student declined
  RETURNED_TO_QUEUE = "returned_to_queue", // returned to queue (any reason)
  ANSWER_SUBMITTED = "answer_submitted", // student submitted answer
  ANSWER_APPROVED = "answer_approved", // admin approved answer
  ANSWER_REJECTED = "answer_rejected", // admin rejected answer
  TIMER_EXPIRED = "timer_expired", // deadline exceeded
}

@Schema({ timestamps: true, collection: "request_history" })
export class RequestHistory {
  @Prop({ required: true, type: Types.ObjectId, ref: "Request" })
  requestId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(RequestHistoryAction) })
  action: string;

  /** Who performed the action. Null = system (scheduler etc.). */
  @Prop({ type: Types.ObjectId, ref: "User", default: null })
  performedBy: Types.ObjectId | null;

  @Prop({ enum: ["admin", "student", "citizen", "system"], default: "system" })
  performedByRole: string;

  /** Status the request had BEFORE this event. */
  @Prop({ default: null })
  statusFrom: string | null;

  /** Status the request has AFTER this event. */
  @Prop({ default: null })
  statusTo: string | null;

  /** Snapshot of the answer text at this moment (for answer_submitted / approved). */
  @Prop({ default: null })
  answerText: string | null;

  /** Snapshot of answer files at this moment. */
  @Prop({
    type: [
      {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        ref: String,
        source: { type: String, default: "web" },
      },
    ],
    default: [],
  })
  answerFiles: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    ref: string;
    source: string;
  }[];

  /** Decline reason, admin comment, or any other free-form note. */
  @Prop({ default: null })
  comment: string | null;
}

export const RequestHistorySchema =
  SchemaFactory.createForClass(RequestHistory);

RequestHistorySchema.index({ requestId: 1, createdAt: 1 });
