import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Request, RequestDocument } from "./schemas/request.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  StudentLog,
  StudentLogDocument,
} from "../student-logs/schemas/student-log.schema";
import {
  RequestHistory,
  RequestHistoryDocument,
  RequestHistoryAction,
} from "./schemas/request-history.schema";
import { StudentAction } from "../common/enums/student-action.enum";
import { NotificationsService } from "../notifications/notifications.service";
import { SettingsService } from "../settings/settings.service";

const TIMER_DURATION_MS = 12 * 60 * 60 * 1000; // 12 часов

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(StudentLog.name)
    private studentLogModel: Model<StudentLogDocument>,
    @InjectModel(RequestHistory.name)
    private historyModel: Model<RequestHistoryDocument>,
    private readonly notifications: NotificationsService,
    private readonly settingsService: SettingsService
  ) {}

  // ── Private helper ────────────────────────────────────────────────────────

  private async log(entry: {
    requestId: Types.ObjectId | string;
    action: RequestHistoryAction;
    performedBy?: Types.ObjectId | string | null;
    performedByRole?: "admin" | "student" | "citizen" | "system";
    statusFrom?: string | null;
    statusTo?: string | null;
    answerText?: string | null;
    answerFiles?: any[];
    comment?: string | null;
  }) {
    await this.historyModel.create({
      requestId: new Types.ObjectId(String(entry.requestId)),
      action: entry.action,
      performedBy: entry.performedBy
        ? new Types.ObjectId(String(entry.performedBy))
        : null,
      performedByRole: entry.performedByRole ?? "system",
      statusFrom: entry.statusFrom ?? null,
      statusTo: entry.statusTo ?? null,
      answerText: entry.answerText ?? null,
      answerFiles: entry.answerFiles ?? [],
      comment: entry.comment ?? null,
    });
  }

  // ── LIST ──────────────────────────────────────────────────────────────────

  async findAll(filters: {
    status?: string;
    categoryId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      status,
      categoryId,
      search,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters;
    const query: any = {};

    if (status) query.status = status;
    if (categoryId) query.categoryId = new Types.ObjectId(categoryId);
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    if (search) {
      const isObjectId = /^[a-f\d]{24}$/i.test(search);
      if (isObjectId) {
        query._id = new Types.ObjectId(search);
      } else {
        const matchingUsers = await this.userModel
          .find({
            $or: [
              { firstName: { $regex: search, $options: "i" } },
              { lastName: { $regex: search, $options: "i" } },
              { username: { $regex: search, $options: "i" } },
            ],
          })
          .distinct("_id");

        query.$or = [
          { text: { $regex: search, $options: "i" } },
          { userId: { $in: matchingUsers } },
          { studentId: { $in: matchingUsers } },
        ];
      }
    }

    const [requests, total] = await Promise.all([
      this.requestModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("categoryId", "name hashtag")
        .populate("studentId", "firstName lastName username telegramId")
        .populate("userId", "firstName lastName username telegramId language")
        .lean(),
      this.requestModel.countDocuments(query),
    ]);
    return { requests, total, page, limit };
  }

  async findAvailable() {
    return this.requestModel
      .find({ status: "approved" })
      .sort({ createdAt: 1 })
      .populate("categoryId", "name hashtag")
      .lean();
  }

  async findById(id: string) {
    const req = await this.requestModel
      .findById(id)
      .populate("categoryId", "name hashtag")
      .populate("studentId", "firstName lastName username telegramId")
      .populate("userId", "firstName lastName username telegramId language")
      .lean();
    if (!req) throw new NotFoundException("Request not found");
    return req;
  }

  async findStudentHistory(studentId: string) {
    return this.requestModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .sort({ createdAt: -1 })
      .populate("categoryId", "name hashtag")
      .populate("userId", "firstName lastName username")
      .lean();
  }

  async getHistory(requestId: string) {
    if (!Types.ObjectId.isValid(requestId))
      throw new BadRequestException("Invalid request id");
    return this.historyModel
      .find({ requestId: new Types.ObjectId(requestId) })
      .sort({ createdAt: 1 })
      .populate("performedBy", "firstName lastName username role")
      .lean();
  }

  /** Called by the bot when a citizen submits a new request (with optional files). */
  async submitRequest(
    userId: string,
    categoryId: string,
    text: string,
    files?: Express.Multer.File[]
  ) {
    const requestFiles = files?.length
      ? files.map((f) => ({
          filename: f.filename,
          originalName: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          ref: f.filename,
          source: "web" as const,
        }))
      : [];

    const req = await this.requestModel.create({
      userId: new Types.ObjectId(userId),
      categoryId: new Types.ObjectId(categoryId),
      text,
      status: "pending",
      requestFiles,
    });

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.REQUEST_SUBMITTED,
      performedBy: userId,
      performedByRole: "citizen",
      statusFrom: null,
      statusTo: "pending",
    });

    const cat = await (this.requestModel.db.model("Category") as any)
      .findById(categoryId)
      .lean()
      .catch(() => null);

    const adminMsgId = await this.notifications.notifyAdminNewRequest(
      String(req._id),
      cat?.name || "",
      text
    );
    if (adminMsgId) {
      await this.requestModel.updateOne(
        { _id: req._id },
        { adminChatMessageId: adminMsgId }
      );
    }

    return req;
  }

  // ── ADMIN ACTIONS ─────────────────────────────────────────────────────────

  async approve(requestId: string, adminId?: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("userId", "telegramId language firstName")
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();
    if (req.status !== "pending")
      throw new BadRequestException("Request is not pending");

    const prev = req.status;
    req.status = "approved";
    await req.save();

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.REQUEST_APPROVED,
      performedBy: adminId,
      performedByRole: "admin",
      statusFrom: prev,
      statusTo: "approved",
    });

    const user = req.userId as any;
    if (user?.telegramId)
      await this.notifications.notifyUserApproved(
        String(user.telegramId),
        user.language || "ru"
      );

    const cat = req.categoryId as any;

    if (req.adminChatMessageId) {
      await this.notifications.editAdminRequestStatus(
        req.adminChatMessageId,
        requestId,
        cat?.name || "",
        req.text,
        `✅ <b>Одобрено</b>`
      );
    }

    const messageId = await this.notifications.notifyStudentChatApproved(
      requestId,
      cat?.name || "",
      req.text
    );

    if (messageId)
      await this.requestModel.updateOne(
        { _id: req._id },
        { studentChatMessageId: messageId }
      );

    return req;
  }

  async reject(requestId: string, reason: string, adminId?: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("userId", "telegramId language")
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();
    if (req.status !== "pending")
      throw new BadRequestException("Request is not pending");

    const prev = req.status;
    req.status = "declined";
    req.declineReason = reason;
    await req.save();

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.REQUEST_REJECTED,
      performedBy: adminId,
      performedByRole: "admin",
      statusFrom: prev,
      statusTo: "declined",
      comment: reason,
    });

    const user = req.userId as any;
    if (user?.telegramId)
      await this.notifications.notifyUserRejected(
        String(user.telegramId),
        user.language || "ru",
        reason
      );

    // Edit the admin chat notification
    if (req.adminChatMessageId) {
      const cat = req.categoryId as any;
      await this.notifications.editAdminRequestStatus(
        req.adminChatMessageId,
        requestId,
        cat?.name || "",
        req.text,
        `❌ <b>Отклонено</b>\nПричина: ${reason}`
      );
    }

    return req;
  }

  async assignStudent(requestId: string, studentId: string, adminId?: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();
    if (req.status !== "approved")
      throw new BadRequestException("Request must be approved");

    const student = await this.userModel.findById(studentId);
    if (!student || student.role !== "student")
      throw new BadRequestException("Student not found");
    if (student.isBanned) throw new BadRequestException("Student is banned");

    const existing = await this.requestModel.findOne({
      studentId: new Types.ObjectId(studentId),
      status: "assigned",
    });
    if (existing)
      throw new BadRequestException("Student already has an active request");

    const prev = req.status;
    const now = new Date();
    req.studentId = new Types.ObjectId(studentId) as any;
    req.status = "assigned";
    req.assignedAt = now;
    req.timerDeadline = new Date(now.getTime() + TIMER_DURATION_MS);
    req.timerWarningSent = false;
    req.timerHalfWarningSent = false;
    req.timerExpiredNotified = false;
    await req.save();

    student.currentAssignmentId = req._id as any;
    await student.save();

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.TOOK_REQUEST,
      requestId: req._id,
    });

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.STUDENT_ASSIGNED,
      performedBy: adminId,
      performedByRole: "admin",
      statusFrom: prev,
      statusTo: "assigned",
      comment: `${student.firstName} ${student.lastName || ""}`.trim(),
    });

    if (req.studentChatMessageId) {
      const cat = req.categoryId as any;
      await this.notifications.updateStudentChatTaken(
        req.studentChatMessageId,
        cat?.name || "",
        req.text,
        `${student.firstName} ${student.lastName || ""}`.trim()
      );
      await this.requestModel.updateOne(
        { _id: req._id },
        { studentChatMessageId: null }
      );
    }

    await this.notifications.notifyStudentAssigned(
      String(student.telegramId),
      requestId,
      req.text
    );
    return req;
  }

  async unassign(requestId: string, adminId?: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId")
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();
    if (req.status !== "assigned")
      throw new BadRequestException("Request is not assigned");

    const student = req.studentId as any;
    const prev = req.status;

    if (student?._id) {
      await this.studentLogModel.create({
        studentId: student._id,
        action: StudentAction.UNASSIGNED_BY_ADMIN,
        requestId: req._id,
      });
      await this.userModel.updateOne(
        { _id: student._id },
        { currentAssignmentId: null }
      );
      // Запрещаем этому студенту повторно взять то же обращение
      await this.requestModel.updateOne(
        { _id: req._id },
        { $addToSet: { blockedStudentIds: student._id } }
      );
      if (student.telegramId)
        await this.notifications.notifyStudentUnassigned(
          String(student.telegramId)
        );
    }

    req.status = "approved";
    req.studentId = null;
    req.assignedAt = null;
    req.timerDeadline = null;
    req.timerWarningSent = false;
    req.timerHalfWarningSent = false;
    req.timerExpiredNotified = false;
    await req.save();

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.STUDENT_UNASSIGNED,
      performedBy: adminId,
      performedByRole: "admin",
      statusFrom: prev,
      statusTo: "approved",
      comment: student
        ? `${student.firstName} ${student.lastName || ""}`.trim()
        : null,
    });

    const cat = req.categoryId as any;
    const messageId = await this.notifications.notifyStudentChatReturned(
      requestId,
      cat?.name || "",
      req.text
    );
    if (messageId)
      await this.requestModel.updateOne(
        { _id: req._id },
        { studentChatMessageId: messageId }
      );

    return req;
  }

  async returnToQueue(requestId: string, adminId?: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId")
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();

    const student = req.studentId as any;
    const prev = req.status;

    if (student?._id) {
      await this.studentLogModel.create({
        studentId: student._id,
        action: StudentAction.UNASSIGNED_BY_ADMIN,
        requestId: req._id,
        details: "returned to queue",
      });
      await this.userModel.updateOne(
        { _id: student._id },
        { currentAssignmentId: null }
      );
      await this.requestModel.updateOne(
        { _id: req._id },
        { $addToSet: { blockedStudentIds: student._id } }
      );
      if (student.telegramId)
        await this.notifications.notifyStudentReturnedToQueue(
          String(student.telegramId)
        );
    }

    req.status = "approved";
    req.studentId = null;
    req.assignedAt = null;
    req.timerDeadline = null;
    req.timerWarningSent = false;
    req.timerExpiredNotified = false;
    req.answerText = null;
    req.adminComment = null;
    await req.save();

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.RETURNED_TO_QUEUE,
      performedBy: adminId,
      performedByRole: adminId ? "admin" : "system",
      statusFrom: prev,
      statusTo: "approved",
    });

    const cat = req.categoryId as any;
    const messageId = await this.notifications.notifyStudentChatReturned(
      requestId,
      cat?.name || "",
      req.text
    );
    if (messageId)
      await this.requestModel.updateOne(
        { _id: req._id },
        { studentChatMessageId: messageId }
      );

    await this.notifications.notifyAdminReturnedToQueue(
      requestId,
      cat?.name || "",
      req.text
    );

    return req;
  }

  async approveAnswer(
    requestId: string,
    finalAnswer?: string,
    adminId?: string
  ) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId")
      .populate("userId", "telegramId language")
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();
    if (req.status !== "answered")
      throw new BadRequestException("Request is not in answered status");

    const prev = req.status;

    // Лог: если администратор изменил ответ студента перед отправкой
    if (finalAnswer !== undefined && finalAnswer !== req.answerText) {
      await this.log({
        requestId: req._id as any,
        action: RequestHistoryAction.ANSWER_EDITED_BY_ADMIN,
        performedBy: adminId,
        performedByRole: "admin",
        statusFrom: prev,
        statusTo: prev, // статус ещё не изменился
        answerText: req.answerText, // оригинальный ответ студента
        answerFiles: req.answerFiles ?? [],
        comment: "Администратор изменил текст ответа перед отправкой",
      });
    }

    req.status = "closed";
    req.finalAnswerText = finalAnswer ?? req.answerText;
    await req.save();

    if (req.adminAnswerMessageId) {
      const cat = req.categoryId as any;
      const student = req.studentId as any;
      await this.notifications.editAdminAnswerStatus(
        req.adminAnswerMessageId,
        requestId,
        student ? `${student.firstName} ${student.lastName || ""}`.trim() : "",
        cat?.name || "",
        `✅ <b>Ответ одобрен</b>`
      );
    }

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.ANSWER_APPROVED,
      performedBy: adminId,
      performedByRole: "admin",
      statusFrom: prev,
      statusTo: "closed",
      answerText: req.finalAnswerText,
      answerFiles: req.answerFiles ?? [],
    });

    const student = req.studentId as any;
    if (student?._id) {
      await this.studentLogModel.create({
        studentId: student._id,
        action: StudentAction.ANSWER_APPROVED,
        requestId: req._id,
      });
      await this.userModel.updateOne(
        { _id: student._id },
        { currentAssignmentId: null }
      );
      if (student.telegramId)
        await this.notifications.notifyStudentAnswerApproved(
          String(student.telegramId),
          requestId
        );
    }

    const user = req.userId as any;
    if (user?.telegramId)
      await this.notifications.notifyUserAnswerReady(
        String(user.telegramId),
        user.language || "ru",
        req.finalAnswerText,
        req.answerFiles ?? []
      );

    return req;
  }

  async rejectAnswer(requestId: string, comment: string, adminId?: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId")
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();
    if (req.status !== "answered")
      throw new BadRequestException("Request is not in answered status");

    const prev = req.status;
    req.status = "assigned";
    req.adminComment = comment;
    // Сбрасываем таймер — выдаём новый срок с момента возврата в работу
    req.assignedAt = new Date();
    req.timerDeadline = new Date(Date.now() + TIMER_DURATION_MS);
    req.timerWarningSent = false;
    req.timerHalfWarningSent = false;
    req.timerExpiredNotified = false;
    await req.save();

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.ANSWER_REJECTED,
      performedBy: adminId,
      performedByRole: "admin",
      statusFrom: prev,
      statusTo: "assigned",
      // Snapshot of the rejected answer
      answerText: req.answerText,
      answerFiles: req.answerFiles ?? [],
      comment,
    });

    const student = req.studentId as any;
    if (student?._id) {
      await this.studentLogModel.create({
        studentId: student._id,
        action: StudentAction.ANSWER_REJECTED,
        requestId: req._id,
        details: comment,
      });
      if (student.telegramId)
        await this.notifications.notifyStudentAnswerRejected(
          String(student.telegramId),
          requestId,
          comment
        );
    }

    if (req.adminAnswerMessageId) {
      const cat = req.categoryId as any;
      const student = req.studentId as any;
      await this.notifications.editAdminAnswerStatus(
        req.adminAnswerMessageId,
        requestId,
        student ? `${student.firstName} ${student.lastName || ""}`.trim() : "",
        cat?.name || "",
        `🔄 <b>Возвращено на доработку</b>\nКомментарий: ${comment}`
      );
    }

    return req;
  }

  /** Admin saves edited answer text + comment without changing status (draft). */
  async saveAnswerDraft(
    requestId: string,
    answerText: string,
    adminComment: string | undefined,
    adminId?: string
  ) {
    const req = await this.requestModel.findById(requestId);
    if (!req) throw new NotFoundException();
    if (req.status !== "answered")
      throw new BadRequestException("Request is not in answered status");

    req.answerText = answerText;
    if (adminComment !== undefined) req.adminComment = adminComment;
    await req.save();

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.ANSWER_DRAFT_SAVED,
      performedBy: adminId,
      performedByRole: "admin",
      statusFrom: req.status,
      statusTo: req.status,
      answerText: req.answerText,
      comment: adminComment ?? null,
    });

    return req;
  }

  /** Admin uploads an extra file to answerFiles of an answered/assigned request. */
  async addAnswerFile(
    requestId: string,
    file: Express.Multer.File,
    adminId?: string
  ) {
    const req = await this.requestModel.findById(requestId);
    if (!req) throw new NotFoundException();

    req.answerFiles = [
      ...(req.answerFiles ?? []),
      {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        ref: file.filename,
        source: "web",
      },
    ];
    await req.save();

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.ANSWER_FILE_ADDED,
      performedBy: adminId,
      performedByRole: "admin",
      statusFrom: req.status,
      statusTo: req.status,
      comment: file.originalname,
    });

    return req;
  }

  /** Admin removes a file from answerFiles by filename. */
  async removeAnswerFile(
    requestId: string,
    filename: string,
    adminId?: string
  ) {
    const req = await this.requestModel.findById(requestId);
    if (!req) throw new NotFoundException();

    // Находим originalName до удаления
    const fileToRemove = (req.answerFiles ?? []).find(
      (f) => f.filename === filename
    );
    req.answerFiles = (req.answerFiles ?? []).filter(
      (f) => f.filename !== filename
    );
    await req.save();

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.ANSWER_FILE_REMOVED,
      performedBy: adminId,
      performedByRole: "admin",
      statusFrom: req.status,
      statusTo: req.status,
      comment: fileToRemove?.originalName ?? filename,
    });

    // Удалить физический файл
    try {
      const { unlinkSync, existsSync } = await import("fs");
      const { join } = await import("path");
      const filePath = join(process.cwd(), "uploads", filename);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // non-fatal
    }

    return req;
  }

  async sendDirectMessage(requestId: string, text: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("userId", "telegramId");
    if (!req) throw new NotFoundException();
    const user = req.userId as any;
    if (user?.telegramId)
      await this.notifications.notifyUserDirectMessage(
        String(user.telegramId),
        text
      );
    return { sent: true };
  }

  // ── STUDENT ACTIONS ───────────────────────────────────────────────────────

  async takeRequest(requestId: string, studentId: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();
    if (req.status !== "approved")
      throw new BadRequestException("Request is not available");

    const existing = await this.requestModel.findOne({
      studentId: new Types.ObjectId(studentId),
      status: "assigned",
    });
    if (existing)
      throw new BadRequestException("You already have an active request");

    // Запрещаем повторное взятие если студент был снят или просрочил
    if (req.blockedStudentIds?.some((id) => String(id) === String(studentId))) {
      throw new BadRequestException("You cannot take this request again");
    }

    const student = await this.userModel.findById(studentId);
    if (!student) throw new NotFoundException();

    const prev = req.status;
    const now = new Date();
    req.studentId = new Types.ObjectId(studentId) as any;
    req.status = "assigned";
    req.assignedAt = now;
    req.timerDeadline = new Date(now.getTime() + TIMER_DURATION_MS);
    req.timerWarningSent = false;
    req.timerHalfWarningSent = false;
    req.timerExpiredNotified = false;
    await req.save();

    student.currentAssignmentId = req._id as any;
    await student.save();

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.TOOK_REQUEST,
      requestId: req._id,
    });

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.STUDENT_TOOK,
      performedBy: studentId,
      performedByRole: "student",
      statusFrom: prev,
      statusTo: "assigned",
    });

    if (req.studentChatMessageId) {
      const cat = req.categoryId as any;
      await this.notifications.updateStudentChatTaken(
        req.studentChatMessageId,
        cat?.name || "",
        req.text,
        `${student.firstName} ${student.lastName || ""}`.trim()
      );
      await this.requestModel.updateOne(
        { _id: req._id },
        { studentChatMessageId: null }
      );
    }

    // Уведомить гражданина что его обращение взято в работу
    const citizenPopulated = await this.requestModel
      .findById(requestId)
      .populate("userId", "telegramId language")
      .lean();
    const citizen = citizenPopulated?.userId as any;
    if (citizen?.telegramId) {
      await this.notifications.notifyUserRequestTaken(
        String(citizen.telegramId),
        citizen.language || "ru"
      );
    }

    return req;
  }

  async submitAnswer(
    requestId: string,
    studentId: string,
    answer: string,
    files?: Express.Multer.File[]
  ) {
    const req = await this.requestModel.findById(requestId);
    if (!req) throw new NotFoundException();
    if (req.status !== "assigned")
      throw new BadRequestException("Request is not assigned");
    if (String(req.studentId) !== studentId)
      throw new ForbiddenException("Not your request");

    const timeSpentMinutes = req.assignedAt
      ? Math.round((Date.now() - req.assignedAt.getTime()) / 60000)
      : null;

    const prev = req.status;
    req.status = "answered";
    req.answerText = answer;
    // Аннулируем таймер — ответ уже отправлен, уведомления о просрочке не нужны
    req.timerDeadline = null;
    req.timerWarningSent = true;
    req.timerHalfWarningSent = true;
    req.timerExpiredNotified = true;

    const answerFiles = files?.length
      ? files.map((f) => ({
          filename: f.filename,
          originalName: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          ref: f.filename,
          source: "web" as const,
        }))
      : [];

    if (answerFiles.length) req.answerFiles = answerFiles;

    await req.save();

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.SUBMITTED_ANSWER,
      requestId: req._id,
      timeSpentMinutes,
    });

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.ANSWER_SUBMITTED,
      performedBy: studentId,
      performedByRole: "student",
      statusFrom: prev,
      statusTo: "answered",
      answerText: answer,
      answerFiles,
    });

    const student = await this.userModel.findById(studentId);
    const cat = req.categoryId as any;
    const adminAnswerMsgId =
      await this.notifications.notifyAdminAnswerSubmitted(
        requestId,
        student ? `${student.firstName} ${student.lastName}`.trim() : "",
        cat?.name || ""
      );
    if (adminAnswerMsgId) {
      await this.requestModel.updateOne(
        { _id: req._id },
        { adminAnswerMessageId: adminAnswerMsgId }
      );
    }
    return req;
  }

  async declineRequest(requestId: string, studentId: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();
    if (req.status !== "assigned")
      throw new BadRequestException("Request is not assigned");
    if (String(req.studentId) !== studentId)
      throw new ForbiddenException("Not your request");

    const prev = req.status;

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.DECLINED_REQUEST,
      requestId: req._id,
    });

    await this.log({
      requestId: req._id as any,
      action: RequestHistoryAction.STUDENT_DECLINED,
      performedBy: studentId,
      performedByRole: "student",
      statusFrom: prev,
      statusTo: "approved",
    });

    req.status = "approved";
    req.studentId = null;
    req.assignedAt = null;
    req.timerDeadline = null;
    req.timerWarningSent = false;
    req.timerHalfWarningSent = false;
    req.timerExpiredNotified = false;
    await req.save();

    await this.userModel.updateOne(
      { _id: studentId },
      { currentAssignmentId: null }
    );

    const student = await this.userModel.findById(studentId);
    await this.notifications.notifyAdminStudentDeclined(
      requestId,
      student ? `${student.firstName} ${student.lastName}`.trim() : ""
    );

    const cat = req.categoryId as any;
    const messageId = await this.notifications.notifyStudentChatReturned(
      requestId,
      cat?.name || "",
      req.text
    );
    if (messageId)
      await this.requestModel.updateOne(
        { _id: req._id },
        { studentChatMessageId: messageId }
      );

    return req;
  }

  async rejectStandard(requestId: string, adminId?: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("userId", "language");
    if (!req) throw new NotFoundException();

    const user = req.userId as any;
    const language: string = user?.language || "ru";

    const texts = await this.settingsService.get("standard_rejection_text");
    const reason = texts[language] || texts["ru"] || "Обращение отклонено.";

    return this.reject(requestId, reason, adminId);
  }

  async findUserHistory(userId: string) {
    return this.requestModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .populate("categoryId", "name hashtag")
      .lean();
  }
}
