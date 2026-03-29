import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MiniappController } from "./miniapp.controller";
import { User, UserSchema } from "../users/schemas/user.schema";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Re-uses JwtModule exported from AuthModule
    AuthModule,
  ],
  controllers: [MiniappController],
})
export class MiniappModule {}
