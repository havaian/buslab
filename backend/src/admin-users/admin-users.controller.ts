import { Controller, Get, Patch, Param, UseGuards } from "@nestjs/common";
import { AdminUsersService } from "./admin-users.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin-users")
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Roles(UserRole.ADMIN)
  @Get("students")
  async findStudents() {
    const students = await this.adminUsersService.findStudents();
    // Normalize _id -> id so frontend PanelUser.id is always populated
    return students.map((s: any) => ({ ...s, id: String(s._id) }));
  }

  @Roles(UserRole.ADMIN)
  @Get("students/free")
  async findFreeStudents() {
    const students = await this.adminUsersService.findFreeStudents();
    return students.map((s: any) => ({ ...s, id: String(s._id) }));
  }

  @Roles(UserRole.ADMIN)
  @Get("students/:id/stats")
  getStudentStats(@Param("id") id: string) {
    return this.adminUsersService.getStudentStats(id);
  }

  @Roles(UserRole.ADMIN)
  @Get("students/:id/logs")
  getStudentLogs(@Param("id") id: string) {
    return this.adminUsersService.getStudentLogs(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(":id/block")
  block(@Param("id") id: string) {
    return this.adminUsersService.block(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(":id/unblock")
  unblock(@Param("id") id: string) {
    return this.adminUsersService.unblock(id);
  }
}
