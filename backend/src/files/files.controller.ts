import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { existsSync } from "fs";
import { join } from "path";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("files")
export class FilesController {
  @Get(":filename")
  serveFile(@Param("filename") filename: string, @Res() res: Response) {
    if (filename.includes("..") || filename.includes("/")) {
      throw new NotFoundException();
    }
    const filePath = join(process.cwd(), "uploads", filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException("File not found");
    }
    res.sendFile(filePath);
  }
}
