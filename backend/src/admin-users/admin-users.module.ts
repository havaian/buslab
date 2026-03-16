import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminUser, AdminUserSchema } from "./schemas/admin-user.schema";
import {
  StudentLog,
  StudentLogSchema,
} from "../student-logs/schemas/student-log.schema";
import { Request, RequestSchema } from "../requests/schemas/request.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminUser.name, schema: AdminUserSchema },
      { name: StudentLog.name, schema: StudentLogSchema },
      { name: Request.name, schema: RequestSchema },
    ]),
  ],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService, MongooseModule],
})
export class AdminUsersModule {}
