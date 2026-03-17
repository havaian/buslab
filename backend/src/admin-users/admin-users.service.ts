import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Request, RequestDocument } from "../requests/schemas/request.schema";
import {
  StudentLog,
  StudentLogDocument,
} from "../student-logs/schemas/student-log.schema";

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(StudentLog.name)
    private studentLogModel: Model<StudentLogDocument>,
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>
  ) {}

  async findStudents() {
    return this.userModel.find({ role: "student" }).lean();
  }

  async findFreeStudents() {
    const busyIds = await this.requestModel
      .find({ status: "assigned" })
      .distinct("studentId");
    return this.userModel
      .find({ role: "student", isBanned: false, _id: { $nin: busyIds } })
      .lean();
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).lean();
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async block(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException("User not found");
    if (user.role === "admin")
      throw new BadRequestException("Cannot ban an admin");
    user.isBanned = true;
    return user.save();
  }

  async unblock(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException("User not found");
    user.isBanned = false;
    return user.save();
  }

  async getStudentStats(studentId: string) {
    const sid = new Types.ObjectId(studentId);
    const logs = await this.studentLogModel.find({ studentId: sid }).lean();

    const total = logs.filter((l) => l.action === "took_request").length;
    const submitted = logs.filter(
      (l) => l.action === "submitted_answer"
    ).length;
    const approved = logs.filter((l) => l.action === "answer_approved").length;
    const rejected = logs.filter((l) => l.action === "answer_rejected").length;
    const declines = logs.filter((l) => l.action === "declined_request").length;
    const unassigned = logs.filter(
      (l) => l.action === "unassigned_by_admin"
    ).length;
    const expired = logs.filter((l) => l.action === "timer_expired").length;

    const timeLogs = logs.filter(
      (l) => l.action === "submitted_answer" && l.timeSpentMinutes
    );
    const avgTime =
      timeLogs.length > 0
        ? Math.round(
            timeLogs.reduce((a, b) => a + (b.timeSpentMinutes || 0), 0) /
              timeLogs.length
          )
        : 0;

    const approvalRate =
      submitted > 0 ? Math.round((approved / submitted) * 100) : 0;
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
    const sid = new Types.ObjectId(studentId);
    return this.studentLogModel
      .find({ studentId: sid })
      .sort({ createdAt: -1 })
      .lean();
  }
}
    