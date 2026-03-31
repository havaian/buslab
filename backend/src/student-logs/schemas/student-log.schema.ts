import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { StudentAction } from "../../common/enums/student-action.enum";

export type StudentLogDocument = StudentLog & Document;

@Schema({ timestamps: true })
export class StudentLog {
  @Prop({ required: true, type: Types.ObjectId, ref: "AdminUser" })
  studentId: Types.ObjectId;

  @Prop({ required: true, enum: StudentAction })
  action: StudentAction;

  @Prop({ required: true, type: Types.ObjectId, ref: "Request" })
  requestId: Types.ObjectId;

  // Contextual info: rejection comment, admin comment, etc.
  @Prop({ default: "" })
  details: string;

  // Time from TOOK_REQUEST to SUBMITTED_ANSWER in minutes (set on submit)
  @Prop({ default: null })
  timeSpentMinutes: number;
}

export const StudentLogSchema = SchemaFactory.createForClass(StudentLog);
StudentLogSchema.index({ studentId: 1 });
StudentLogSchema.index({ requestId: 1 });
StudentLogSchema.index({ createdAt: -1 });
StudentLogSchema.index({ studentId: 1, action: 1 });
