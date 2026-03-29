import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { University, UniversityDocument } from "./schemas/university.schema";
import { Faculty, FacultyDocument } from "./schemas/faculty.schema";

@Injectable()
export class UniversitiesService implements OnModuleInit {
  constructor(
    @InjectModel(University.name)
    private uniModel: Model<UniversityDocument>,
    @InjectModel(Faculty.name)
    private facModel: Model<FacultyDocument>
  ) {}

  async onModuleInit() {
    const count = await this.uniModel.countDocuments();
    if (count > 0) return;

    // Seed initial universities matching bot constants
    const tsul = await this.uniModel.create({
      code: "tsul",
      names: { ru: "ТГЮУ", uz: "TDYU", en: "TSUL" },
      courses: [1, 2, 3, 4],
    });
    await this.uniModel.create({
      code: "uwed",
      names: { ru: "УМЭД", uz: "XHIMU", en: "UWED" },
      courses: [1, 2, 3, 4],
    });
    await this.uniModel.create({
      code: "wiut",
      names: { ru: "МУИТ", uz: "WIUT", en: "WIUT" },
      courses: [1, 2, 3, 4],
    });
    await this.uniModel.create({
      code: "other",
      names: { ru: "Другой", uz: "Boshqa", en: "Other" },
      courses: [1, 2, 3, 4],
    });

    // Seed TSUL faculties
    await this.facModel.insertMany([
      {
        universityId: tsul._id,
        code: "public_law",
        names: {
          ru: "Публичное право",
          uz: "Ommaviy huquq",
          en: "Public law",
        },
      },
      {
        universityId: tsul._id,
        code: "business_law",
        names: {
          ru: "Бизнес-право и судебная защита",
          uz: "Biznes huquqi va sud himoyasi",
          en: "Business law and judicial protection",
        },
      },
      {
        universityId: tsul._id,
        code: "criminal_justice",
        names: {
          ru: "Уголовное правосудие",
          uz: "Jinoiy odil sudlov",
          en: "Criminal justice",
        },
      },
      {
        universityId: tsul._id,
        code: "international_law",
        names: {
          ru: "Международное право и сравнительное правоведение",
          uz: "Xalqaro huquq va qiyosiy huquqshunoslik",
          en: "International law and comparative law",
        },
      },
      {
        universityId: tsul._id,
        code: "interdisciplinary",
        names: {
          ru: "Междисциплинарное изучение права",
          uz: "Huquqni sohalararo o'rganish",
          en: "Interdisciplinary study of law",
        },
      },
    ]);
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  async findAll(onlyActive = true): Promise<any[]> {
    const filter = onlyActive ? { active: true } : {};
    const unis = await this.uniModel.find(filter).sort({ createdAt: 1 }).lean();
    const faculties = await this.facModel
      .find(onlyActive ? { active: true } : {})
      .sort({ createdAt: 1 })
      .lean();

    return unis.map((u) => ({
      ...u,
      faculties: faculties.filter(
        (f) => String(f.universityId) === String(u._id)
      ),
    }));
  }

  async findByCode(code: string) {
    return this.uniModel.findOne({ code }).lean();
  }

  async findFacultiesByUniversity(universityId: string) {
    return this.facModel
      .find({ universityId: new Types.ObjectId(universityId), active: true })
      .lean();
  }

  // ── University CRUD ───────────────────────────────────────────────────────

  async createUniversity(data: {
    code: string;
    names: { ru: string; uz: string; en: string };
    courses?: number[];
  }) {
    const existing = await this.uniModel.findOne({ code: data.code });
    if (existing) throw new ConflictException("University code already exists");
    return this.uniModel.create(data);
  }

  async updateUniversity(
    id: string,
    data: Partial<{
      code: string;
      names: { ru: string; uz: string; en: string };
      courses: number[];
      active: boolean;
    }>
  ) {
    const u = await this.uniModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    );
    if (!u) throw new NotFoundException("University not found");
    return u;
  }

  async deleteUniversity(id: string) {
    const u = await this.uniModel.findByIdAndDelete(id);
    if (!u) throw new NotFoundException("University not found");
    await this.facModel.deleteMany({ universityId: new Types.ObjectId(id) });
    return { deleted: true };
  }

  // ── Faculty CRUD ──────────────────────────────────────────────────────────

  async createFaculty(
    universityId: string,
    data: {
      code: string;
      names: { ru: string; uz: string; en: string };
    }
  ) {
    const u = await this.uniModel.findById(universityId);
    if (!u) throw new NotFoundException("University not found");
    return this.facModel.create({
      universityId: new Types.ObjectId(universityId),
      ...data,
    });
  }

  async updateFaculty(
    universityId: string,
    facultyId: string,
    data: Partial<{
      code: string;
      names: { ru: string; uz: string; en: string };
      active: boolean;
    }>
  ) {
    const f = await this.facModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(facultyId),
        universityId: new Types.ObjectId(universityId),
      },
      { $set: data },
      { new: true }
    );
    if (!f) throw new NotFoundException("Faculty not found");
    return f;
  }

  async deleteFaculty(universityId: string, facultyId: string) {
    const f = await this.facModel.findOneAndDelete({
      _id: new Types.ObjectId(facultyId),
      universityId: new Types.ObjectId(universityId),
    });
    if (!f) throw new NotFoundException("Faculty not found");
    return { deleted: true };
  }
}
