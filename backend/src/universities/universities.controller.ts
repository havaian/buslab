import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from "@nestjs/common";
import { UniversitiesService } from "./universities.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";

@Controller("universities")
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  // ── Public - used by bot and frontend dropdowns ───────────────────────────

  @Get()
  findAll(@Query("admin") admin?: string): Promise<any[]> {
    // Pass admin=1 to get inactive too - but only admins would know to do this
    return this.universitiesService.findAll(admin !== "1");
  }

  // ── Admin write operations ────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @Body("code") code: string,
    @Body("names") names: { ru: string; uz: string; en: string },
    @Body("courses") courses?: number[]
  ) {
    return this.universitiesService.createUniversity({ code, names, courses });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body()
    body: {
      code?: string;
      names?: { ru: string; uz: string; en: string };
      courses?: number[];
      active?: boolean;
    }
  ) {
    return this.universitiesService.updateUniversity(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.universitiesService.deleteUniversity(id);
  }

  // ── Faculty CRUD ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(":id/faculties")
  createFaculty(
    @Param("id") id: string,
    @Body("code") code: string,
    @Body("names") names: { ru: string; uz: string; en: string }
  ) {
    return this.universitiesService.createFaculty(id, { code, names });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id/faculties/:facId")
  updateFaculty(
    @Param("id") id: string,
    @Param("facId") facId: string,
    @Body()
    body: {
      code?: string;
      names?: { ru: string; uz: string; en: string };
      active?: boolean;
    }
  ) {
    return this.universitiesService.updateFaculty(id, facId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(":id/faculties/:facId")
  deleteFaculty(@Param("id") id: string, @Param("facId") facId: string) {
    return this.universitiesService.deleteFaculty(id, facId);
  }
}
