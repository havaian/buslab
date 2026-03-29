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
import { University, UniversitySchema } from "../universities/schemas/university.schema";
import { Faculty, FacultySchema } from "../universities/schemas/faculty.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Request.name, schema: RequestSchema },
      { name: AdminUser.name, schema: AdminUserSchema },
      { name: StudentLog.name, schema: StudentLogSchema },
      { name: University.name, schema: UniversitySchema },
      { name: Faculty.name, schema: FacultySchema },
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
