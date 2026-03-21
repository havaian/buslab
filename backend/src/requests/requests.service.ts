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
import { StudentAction } from "../common/enums/student-action.enum";
import { NotificationsService } from "../notifications/notifications.service";

const TIMER_DURATION_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(StudentLog.name)
    private studentLogModel: Model<StudentLogDocument>,
    private readonly notifications: NotificationsService
  ) {}

  // ── LIST ─────────────────────────────────────────────────────────────────

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

  // ── ADMIN ACTIONS ─────────────────────────────────────────────────────────

  async approve(requestId: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("userId", "telegramId language firstName")
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();
    if (req.status !== "pending")
      throw new BadRequestException("Request is not pending");

    req.status = "approved";
    await req.save();

    const user = req.userId as any;
    if (user?.telegramId) {
      await this.notifications.notifyUserApproved(
        String(user.telegramId),
        user.language || "ru"
      );
    }

    const cat = req.categoryId as any;
    // Send to student chat with URL button — save returned message_id
    const messageId = await this.notifications.notifyStudentChatApproved(
      requestId,
      cat?.name || "",
      req.text.slice(0, 100)
    );
    if (messageId) {
      await this.requestModel.updateOne(
        { _id: req._id },
        { studentChatMessageId: messageId }
      );
    }

    return req;
  }

  async reject(requestId: string, reason: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("userId", "telegramId language");
    if (!req) throw new NotFoundException();
    if (req.status !== "pending")
      throw new BadRequestException("Request is not pending");

    req.status = "declined";
    req.declineReason = reason;
    await req.save();

    const user = req.userId as any;
    if (user?.telegramId) {
      await this.notifications.notifyUserRejected(
        String(user.telegramId),
        user.language || "ru",
        reason
      );
    }
    return req;
  }

  async assignStudent(requestId: string, studentId: string) {
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

    const now = new Date();
    req.studentId = new Types.ObjectId(studentId) as any;
    req.status = "assigned";
    req.assignedAt = now;
    req.timerDeadline = new Date(now.getTime() + TIMER_DURATION_MS);
    req.timerWarningSent = false;
    req.timerExpiredNotified = false;
    await req.save();

    student.currentAssignmentId = req._id as any;
    await student.save();

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.TOOK_REQUEST,
      requestId: req._id,
    });

    // Edit student chat message to mark as taken
    if (req.studentChatMessageId) {
      const cat = req.categoryId as any;
      await this.notifications.updateStudentChatTaken(
        req.studentChatMessageId,
        cat?.name || "",
        req.text.slice(0, 100),
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
      req.text.slice(0, 100)
    );
    return req;
  }

  async unassign(requestId: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId")
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();
    if (req.status !== "assigned")
      throw new BadRequestException("Request is not assigned");

    const student = req.studentId as any;
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
    req.timerExpiredNotified = false;
    await req.save();

    // Republish to student chat with a fresh URL-button announcement
    const cat = req.categoryId as any;
    const messageId = await this.notifications.notifyStudentChatReturned(
      requestId,
      cat?.name || "",
      req.text.slice(0, 100)
    );
    if (messageId) {
      await this.requestModel.updateOne(
        { _id: req._id },
        { studentChatMessageId: messageId }
      );
    }

    return req;
  }

  async returnToQueue(requestId: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId")
      .populate("categoryId", "name");
    if (!req) throw new NotFoundException();

    const student = req.studentId as any;
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

    // Republish to student chat with a fresh URL-button announcement
    const cat = req.categoryId as any;
    const messageId = await this.notifications.notifyStudentChatReturned(
      requestId,
      cat?.name || "",
      req.text.slice(0, 100)
    );
    if (messageId) {
      await this.requestModel.updateOne(
        { _id: req._id },
        { studentChatMessageId: messageId }
      );
    }

    return req;
  }

  async approveAnswer(requestId: string, finalAnswer?: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId")
      .populate("userId", "telegramId language");
    if (!req) throw new NotFoundException();
    if (req.status !== "answered")
      throw new BadRequestException("Request is not in answered status");

    req.status = "closed";
    req.finalAnswerText = finalAnswer ?? req.answerText;
    await req.save();

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
    if (user?.telegramId) {
      await this.notifications.notifyUserAnswerReady(
        String(user.telegramId),
        user.language || "ru",
        req.finalAnswerText
      );
    }
    return req;
  }

  async rejectAnswer(requestId: string, comment: string) {
    const req = await this.requestModel
      .findById(requestId)
      .populate("studentId");
    if (!req) throw new NotFoundException();
    if (req.status !== "answered")
      throw new BadRequestException("Request is not in answered status");

    req.status = "assigned";
    req.adminComment = comment;
    await req.save();

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

    const student = await this.userModel.findById(studentId);
    if (!student) throw new NotFoundException();

    const now = new Date();
    req.studentId = new Types.ObjectId(studentId) as any;
    req.status = "assigned";
    req.assignedAt = now;
    req.timerDeadline = new Date(now.getTime() + TIMER_DURATION_MS);
    req.timerWarningSent = false;
    req.timerExpiredNotified = false;
    await req.save();

    student.currentAssignmentId = req._id as any;
    await student.save();

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.TOOK_REQUEST,
      requestId: req._id,
    });

    // Edit the student chat announcement to mark as taken + remove the button
    if (req.studentChatMessageId) {
      const cat = req.categoryId as any;
      await this.notifications.updateStudentChatTaken(
        req.studentChatMessageId,
        cat?.name || "",
        req.text.slice(0, 100),
        `${student.firstName} ${student.lastName || ""}`.trim()
      );
      // Clear the stored message_id — message has been edited, no longer "active"
      await this.requestModel.updateOne(
        { _id: req._id },
        { studentChatMessageId: null }
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

    req.status = "answered";
    req.answerText = answer;

    if (files?.length) {
      req.answerFiles = files.map((f) => ({
        filename: f.filename,
        originalName: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        ref: f.filename,
        source: "web",
      }));
    }

    await req.save();

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.SUBMITTED_ANSWER,
      requestId: req._id,
      timeSpentMinutes,
    });

    const student = await this.userModel.findById(studentId);
    const cat = req.categoryId as any;
    await this.notifications.notifyAdminAnswerSubmitted(
      requestId,
      student ? `${student.firstName} ${student.lastName}`.trim() : "",
      cat?.name || ""
    );
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

    await this.studentLogModel.create({
      studentId: new Types.ObjectId(studentId),
      action: StudentAction.DECLINED_REQUEST,
      requestId: req._id,
    });

    req.status = "approved";
    req.studentId = null;
    req.assignedAt = null;
    req.timerDeadline = null;
    req.timerWarningSent = false;
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

    // Republish to student chat so other students can take it
    const cat = req.categoryId as any;
    const messageId = await this.notifications.notifyStudentChatReturned(
      requestId,
      cat?.name || "",
      req.text.slice(0, 100)
    );
    if (messageId) {
      await this.requestModel.updateOne(
        { _id: req._id },
        { studentChatMessageId: messageId }
      );
    }

    return req;
  }
}
