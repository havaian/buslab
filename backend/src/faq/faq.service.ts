import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Faq, FaqDocument } from "./schemas/faq.schema";

export interface FaqTranslations {
  ru?: { question: string; answer: string };
  uz?: { question: string; answer: string };
  en?: { question: string; answer: string };
}

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

  async create(
    categoryId: string,
    question: string,
    answer: string,
    translations?: FaqTranslations
  ) {
    const resolvedTranslations = {
      ru: {
        question: translations?.ru?.question || question,
        answer: translations?.ru?.answer || answer,
      },
      uz: {
        question: translations?.uz?.question || "",
        answer: translations?.uz?.answer || "",
      },
      en: {
        question: translations?.en?.question || "",
        answer: translations?.en?.answer || "",
      },
    };
    return this.faqModel.create({
      categoryId,
      question: resolvedTranslations.ru.question || question,
      answer: resolvedTranslations.ru.answer || answer,
      translations: resolvedTranslations,
    });
  }

  async update(
    id: string,
    question?: string,
    answer?: string,
    categoryId?: string,
    translations?: FaqTranslations
  ) {
    const faq = await this.faqModel.findById(id);
    if (!faq) throw new NotFoundException("FAQ not found");

    if (translations) {
      faq.translations = {
        ru: {
          question:
            translations.ru?.question ?? faq.translations?.ru?.question ?? "",
          answer: translations.ru?.answer ?? faq.translations?.ru?.answer ?? "",
        },
        uz: {
          question:
            translations.uz?.question ?? faq.translations?.uz?.question ?? "",
          answer: translations.uz?.answer ?? faq.translations?.uz?.answer ?? "",
        },
        en: {
          question:
            translations.en?.question ?? faq.translations?.en?.question ?? "",
          answer: translations.en?.answer ?? faq.translations?.en?.answer ?? "",
        },
      };
      // Keep legacy fields in sync with Russian
      if (translations.ru?.question) faq.question = translations.ru.question;
      if (translations.ru?.answer) faq.answer = translations.ru.answer;
    } else {
      if (question !== undefined) faq.question = question;
      if (answer !== undefined) faq.answer = answer;
    }

    if (categoryId !== undefined) faq.categoryId = categoryId as any;
    return faq.save();
  }

  async remove(id: string) {
    const faq = await this.faqModel.findByIdAndDelete(id);
    if (!faq) throw new NotFoundException("FAQ not found");
    return { deleted: true };
  }
}
