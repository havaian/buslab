import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Category, CategoryDocument } from "./schemas/category.schema";
import { Request, RequestDocument } from "../requests/schemas/request.schema";

const ACTIVE_STATUSES = ["pending", "approved", "assigned", "answered"];

export interface LocalizedNames {
  ru: string;
  uz?: string;
  en?: string;
}

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

  async create(name: string, hashtag: string, names?: LocalizedNames) {
    const resolvedNames = {
      ru: names?.ru || name,
      uz: names?.uz || "",
      en: names?.en || "",
    };
    return this.categoryModel.create({
      name: resolvedNames.ru || name,
      hashtag,
      names: resolvedNames,
    });
  }

  async update(
    id: string,
    name?: string,
    hashtag?: string,
    names?: LocalizedNames
  ) {
    const cat = await this.categoryModel.findById(id);
    if (!cat) throw new NotFoundException("Category not found");

    if (names) {
      cat.names = {
        ru: names.ru ?? cat.names?.ru ?? "",
        uz: names.uz ?? cat.names?.uz ?? "",
        en: names.en ?? cat.names?.en ?? "",
      };
      // Keep legacy name in sync with Russian translation
      if (names.ru) cat.name = names.ru;
    } else {
      if (name !== undefined) cat.name = name;
    }

    if (hashtag !== undefined) cat.hashtag = hashtag;
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
