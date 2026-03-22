import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Request, RequestDocument } from "../requests/schemas/request.schema";
import {
  StudentLog,
  StudentLogDocument,
} from "../student-logs/schemas/student-log.schema";
import {
  InviteToken,
  InviteTokenDocument,
} from "./schemas/invite-token.schema";

const INVITE_TTL_HOURS = 48;

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(StudentLog.name)
    private studentLogModel: Model<StudentLogDocument>,
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>,
    @InjectModel(InviteToken.name)
    private inviteModel: Model<InviteTokenDocument>
  ) {}

  // ── Students ──────────────────────────────────────────────────────────────

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

  // ── Invite tokens ─────────────────────────────────────────────────────────

  /** Generate a one-time invite link token (48h TTL). */
  async createInvite(
    adminId: string
  ): Promise<{ token: string; expiresAt: Date; link: string }> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

    await this.inviteModel.create({
      token,
      createdBy: new Types.ObjectId(adminId),
      expiresAt,
    });

    const botName = process.env.TELEGRAM_BOT_USERNAME || "";
    const link = `https://t.me/${botName}?start=ref_${token}`;

    return { token, expiresAt, link };
  }

  /**
   * Called from the bot when a user opens /start?start=ref_<token>.
   * Sets the user's role to "student" and marks the token as used.
   */
  async redeemInvite(
    token: string,
    telegramId: number
  ): Promise<{ success: boolean; alreadyStudent: boolean }> {
    const invite = await this.inviteModel.findOne({
      token,
      usedBy: null,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) return { success: false, alreadyStudent: false };

    const user = await this.userModel.findOne({ telegramId });
    if (!user) return { success: false, alreadyStudent: false };

    if (user.role === "student") {
      // Already a student — still mark token used so it can't be reused
      invite.usedBy = user._id as any;
      invite.usedAt = new Date();
      await invite.save();
      return { success: true, alreadyStudent: true };
    }

    user.role = "student";
    await user.save();

    invite.usedBy = user._id as any;
    invite.usedAt = new Date();
    await invite.save();

    return { success: true, alreadyStudent: false };
  }

  // ── User search / promote ─────────────────────────────────────────────────

  /**
   * Search users (role: user) by username or Telegram ID.
   * Used for the "promote existing user" flow.
   */
  async searchUsers(query: string): Promise<any[]> {
    if (!query || query.trim().length < 2) return [];

    const q = query.trim().replace(/^@/, "");

    // Try numeric Telegram ID first
    const numericId = Number(q);
    if (!isNaN(numericId) && String(numericId) === q) {
      return this.userModel
        .find({ telegramId: numericId, role: { $ne: "admin" } })
        .lean();
    }

    return this.userModel
      .find({
        role: { $ne: "admin" },
        $or: [
          { username: { $regex: q, $options: "i" } },
          { firstName: { $regex: q, $options: "i" } },
          { lastName: { $regex: q, $options: "i" } },
        ],
      })
      .limit(10)
      .lean();
  }

  /** Promote a user to student role. */
  async promoteToStudent(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    if (user.role === "admin")
      throw new BadRequestException("Cannot change admin role");
    user.role = "student";
    return user.save();
  }

  /** Demote a student back to user role. */
  async demoteFromStudent(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    if (user.role === "admin")
      throw new BadRequestException("Cannot change admin role");
    if (user.role !== "student")
      throw new BadRequestException("User is not a student");
    user.role = "user";
    return user.save();
  }

  // ── Stats / logs ──────────────────────────────────────────────────────────

  async getStudentStats(studentId: string) {
    if (!Types.ObjectId.isValid(studentId))
      return {
        total: 0,
        submitted: 0,
        approved: 0,
        rejected: 0,
        declines: 0,
        unassigned: 0,
        expired: 0,
        avgTime: 0,
        approvalRate: 0,
        rating: null,
      };

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

    const rating = submitted >= 3 ? approvalRate : null;

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
    if (!Types.ObjectId.isValid(studentId)) return [];
    return this.studentLogModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .sort({ createdAt: -1 })
      .lean();
  }
}
