import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Request, RequestDocument } from "../requests/schemas/request.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  StudentLog,
  StudentLogDocument,
} from "../student-logs/schemas/student-log.schema";
import {
  University,
  UniversityDocument,
} from "../universities/schemas/university.schema";
import {
  Faculty,
  FacultyDocument,
} from "../universities/schemas/faculty.schema";

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(StudentLog.name)
    private studentLogModel: Model<StudentLogDocument>,
    @InjectModel(University.name) private uniModel: Model<UniversityDocument>,
    @InjectModel(Faculty.name) private facModel: Model<FacultyDocument>
  ) {}

  async getDashboard() {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      total,
      pending,
      inProgress,
      closed,
      today,
      week,
      month,
      byCategory,
      byStatus,
      activeStudents,
      byUniversityRaw,
      byFacultyRaw,
      byCourseRaw,
    ] = await Promise.all([
      this.requestModel.countDocuments(),
      this.requestModel.countDocuments({ status: "pending" }),
      this.requestModel.countDocuments({ status: "assigned" }),
      this.requestModel.countDocuments({ status: "closed" }),
      this.requestModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      this.requestModel.countDocuments({ createdAt: { $gte: startOfWeek } }),
      this.requestModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
      this.requestModel.aggregate([
        { $group: { _id: "$categoryId", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        { $project: { name: "$category.name", count: 1 } },
        { $sort: { count: -1 } },
      ]),
      this.requestModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.requestModel.distinct("studentId", { status: "assigned" }),
      this.userModel.aggregate([
        { $match: { university: { $ne: null } } },
        { $group: { _id: "$university", count: { $sum: 1 } } },
      ]),
      this.userModel.aggregate([
        { $match: { faculty: { $ne: null } } },
        { $group: { _id: "$faculty", count: { $sum: 1 } } },
      ]),
      this.userModel.aggregate([
        { $match: { course: { $ne: null } } },
        { $group: { _id: "$course", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const byDay = await this.requestModel.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Resolve university names
    const uniIds = byUniversityRaw.map((u: any) => u._id).filter(Boolean);
    const unis = await this.uniModel
      .find({ _id: { $in: uniIds } })
      .select("names")
      .lean();
    const uniMap = Object.fromEntries(
      unis.map((u) => [String(u._id), (u.names as any).ru ?? ""])
    );
    const byUniversity = byUniversityRaw.map((u: any) => ({
      _id: String(u._id),
      name: uniMap[String(u._id)] ?? "Неизвестно",
      count: u.count,
    }));

    // Resolve faculty names
    const facIds = byFacultyRaw.map((f: any) => f._id).filter(Boolean);
    const facs = await this.facModel
      .find({ _id: { $in: facIds } })
      .select("names")
      .lean();
    const facMap = Object.fromEntries(
      facs.map((f) => [String(f._id), (f.names as any).ru ?? ""])
    );
    const byFaculty = byFacultyRaw.map((f: any) => ({
      _id: String(f._id),
      name: facMap[String(f._id)] ?? "Неизвестно",
      count: f.count,
    }));

    const byCourse = byCourseRaw.map((c: any) => ({
      course: c._id as number,
      count: c.count as number,
    }));

    return {
      totals: { total, pending, inProgress, closed },
      periods: { today, week, month },
      activeStudents: activeStudents.length,
      charts: { byDay, byCategory, byStatus },
      users: { byUniversity, byFaculty, byCourse },
    };
  }

  async getStudentsSummary() {
    const students = await this.userModel.find({ role: "student" }).lean();

    const summary = await Promise.all(
      students.map(async (s) => {
        const sid = new Types.ObjectId(String(s._id));
        const logs = await this.studentLogModel.find({ studentId: sid }).lean();

        const submitted = logs.filter(
          (l) => l.action === "submitted_answer"
        ).length;
        const approved = logs.filter(
          (l) => l.action === "answer_approved"
        ).length;
        const rejected = logs.filter(
          (l) => l.action === "answer_rejected"
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

        const active = await this.requestModel.findOne({
          studentId: sid,
          status: "assigned",
        });
        const overdue =
          active && active.timerDeadline && active.timerDeadline < new Date();
        const currentStatus = !active ? "free" : overdue ? "overdue" : "busy";

        return {
          id: String(s._id),
          firstName: s.firstName,
          lastName: s.lastName,
          username: s.username,
          university: s.university ?? null,
          faculty: s.faculty ?? null,
          course: s.course ?? null,
          submitted,
          approved,
          rejected,
          approvalRate,
          avgTime,
          expired,
          currentStatus,
        };
      })
    );

    return summary;
  }
}
