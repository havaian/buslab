import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { UserRole } from "../../common/enums/user-role.enum";

export type AdminUserDocument = AdminUser & Document;

@Schema({ timestamps: true })
export class AdminUser {
  @Prop({ required: true, unique: true })
  telegramId: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ default: "" })
  lastName: string;

  @Prop({ default: "" })
  username: string;

  @Prop({ required: true, enum: UserRole })
  role: UserRole;

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({ default: "" })
  photoUrl: string;
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);
