import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import { Request, RequestDocument } from "../requests/schemas/request.schema";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>
  ) {}

  async findAll(
    search?: string,
    page = 1,
    limit = 20,
    language?: string,
    status?: string
  ) {
    const query: any = { role: "user" };

    if (search) {
      // Check if search is a telegramId (numeric)
      const numericSearch = Number(search);
      if (!isNaN(numericSearch) && String(numericSearch) === search) {
        query.telegramId = numericSearch;
      } else {
        query.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
        ];
      }
    }

    if (language) query.language = language;
    if (status === "banned") query.isBanned = true;
    if (status === "active") query.isBanned = false;

    const [users, total] = await Promise.all([
      this.userModel
        .find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      this.userModel.countDocuments(query),
    ]);
    return { users, total, page, limit };
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).lean();
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async getStats(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new NotFoundException("User not found");

    const [total, closed, rejected] = await Promise.all([
      this.requestModel.countDocuments({ userId: user._id }),
      this.requestModel.countDocuments({ userId: user._id, status: "closed" }),
      this.requestModel.countDocuments({
        userId: user._id,
        status: "declined",
      }),
    ]);

    const history = await this.requestModel
      .find({ userId: user._id })
      .sort({ createdAt: -1 })
      .select("_id status createdAt categoryId text")
      .lean();

    return { user, stats: { total, closed, rejected }, history };
  }

  async block(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException("User not found");
    user.isBanned = true;
    return user.save();
  }

  async unblock(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException("User not found");
    user.isBanned = false;
    return user.save();
  }
}
