import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { Response } from "express";
import { existsSync } from "fs";
import { join } from "path";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";

const ALLOWED_LOCALES = ["ru", "uz", "en"] as const;
type AllowedLocale = (typeof ALLOWED_LOCALES)[number];

const UPLOADS_DIR = join(process.cwd(), "uploads");

const legalUploadStorage = diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, _file, cb) => {
    // filename is set after we know the locale — handled via rename in service
    cb(null, `__tmp_legal_${Date.now()}.pdf`);
  },
});

@Controller("legal")
export class LegalController {
  // In-memory cache: locale → file exists
  private readonly cache = new Map<AllowedLocale, boolean>();

  constructor() {
    // Warm up cache on startup
    for (const locale of ALLOWED_LOCALES) {
      this.cache.set(
        locale,
        existsSync(join(UPLOADS_DIR, `legal_${locale}.pdf`))
      );
    }
  }

  // ── Public ────────────────────────────────────────────────────────────────

  /** Returns which locales have an uploaded legal document. */
  @Get()
  getInfo(): Record<AllowedLocale, boolean> {
    return {
      ru: this.cache.get("ru") ?? false,
      uz: this.cache.get("uz") ?? false,
      en: this.cache.get("en") ?? false,
    };
  }

  /** Streams the legal PDF for a given locale. No auth required. */
  @Get(":locale/file")
  getFile(@Param("locale") locale: string, @Res() res: Response) {
    if (!ALLOWED_LOCALES.includes(locale as AllowedLocale)) {
      throw new NotFoundException("Locale not found");
    }
    const filePath = join(UPLOADS_DIR, `legal_${locale}.pdf`);
    if (!existsSync(filePath)) {
      throw new NotFoundException("Document not uploaded yet");
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="legal_${locale}.pdf"`
    );
    res.sendFile(filePath);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  /** Uploads (replaces) the legal PDF for a given locale. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(":locale")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: legalUploadStorage,
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === "application/pdf") {
          cb(null, true);
        } else {
          cb(new BadRequestException("Only PDF files are allowed"), false);
        }
      },
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    })
  )
  async upload(
    @Param("locale") locale: string,
    @UploadedFile() file: Express.Multer.File
  ): Promise<{ ok: boolean }> {
    if (!ALLOWED_LOCALES.includes(locale as AllowedLocale)) {
      throw new NotFoundException("Locale not found");
    }
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const { renameSync } = await import("fs");
    const targetPath = join(UPLOADS_DIR, `legal_${locale}.pdf`);

    // Replace existing file atomically
    renameSync(file.path, targetPath);

    // Update cache
    this.cache.set(locale as AllowedLocale, true);

    return { ok: true };
  }
}
