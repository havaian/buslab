import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { StatsController } from "./stats.controller";
import { StatsService } from "./stats.service";
import { Request, RequestSchema } from "../requests/schemas/request.schema";
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
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
