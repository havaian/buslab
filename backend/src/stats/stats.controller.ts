import { Controller, Get, UseGuards } from "@nestjs/common";
import { StatsService } from "./stats.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("stats")
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get("dashboard")
  getDashboard() {
    return this.statsService.getDashboard();
  }

  @Get("students")
  getStudentsSummary() {
    return this.statsService.getStudentsSummary();
  }
}
