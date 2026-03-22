import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminUsersService } from "./admin-users.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UserRole } from "../common/enums/user-role.enum";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin-users")
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  // ── Student self-access ───────────────────────────────────────────────────

  /** Students call this to get their own stats — no admin role required. */
  @Roles(UserRole.STUDENT)
  @Get("my-stats")
  getMyStats(@CurrentUser() user: any) {
    return this.adminUsersService.getStudentStats(user.sub);
  }

  @Roles(UserRole.STUDENT)
  @Get("my-logs")
  getMyLogs(@CurrentUser() user: any) {
    return this.adminUsersService.getStudentLogs(user.sub);
  }

  // ── Students list ─────────────────────────────────────────────────────────

  @Roles(UserRole.ADMIN)
  @Get("students")
  async findStudents() {
    const students = await this.adminUsersService.findStudents();
    return students.map((s: any) => ({ ...s, id: String(s._id) }));
  }

  // NOTE: static sub-routes must come BEFORE :id
  @Roles(UserRole.ADMIN)
  @Get("students/free")
  async findFreeStudents() {
    const students = await this.adminUsersService.findFreeStudents();
    return students.map((s: any) => ({ ...s, id: String(s._id) }));
  }

  @Roles(UserRole.ADMIN)
  @Get("students/:id")
  async findStudentById(
    @Param("id") id: string
  ): Promise<Record<string, unknown>> {
    const student = await this.adminUsersService.findById(id);
    return { ...student, id: String((student as any)._id) };
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

  // ── Block / unblock ───────────────────────────────────────────────────────

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

  // ── Invite ────────────────────────────────────────────────────────────────

  /** Generate a one-time invite link. Returns { token, expiresAt, link }. */
  @Roles(UserRole.ADMIN)
  @Post("invite")
  createInvite(@CurrentUser() admin: any) {
    return this.adminUsersService.createInvite(admin.sub);
  }

  // ── User search & promote ─────────────────────────────────────────────────

  /** Search existing users (role != admin) by username or Telegram ID. */
  @Roles(UserRole.ADMIN)
  @Get("users/search")
  searchUsers(@Query("q") q: string) {
    return this.adminUsersService.searchUsers(q ?? "");
  }

  /** Promote an existing user to student. */
  @Roles(UserRole.ADMIN)
  @Patch(":id/promote")
  promoteToStudent(@Param("id") id: string) {
    return this.adminUsersService.promoteToStudent(id);
  }

  /** Demote a student back to regular user. */
  @Roles(UserRole.ADMIN)
  @Patch(":id/demote")
  demoteFromStudent(@Param("id") id: string) {
    return this.adminUsersService.demoteFromStudent(id);
  }
}
