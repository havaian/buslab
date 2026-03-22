import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { FaqService } from "./faq.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";

@UseGuards(JwtAuthGuard)
@Controller("faq")
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  findAll(@Query("search") search?: string) {
    return this.faqService.findAll(search);
  }

  @Get("category/:categoryId")
  findByCategory(@Param("categoryId") categoryId: string) {
    return this.faqService.findByCategory(categoryId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @Body("categoryId") categoryId: string,
    @Body("question") question: string,
    @Body("answer") answer: string,
    @Body("translations") translations?: any
  ) {
    return this.faqService.create(categoryId, question, answer, translations);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body("question") question?: string,
    @Body("answer") answer?: string,
    @Body("categoryId") categoryId?: string,
    @Body("translations") translations?: any
  ) {
    return this.faqService.update(
      id,
      question,
      answer,
      categoryId,
      translations
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.faqService.remove(id);
  }
}
