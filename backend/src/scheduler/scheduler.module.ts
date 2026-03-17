import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SchedulerService } from "./scheduler.service";
import { Request, RequestSchema } from "../requests/schemas/request.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import {
  StudentLog,
  StudentLogSchema,
} from "../student-logs/schemas/student-log.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Request.name, schema: RequestSchema },
      { name: User.name, schema: UserSchema },
      { name: StudentLog.name, schema: StudentLogSchema },
    ]),
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
