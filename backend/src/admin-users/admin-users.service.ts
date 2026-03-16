import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AdminUser, AdminUserDocument } from "./schemas/admin-user.schema";
import { UserRole } from "../common/enums/user-role.enum";
import {
  StudentLog,
  StudentLogDocument,
} from "../student-logs/schemas/student-log.schema";
import { StudentAction } from "../common/enums/student-action.enum";
import { Request, RequestDocument } from "../requests/schemas/request.schema";
import { RequestStatus } from "../common/enums/request-status.enum";

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(AdminUser.name)
    private adminUserModel: Model<AdminUserDocument>,
    @InjectModel(StudentLog.name)
    private studentLogModel: Model<StudentLogDocument>,
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>
  ) {}

  async findAll() {
    return this.adminUserModel.find().lean();
  }

  async findStudents() {
    return this.adminUserModel.find({ role: UserRole.STUDENT }).lean();
  }

  async findFreeStudents() {
    // Students with no active IN_PROGRESS request
    const busyIds = await this.requestModel
      .find({ status: RequestStatus.IN_PROGRESS })
      .distinct("studentId");
    return this.adminUserModel
      .find({
        role: UserRole.STUDENT,
        isBlocked: false,
        _id: { $nin: busyIds },
      })
      .lean();
  }

  async findById(id: string) {
    const user = await this.adminUserModel.findById(id).lean();
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async block(id: string) {
    const user = await this.adminUserModel.findById(id);
    if (!user) throw new NotFoundException("User not found");
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException("Cannot block an admin");
    }
    user.isBlocked = true;
    return user.save();
  }

  async unblock(id: string) {
    const user = await this.adminUserModel.findById(id);
    if (!user) throw new NotFoundException("User not found");
    user.isBlocked = false;
    return user.save();
  }

  async getStudentStats(studentId: string) {
    const logs = await this.studentLogModel.find({ studentId }).lean();

    const total = logs.filter(
      (l) => l.action === StudentAction.TOOK_REQUEST
    ).length;
    const submitted = logs.filter(
      (l) => l.action === StudentAction.SUBMITTED_ANSWER
    ).length;
    const approved = logs.filter(
      (l) => l.action === StudentAction.ANSWER_APPROVED
    ).length;
    const rejected = logs.filter(
      (l) => l.action === StudentAction.ANSWER_REJECTED
    ).length;
    const declines = logs.filter(
      (l) => l.action === StudentAction.DECLINED_REQUEST
    ).length;
    const unassigned = logs.filter(
      (l) => l.action === StudentAction.UNASSIGNED_BY_ADMIN
    ).length;
    const expired = logs.filter(
      (l) => l.action === StudentAction.TIMER_EXPIRED
    ).length;

    const timeLogs = logs.filter(
      (l) => l.action === StudentAction.SUBMITTED_ANSWER && l.timeSpentMinutes
    );
    const avgTime =
      timeLogs.length > 0
        ? Math.round(
            timeLogs.reduce((a, b) => a + b.timeSpentMinutes, 0) /
              timeLogs.length
          )
        : 0;

    const approvalRate =
      submitted > 0 ? Math.round((approved / submitted) * 100) : 0;

    // Simple rating: approval rate weighted by volume
    const rating = submitted >= 5 ? approvalRate : null;

    return {
      total,
      submitted,
      approved,
      rejected,
      declines,
      unassigned,
      expired,
      avgTime,
      approvalRate,
      rating,
    };
  }

  async getStudentLogs(studentId: string) {
    return this.studentLogModel
      .find({ studentId })
      .sort({ createdAt: -1 })
      .lean();
  }
}
