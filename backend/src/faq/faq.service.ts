import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Faq, FaqDocument } from "./schemas/faq.schema";

@Injectable()
export class FaqService {
  constructor(@InjectModel(Faq.name) private faqModel: Model<FaqDocument>) {}

  async findAll(search?: string) {
    const query: any = {};
    if (search) {
      query.question = { $regex: search, $options: "i" };
    }
    return this.faqModel.find(query).sort({ categoryId: 1 }).lean();
  }

  async findByCategory(categoryId: string) {
    return this.faqModel.find({ categoryId }).lean();
  }

  async create(categoryId: string, question: string, answer: string) {
    return this.faqModel.create({ categoryId, question, answer });
  }

  async update(
    id: string,
    question?: string,
    answer?: string,
    categoryId?: string
  ) {
    const faq = await this.faqModel.findById(id);
    if (!faq) throw new NotFoundException("FAQ not found");
    if (question !== undefined) faq.question = question;
    if (answer !== undefined) faq.answer = answer;
    if (categoryId !== undefined) faq.categoryId = categoryId as any;
    return faq.save();
  }

  async remove(id: string) {
    const faq = await this.faqModel.findByIdAndDelete(id);
    if (!faq) throw new NotFoundException("FAQ not found");
    return { deleted: true };
  }
}
