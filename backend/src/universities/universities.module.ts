import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UniversitiesController } from "./universities.controller";
import { UniversitiesService } from "./universities.service";
import { University, UniversitySchema } from "./schemas/university.schema";
import { Faculty, FacultySchema } from "./schemas/faculty.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: University.name, schema: UniversitySchema },
      { name: Faculty.name, schema: FacultySchema },
    ]),
  ],
  controllers: [UniversitiesController],
  providers: [UniversitiesService],
  exports: [UniversitiesService, MongooseModule],
})
export class UniversitiesModule {}
