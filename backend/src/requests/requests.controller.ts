import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { v4 as uuidv4 } from "uuid";
import { RequestsService } from "./requests.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UserRole } from "../common/enums/user-role.enum";

const uploadStorage = diskStorage({
  destination: join(process.cwd(), "uploads"),
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${extname(file.originalname)}`);
  },
});

@UseGuards(JwtAuthGuard)
@Controller("requests")
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  // ── Shared ───────────────────────────────────────────────────────────────

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.requestsService.findById(id);
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(
    @Query("status") status?: string,
    @Query("categoryId") categoryId?: string,
    @Query("search") search?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.requestsService.findAll({
      status,
      categoryId,
      search,
      dateFrom,
      dateTo,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id/approve")
  approve(@Param("id") id: string) {
    return this.requestsService.approve(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id/reject")
  reject(@Param("id") id: string, @Body("reason") reason: string) {
    return this.requestsService.reject(id, reason);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id/assign")
  assignStudent(@Param("id") id: string, @Body("studentId") studentId: string) {
    return this.requestsService.assignStudent(id, studentId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id/unassign")
  unassign(@Param("id") id: string) {
    return this.requestsService.unassign(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id/return-to-queue")
  returnToQueue(@Param("id") id: string) {
    return this.requestsService.returnToQueue(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id/approve-answer")
  approveAnswer(
    @Param("id") id: string,
    @Body("finalAnswer") finalAnswer?: string
  ) {
    return this.requestsService.approveAnswer(id, finalAnswer);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id/reject-answer")
  rejectAnswer(@Param("id") id: string, @Body("comment") comment: string) {
    return this.requestsService.rejectAnswer(id, comment);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(":id/message")
  sendMessage(@Param("id") id: string, @Body("text") text: string) {
    return this.requestsService.sendDirectMessage(id, text);
  }

  // ── Student ──────────────────────────────────────────────────────────────

  // NOTE: static sub-routes MUST come before :id to avoid Express treating
  // "student" as a request id
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  @Get("student/available")
  findAvailable() {
    return this.requestsService.findAvailable();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  @Get("student/history")
  findStudentHistory(@CurrentUser() user: any) {
    return this.requestsService.findStudentHistory(user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  @Patch(":id/take")
  takeRequest(@Param("id") id: string, @CurrentUser() user: any) {
    return this.requestsService.takeRequest(id, user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  @UseInterceptors(FilesInterceptor("files", 10, { storage: uploadStorage }))
  @Patch(":id/submit-answer")
  submitAnswer(
    @Param("id") id: string,
    @CurrentUser() user: any,
    @Body("answer") answer: string,
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    return this.requestsService.submitAnswer(id, user.sub, answer, files);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  @Patch(":id/decline")
  declineRequest(@Param("id") id: string, @CurrentUser() user: any) {
    return this.requestsService.declineRequest(id, user.sub);
  }
}
