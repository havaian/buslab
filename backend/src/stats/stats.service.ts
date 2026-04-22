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

    // ── Оценки граждан ───────────────────────────────────────────────────
    // Три параллельных агрегата по Request с фильтром:
    //   status: "closed", ratedAt != null, rating ∈ [1..5]
    // Только финально подтверждённые оценки (черновики игнорируются).
    const ratingMatch = {
      status: "closed",
      ratedAt: { $ne: null },
      rating: { $gte: 1, $lte: 5 },
    };

    const [ratingOverallRaw, ratingDistRaw, ratingTopRaw] = await Promise.all([
      // 1) Общая статистика по оценкам
      this.requestModel.aggregate([
        { $match: ratingMatch },
        {
          $group: {
            _id: null,
            avg: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
      ]),
      // 2) Распределение по звёздам (1..5)
      this.requestModel.aggregate([
        { $match: ratingMatch },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
      ]),
      // 3) Топ студентов по средней оценке. Порог count >= 3.
      //    $lookup сразу подтягивает имя и username студента.
      this.requestModel.aggregate([
        { $match: ratingMatch },
        {
          $group: {
            _id: "$studentId",
            avg: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gte: 3 } } },
        { $sort: { avg: -1, count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            avg: 1,
            count: 1,
            firstName: "$student.firstName",
            lastName: "$student.lastName",
            username: "$student.username",
          },
        },
      ]),
    ]);

    // Для "процент оценённых" нам нужно общее число закрытых — оно уже посчитано
    // выше как `closed` через countDocuments({ status: "closed" }).
    const ratingCount: number = ratingOverallRaw[0]?.count ?? 0;
    const ratingAvg: number | null =
      ratingCount > 0 ? Math.round(ratingOverallRaw[0].avg * 10) / 10 : null;
    const ratedShare: number =
      closed > 0 ? Math.round((ratingCount / closed) * 100) : 0;

    // Нормализуем распределение — всегда 5 точек, даже если некоторые пустые
    const distMap = new Map<number, number>(
      ratingDistRaw.map((r: any) => [r._id as number, r.count as number])
    );
    const ratingDistribution = [1, 2, 3, 4, 5].map((star) => ({
      star,
      count: distMap.get(star) ?? 0,
    }));

    const ratingTop = ratingTopRaw.map((r: any) => ({
      _id: String(r._id),
      avg: Math.round(r.avg * 10) / 10,
      count: r.count as number,
      firstName: r.firstName ?? "",
      lastName: r.lastName ?? "",
      username: r.username ?? null,
    }));

    return {
      totals: { total, pending, inProgress, closed },
      periods: { today, week, month },
      activeStudents: activeStudents.length,
      charts: { byDay, byCategory, byStatus },
      users: { byUniversity, byFaculty, byCourse },
      ratings: {
        avg: ratingAvg,
        count: ratingCount,
        ratedShare, // % закрытых обращений, получивших подтверждённую оценку
        distribution: ratingDistribution,
        top: ratingTop,
      },
    };
  }

  async getStudentsSummary() {
    const students = await this.userModel
      .find({ role: "student" })
      .select("_id firstName lastName username university faculty course")
      .lean();

    const ids = students.map((s) => s._id);

    // Один агрегат на все логи всех студентов
    const logStats = await this.studentLogModel.aggregate([
      { $match: { studentId: { $in: ids } } },
      {
        $group: {
          _id: "$studentId",
          submitted: {
            $sum: { $cond: [{ $eq: ["$action", "submitted_answer"] }, 1, 0] },
          },
          approved: {
            $sum: { $cond: [{ $eq: ["$action", "answer_approved"] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$action", "answer_rejected"] }, 1, 0] },
          },
          expired: {
            $sum: { $cond: [{ $eq: ["$action", "timer_expired"] }, 1, 0] },
          },
          // avgTime — считаем сумму и количество, делим потом
          timeSum: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$action", "submitted_answer"] },
                    { $gt: ["$timeSpentMinutes", 0] },
                  ],
                },
                "$timeSpentMinutes",
                0,
              ],
            },
          },
          timeCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$action", "submitted_answer"] },
                    { $gt: ["$timeSpentMinutes", 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Один запрос на все активные назначения
    const activeRequests = await this.requestModel
      .find({ status: "assigned", studentId: { $in: ids } })
      .select("studentId timerDeadline")
      .lean();

    // Строим Maps
    const logMap = new Map(logStats.map((l: any) => [String(l._id), l]));
    const activeMap = new Map(
      activeRequests.map((r) => [String(r.studentId), r])
    );

    return students.map((s) => {
      const sid = String(s._id);
      const l = logMap.get(sid);
      const submitted = l?.submitted ?? 0;
      const approved = l?.approved ?? 0;
      const rejected = l?.rejected ?? 0;
      const expired = l?.expired ?? 0;
      const avgTime =
        l?.timeCount > 0 ? Math.round(l.timeSum / l.timeCount) : 0;
      const approvalRate =
        submitted > 0 ? Math.round((approved / submitted) * 100) : 0;

      const active = activeMap.get(sid);
      const overdue =
        active?.timerDeadline && active.timerDeadline < new Date();
      const currentStatus = !active ? "free" : overdue ? "overdue" : "busy";

      return {
        id: sid,
        firstName: s.firstName,
        lastName: s.lastName,
        username: s.username,
        university: (s as any).university ?? null,
        faculty: (s as any).faculty ?? null,
        course: (s as any).course ?? null,
        submitted,
        approved,
        rejected,
        approvalRate,
        avgTime,
        expired,
        currentStatus,
      };
    });
  }
}
