import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
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

  async findAll(search?: string, page = 1, limit = 20) {
    const query: any = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }
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
      this.requestModel.countDocuments({ telegramUserId: user.telegramId }),
      this.requestModel.countDocuments({
        telegramUserId: user.telegramId,
        status: "closed",
      }),
      this.requestModel.countDocuments({
        telegramUserId: user.telegramId,
        status: "rejected",
      }),
    ]);

    const history = await this.requestModel
      .find({ telegramUserId: user.telegramId })
      .sort({ createdAt: -1 })
      .select("_id status createdAt categoryId text")
      .lean();

    return { user, stats: { total, closed, rejected }, history };
  }

  async block(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException("User not found");
    user.isBlocked = true;
    return user.save();
  }

  async unblock(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException("User not found");
    user.isBlocked = false;
    return user.save();
  }
}
