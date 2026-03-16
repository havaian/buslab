import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";
import { Request, RequestSchema } from "./schemas/request.schema";
import {
  AdminUser,
  AdminUserSchema,
} from "../admin-users/schemas/admin-user.schema";
import {
  StudentLog,
  StudentLogSchema,
} from "../student-logs/schemas/student-log.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Request.name, schema: RequestSchema },
      { name: AdminUser.name, schema: AdminUserSchema },
      { name: StudentLog.name, schema: StudentLogSchema },
    ]),
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService, MongooseModule],
})
export class RequestsModule {}
