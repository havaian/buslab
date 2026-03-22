import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";

@UseGuards(JwtAuthGuard)
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.categoriesService.findById(id);
  }

  @UseGuards(RolesGuard)
  @Roles("admin")
  @Post()
  create(
    @Body("name") name: string,
    @Body("hashtag") hashtag: string,
    @Body("names") names?: { ru: string; uz?: string; en?: string }
  ) {
    return this.categoriesService.create(name, hashtag, names);
  }

  @UseGuards(RolesGuard)
  @Roles("admin")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body("name") name?: string,
    @Body("hashtag") hashtag?: string,
    @Body("names") names?: { ru: string; uz?: string; en?: string }
  ) {
    return this.categoriesService.update(id, name, hashtag, names);
  }

  @UseGuards(RolesGuard)
  @Roles("admin")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.categoriesService.remove(id);
  }
}
