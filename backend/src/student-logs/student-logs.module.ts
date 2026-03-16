import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { StudentLog, StudentLogSchema } from "./schemas/student-log.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StudentLog.name, schema: StudentLogSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class StudentLogsModule {}
