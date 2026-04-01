import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Request, RequestDocument } from "../requests/schemas/request.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  StudentLog,
  StudentLogDocument,
} from "../student-logs/schemas/student-log.schema";
import { StudentAction } from "../common/enums/student-action.enum";
import { NotificationsService } from "../notifications/notifications.service";

const ONE_HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(StudentLog.name)
    private studentLogModel: Model<StudentLogDocument>,
    private readonly notifications: NotificationsService
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkTimers() {
    const now = new Date();

    const activeRequests = await this.requestModel
      .find({ status: "assigned", timerDeadline: { $ne: null } })
      .populate("studentId", "telegramId firstName lastName")
      .lean();

    // Fix #13: вместо отдельного updateOne на каждый запрос — собираем ID
    // и делаем один updateMany в конце для каждого типа флага.
    const halfWarnIds: any[] = [];
    const warnIds: any[] = [];
    const expiredIds: any[] = [];
    const expiredStudentIds: any[] = [];

    for (const req of activeRequests) {
      if (!req.timerDeadline) continue;
      const student = req.studentId as any;
      const deadlineMs = new Date(req.timerDeadline).getTime();
      const timeLeft = deadlineMs - now.getTime();

      // ── 50% предупреждение ─────────────────────────────────────────────
      if (req.assignedAt && !req.timerHalfWarningSent) {
        const totalDuration = deadlineMs - new Date(req.assignedAt).getTime();
        const halfDuration = totalDuration / 2;
        if (
          timeLeft > 0 &&
          timeLeft <= halfDuration &&
          timeLeft > ONE_HOUR_MS
        ) {
          this.logger.log(`Timer half-warning for request ${req._id}`);
          if (student?.telegramId) {
            await this.notifications.notifyStudentTimerHalfWarning(
              String(student.telegramId),
              String(req._id),
              Math.round(timeLeft / ONE_HOUR_MS)
            );
          }
          halfWarnIds.push(req._id);
        }
      }

      // ── 1 час до конца ────────────────────────────────────────────────
      if (timeLeft > 0 && timeLeft <= ONE_HOUR_MS && !req.timerWarningSent) {
        this.logger.log(`Timer 1h warning for request ${req._id}`);
        if (student?.telegramId) {
          await this.notifications.notifyStudentTimerWarning(
            String(student.telegramId),
            String(req._id)
          );
        }
        warnIds.push(req._id);
      }

      // ── Просрочка ─────────────────────────────────────────────────────
      if (timeLeft <= 0 && !req.timerExpiredNotified) {
        this.logger.log(`Timer expired for request ${req._id}`);
        if (student?.telegramId) {
          await this.notifications.notifyStudentTimerExpired(
            String(student.telegramId),
            String(req._id)
          );
        }
        await this.notifications.notifyAdminTimerExpired(
          String(req._id),
          student ? `${student.firstName} ${student.lastName}`.trim() : ""
        );
        if (student?._id) {
          await this.studentLogModel.create({
            studentId: student._id,
            action: StudentAction.TIMER_EXPIRED,
            requestId: req._id,
          });
          expiredStudentIds.push({ reqId: req._id, studentId: student._id });
        }
        expiredIds.push(req._id);
      }
    }

    // Батчевые обновления вместо N отдельных updateOne
    if (halfWarnIds.length) {
      await this.requestModel.updateMany(
        { _id: { $in: halfWarnIds } },
        { $set: { timerHalfWarningSent: true } }
      );
    }
    if (warnIds.length) {
      await this.requestModel.updateMany(
        { _id: { $in: warnIds } },
        { $set: { timerWarningSent: true } }
      );
    }
    if (expiredIds.length) {
      // Помечаем как уведомлённые; blockedStudentIds добавляем отдельно per-doc
      // т.к. $addToSet требует разных значений для каждого документа
      await this.requestModel.updateMany(
        { _id: { $in: expiredIds } },
        { $set: { timerExpiredNotified: true } }
      );
      for (const { reqId, studentId } of expiredStudentIds) {
        await this.requestModel.updateOne(
          { _id: reqId },
          { $addToSet: { blockedStudentIds: studentId } }
        );
      }
    }
  }
}
