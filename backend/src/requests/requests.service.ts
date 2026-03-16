import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Request, RequestDocument } from "./schemas/request.schema";
import { RequestStatus } from "../common/enums/request-status.enum";
import {
  AdminUser,
  AdminUserDocument,
} from "../admin-users/schemas/admin-user.schema";
import {
  StudentLog,
  StudentLogDocument,
} from "../student-logs/schemas/student-log.schema";
import { StudentAction } from "../common/enums/student-action.enum";
import { NotificationsService } from "../notifications/notifications.service";
import { UserRole } from "../common/enums/user-role.enum";

// Default timer duration: 12 hours in ms
const TIMER_DURATION_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>,
    @InjectModel(AdminUser.name)
    private adminUserModel: Model<AdminUserDocument>,
    @InjectModel(StudentLog.name)
    private studentLogModel: Model<StudentLogDocument>,
    private readonly notifications: NotificationsService
  ) {}

  // ── LIST ────────────────────────────────────────────────────────────────

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
    if (search) query.text = { $regex: search, $options: "i" };
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const [requests, total] = await Promise.all([
      this.requestModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("categoryId", "name")
        .populate("studentId", "firstName lastName username")
        .lean(),
      this.requestModel.countDocuments(query),
    ]);

    return { requests, total, page, limit };
  }

  // Student: list of APPROVED requests (available to pick)
  async findAvailable() {
    return this.requestModel
      .find({ status: RequestStatus.APPROVED })
      .sort({ createdAt: 1 })
      .populate("categoryId", "name")
      .select("-telegramUserId -userFirstName -userLastName -userUsername") // hide citizen data from students
      .lean();
  }

  async findById(id: string) {
    const req = await this.requestModel
      .findById(id)
      .populate("categoryId", "name")
      .populate("studentId", "firstName lastName username telegramId")
      .lean();
    if (!req) throw new NotFoundException("Request not found");
    return req;
  }

  // Student: their own history
  async findStudentHistory(studentId: string) {
    return this.requestModel
      .find({
        studentId: new Types.ObjectId(studentId),
        status: {
          $in: [
            RequestStatus.CLOSED,
            RequestStatus.APPROVED,
            RequestStatus.IN_PROGRESS,
            RequestStatus.ANSWER_REVIEW,
          ],
        },
      })
      .sort({ createdAt: -1 })
      .populate("categoryId", "name")
      .lean();
  }

  // ── ADMIN ACTIONS ────────────────────────────────────────────────────────

  async approve(requestId: string) {
    const req = await this.requestModel.findById(requestId);
    if (!req) throw new NotFoundException();
    if (req.status !== RequestStatus.PENDING) {
      throw new BadRequestException("Request is not in PENDING status");
    }
    req.status = RequestStatus.APPROVED;
    await req.save();

    // Notify student group chat
    const cat = req.categoryId as any;
    await this.notifications.notifyStudentChatApproved(
      requestId,
      cat?.name || "",
      req.text.slice(0, 100)
    );
    // Notify citizen
    await this.notifications.notifyUserApproved(
      req.telegramUserId,
      req.userLanguage
    );

    return req;
  }

  async reject(requestId: string, reason: string) {
    const req = await this.requestModel.findById(requestId);
    if (!req) throw new NotFoundException();
    if (req.status !== RequestStatus.PENDING) {
      throw new BadRequestException("Request is not in PENDING status");
    }
    req.status = RequestStatus.REJECTED;
    req.declineReason = reason;
    await req.save();

    await this.notifications.notifyUserRejected(
      req.telegramUserId,
      req.userLanguage,
      reason
    );
    return req;
  }

  async assignStudent(requestId: string, studentId: string) {
    const req = await this.requestModel.findById(requestId);
    if (!req) throw new NotFoundException("Request not found");
    if (req.status !== RequestStatus.APPROVED) {
      throw new BadRequestException(
        "Request must be in APPROVED status to assign"
      );
    }

    const student = await this.adminUserModel.findById(studentId);
    if (!student || student.role !== UserRole.STUDENT) {
      throw new BadRequestException("Student not found");
    }
    if (student.isBlocked) throw new BadRequestException("Student is blocked");

    // Check student has no active request
    const existing = await this.requestModel.findOne({
      studentId: new Types.ObjectId(studentId),
      status: RequestStatus.IN_PROGRESS,
    });
    if (existing)
      throw new BadRequestException("Student already has an active request");

    const now = new Date();
    req.studentId = new Types.ObjectId(studentId) as any;
    req.status = RequestStatus.IN_PROGRESS;
    req.timerStart = now;
    req.timerDeadline = new Date(now.getTime() + TIMER_DURATION_MS);
    req.timerWarningSent = false;
    req.timerExpiredNotified = false;
    await req.save();

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.TOOK_REQUEST,
      requestId: req._id,
    });

    await this.notifications.notifyStudentAssigned(
      student.telegramId,
      requestId,
      req.text.slice(0, 100)
    );

    return req;
  }

  async unassign(requestId: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId");
    if (!req) throw new NotFoundException();
    if (req.status !== RequestStatus.IN_PROGRESS) {
      throw new BadRequestException("Request is not IN_PROGRESS");
    }

    const student = req.studentId as any;
    const studentObjId = new Types.ObjectId(String(student._id || student));

    await this.studentLogModel.create({
      studentId: studentObjId,
      action: StudentAction.UNASSIGNED_BY_ADMIN,
      requestId: req._id,
    });

    req.status = RequestStatus.APPROVED;
    req.studentId = null;
    req.timerStart = null;
    req.timerDeadline = null;
    req.timerWarningSent = false;
    req.timerExpiredNotified = false;
    await req.save();

    if (student?.telegramId) {
      await this.notifications.notifyStudentUnassigned(student.telegramId);
    }
    await this.notifications.notifyStudentChatReturned(requestId);

    return req;
  }

  async returnToQueue(requestId: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId");
    if (!req) throw new NotFoundException();

    const allowedStatuses = [
      RequestStatus.APPROVED,
      RequestStatus.IN_PROGRESS,
      RequestStatus.CLOSED,
      RequestStatus.REJECTED,
    ];
    if (!allowedStatuses.includes(req.status as any)) {
      throw new BadRequestException("Cannot return this request to queue");
    }

    const student = req.studentId as any;
    if (student) {
      await this.studentLogModel.create({
        studentId: new Types.ObjectId(String(student._id || student)),
        action: StudentAction.UNASSIGNED_BY_ADMIN,
        requestId: req._id,
        details: "returned to queue",
      });
      if (student?.telegramId) {
        await this.notifications.notifyStudentReturnedToQueue(
          student.telegramId
        );
      }
    }

    req.status = RequestStatus.APPROVED;
    req.studentId = null;
    req.timerStart = null;
    req.timerDeadline = null;
    req.timerWarningSent = false;
    req.timerExpiredNotified = false;
    req.studentAnswer = "";
    req.studentAnswerFiles = [];
    req.adminComment = "";
    await req.save();

    await this.notifications.notifyStudentChatReturned(requestId);

    return req;
  }

  async approveAnswer(
    requestId: string,
    finalAnswer?: string,
    finalAnswerFiles?: any[]
  ) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId");
    if (!req) throw new NotFoundException();
    if (req.status !== RequestStatus.ANSWER_REVIEW) {
      throw new BadRequestException("Request is not in ANSWER_REVIEW status");
    }

    req.status = RequestStatus.CLOSED;
    req.finalAnswer = finalAnswer ?? req.studentAnswer;
    if (finalAnswerFiles) req.finalAnswerFiles = finalAnswerFiles;

    await req.save();

    const student = req.studentId as any;
    if (student) {
      await this.studentLogModel.create({
        studentId: new Types.ObjectId(String(student._id)),
        action: StudentAction.ANSWER_APPROVED,
        requestId: req._id,
      });
      if (student.telegramId) {
        await this.notifications.notifyStudentAnswerApproved(
          student.telegramId,
          requestId
        );
      }
    }

    await this.notifications.notifyUserAnswerReady(
      req.telegramUserId,
      req.userLanguage,
      req.finalAnswer
    );

    return req;
  }

  async rejectAnswer(requestId: string, comment: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId");
    if (!req) throw new NotFoundException();
    if (req.status !== RequestStatus.ANSWER_REVIEW) {
      throw new BadRequestException("Request is not in ANSWER_REVIEW status");
    }

    req.status = RequestStatus.IN_PROGRESS;
    req.adminComment = comment;
    await req.save();

    const student = req.studentId as any;
    if (student) {
      await this.studentLogModel.create({
        studentId: new Types.ObjectId(String(student._id)),
        action: StudentAction.ANSWER_REJECTED,
        requestId: req._id,
        details: comment,
      });
      if (student.telegramId) {
        await this.notifications.notifyStudentAnswerRejected(
          student.telegramId,
          requestId,
          comment
        );
      }
    }

    return req;
  }

  async sendDirectMessage(requestId: string, text: string) {
    const req = await this.requestModel.findById(requestId);
    if (!req) throw new NotFoundException();
    await this.notifications.notifyUserDirectMessage(req.telegramUserId, text);
    return { sent: true };
  }

  // ── STUDENT ACTIONS ──────────────────────────────────────────────────────

  async takeRequest(requestId: string, studentId: string) {
    const req = await this.requestModel.findById(requestId);
    if (!req) throw new NotFoundException();
    if (req.status !== RequestStatus.APPROVED) {
      throw new BadRequestException("Request is not available");
    }

    // Check student has no active request
    const existing = await this.requestModel.findOne({
      studentId: new Types.ObjectId(studentId),
      status: RequestStatus.IN_PROGRESS,
    });
    if (existing)
      throw new BadRequestException("You already have an active request");

    const student = await this.adminUserModel.findById(studentId);
    if (!student) throw new NotFoundException("Student not found");

    const now = new Date();
    req.studentId = new Types.ObjectId(studentId) as any;
    req.status = RequestStatus.IN_PROGRESS;
    req.timerStart = now;
    req.timerDeadline = new Date(now.getTime() + TIMER_DURATION_MS);
    req.timerWarningSent = false;
    req.timerExpiredNotified = false;
    await req.save();

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.TOOK_REQUEST,
      requestId: req._id,
    });

    return req;
  }

  async submitAnswer(
    requestId: string,
    studentId: string,
    answer: string,
    files?: any[]
  ) {
    const req = await this.requestModel.findById(requestId);
    if (!req) throw new NotFoundException();
    if (req.status !== RequestStatus.IN_PROGRESS) {
      throw new BadRequestException("Request is not IN_PROGRESS");
    }
    if (String(req.studentId) !== studentId) {
      throw new ForbiddenException("This is not your request");
    }

    const timeSpentMinutes = req.timerStart
      ? Math.round((Date.now() - req.timerStart.getTime()) / 60000)
      : null;

    req.status = RequestStatus.ANSWER_REVIEW;
    req.studentAnswer = answer;
    if (files) req.studentAnswerFiles = files;
    await req.save();

    const student = await this.adminUserModel.findById(studentId);

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.SUBMITTED_ANSWER,
      requestId: req._id,
      timeSpentMinutes,
    });

    await this.notifications.notifyAdminAnswerSubmitted(
      requestId,
      student ? `${student.firstName} ${student.lastName}`.trim() : "",
      ""
    );

    return req;
  }

  async declineRequest(requestId: string, studentId: string) {
    const req = await this.requestModel.findById(requestId);
    if (!req) throw new NotFoundException();
    if (req.status !== RequestStatus.IN_PROGRESS) {
      throw new BadRequestException("Request is not IN_PROGRESS");
    }
    if (String(req.studentId) !== studentId) {
      throw new ForbiddenException("This is not your request");
    }

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.DECLINED_REQUEST,
      requestId: req._id,
    });

    req.status = RequestStatus.APPROVED;
    req.studentId = null;
    req.timerStart = null;
    req.timerDeadline = null;
    req.timerWarningSent = false;
    req.timerExpiredNotified = false;
    await req.save();

    const student = await this.adminUserModel.findById(studentId);
    await this.notifications.notifyAdminStudentDeclined(
      requestId,
      student ? `${student.firstName} ${student.lastName}`.trim() : ""
    );
    await this.notifications.notifyStudentChatReturned(requestId);

    return req;
  }
}
