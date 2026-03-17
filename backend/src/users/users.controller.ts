import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("language") language?: string,
    @Query("status") status?: string
  ) {
    return this.usersService.findAll(
      search,
      Number(page) || 1,
      Number(limit) || 20,
      language,
      status
    );
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Get(":id/stats")
  getStats(@Param("id") id: string) {
    return this.usersService.getStats(id);
  }

  @Patch(":id/block")
  block(@Param("id") id: string) {
    return this.usersService.block(id);
  }

  @Patch(":id/unblock")
  unblock(@Param("id") id: string) {
    return this.usersService.unblock(id);
  }
}
