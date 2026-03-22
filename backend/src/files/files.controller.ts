import { Controller, Get, Param, Res, NotFoundException } from "@nestjs/common";
import { Response } from "express";
import { existsSync } from "fs";
import { join } from "path";

// No JwtAuthGuard — file refs are UUID-based and unguessable,
// and <a download> in the browser cannot send Authorization headers.
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
