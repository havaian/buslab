import { Controller, Post, Get, Param, UseGuards } from "@nestjs/common";
import { ScriptsRunnerService } from "./scripts-runner.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("scripts")
export class ScriptsRunnerController {
  constructor(private readonly service: ScriptsRunnerService) {}

  /** Запустить скрипт парсинга опросов. Возвращает runId для поллинга статуса. */
  @Post("parse-poll/run")
  runParsePoll() {
    return this.service.runParsePoll();
  }

  /** Список последних 20 запусков */
  @Get("parse-poll/logs")
  getLogs() {
    return this.service.getLogs("parse-poll");
  }

  /** Статус и вывод конкретного запуска (для поллинга пока выполняется) */
  @Get("runs/:id")
  getRun(@Param("id") id: string) {
    return this.service.getRunById(id);
  }
}
