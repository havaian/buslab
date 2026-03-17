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

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

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

    for (const req of activeRequests) {
      if (!req.timerDeadline) continue;
      const student = req.studentId as any;
      const timeLeft = new Date(req.timerDeadline).getTime() - now.getTime();

      if (timeLeft > 0 && timeLeft <= TWO_HOURS_MS && !req.timerWarningSent) {
        this.logger.log(`Timer warning for request ${req._id}`);
        if (student?.telegramId) {
          await this.notifications.notifyStudentTimerWarning(
            String(student.telegramId),
            String(req._id)
          );
        }
        await this.requestModel.updateOne(
          { _id: req._id },
          { $set: { timerWarningSent: true } }
        );
      }

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
        }
        await this.requestModel.updateOne(
          { _id: req._id },
          { $set: { timerExpiredNotified: true } }
        );
      }
    }
  }
}
