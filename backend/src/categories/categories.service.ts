import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Category, CategoryDocument } from "./schemas/category.schema";
import { Request, RequestDocument } from "../requests/schemas/request.schema";
import { RequestStatus } from "../common/enums/request-status.enum";

const ACTIVE_STATUSES = [
  RequestStatus.PENDING,
  RequestStatus.APPROVED,
  RequestStatus.IN_PROGRESS,
  RequestStatus.ANSWER_REVIEW,
];

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Request.name) private requestModel: Model<RequestDocument>
  ) {}

  async findAll() {
    return this.categoryModel.find().sort({ name: 1 }).lean();
  }

  async findById(id: string) {
    const cat = await this.categoryModel.findById(id).lean();
    if (!cat) throw new NotFoundException("Category not found");
    return cat;
  }

  async create(name: string, description?: string) {
    return this.categoryModel.create({ name, description: description || "" });
  }

  async update(id: string, name?: string, description?: string) {
    const cat = await this.categoryModel.findById(id);
    if (!cat) throw new NotFoundException("Category not found");
    if (name !== undefined) cat.name = name;
    if (description !== undefined) cat.description = description;
    return cat.save();
  }

  async remove(id: string) {
    const cat = await this.categoryModel.findById(id);
    if (!cat) throw new NotFoundException("Category not found");

    const activeCount = await this.requestModel.countDocuments({
      categoryId: id,
      status: { $in: ACTIVE_STATUSES },
    });
    if (activeCount > 0) {
      throw new BadRequestException(
        "Cannot delete category: it is used in active requests"
      );
    }

    await this.categoryModel.findByIdAndDelete(id);
    return { deleted: true };
  }
}
