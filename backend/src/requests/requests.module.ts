import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";
import { Request, RequestSchema } from "./schemas/request.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import {
  StudentLog,
  StudentLogSchema,
} from "../student-logs/schemas/student-log.schema";
import {
  RequestHistory,
  RequestHistorySchema,
} from "./schemas/request-history.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Request.name, schema: RequestSchema },
      { name: User.name, schema: UserSchema },
      { name: StudentLog.name, schema: StudentLogSchema },
      { name: RequestHistory.name, schema: RequestHistorySchema },
    ]),
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService, MongooseModule],
})
export class RequestsModule {}
