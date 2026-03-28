import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Setting, SettingDocument } from "./schemas/setting.schema";

// Default texts used when no custom value has been saved yet
const DEFAULTS: Record<string, Record<string, string>> = {
  standard_rejection_text: {
    ru: "Ваше обращение не соответствует требованиям для рассмотрения. Пожалуйста, уточните вопрос и подайте заявку повторно.",
    uz: "Murojaatingiz ko'rib chiqish talablariga javob bermaydi. Iltimos, savolingizni aniqlashtiring va qaytadan murojaat qiling.",
    en: "Your request does not meet the requirements for consideration. Please clarify your question and resubmit.",
  },
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private settingModel: Model<SettingDocument>
  ) {}

  async get(key: string): Promise<Record<string, string>> {
    const doc = await this.settingModel.findOne({ key }).lean();
    return doc?.value ?? DEFAULTS[key] ?? {};
  }

  async set(
    key: string,
    value: Record<string, string>
  ): Promise<Record<string, string>> {
    await this.settingModel.findOneAndUpdate(
      { key },
      { $set: { value } },
      { upsert: true, new: true }
    );
    return value;
  }
}
