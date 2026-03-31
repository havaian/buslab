import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ScriptsRunnerController } from "./scripts-runner.controller";
import { ScriptsRunnerService } from "./scripts-runner.service";
import { ScriptRun, ScriptRunSchema } from "./schemas/script-run.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScriptRun.name, schema: ScriptRunSchema },
    ]),
  ],
  controllers: [ScriptsRunnerController],
  providers: [ScriptsRunnerService],
})
export class ScriptsRunnerModule {}
