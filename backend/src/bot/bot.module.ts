import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BotService } from "./bot.service";
import { BotUpdate } from "./bot.update";
import { BotI18nService } from "./bot-i18n.service";
import { SubmitRequestConversation } from "./conversations/submit-request.conversation";
import { User, UserSchema } from "../users/schemas/user.schema";
import {
  Category,
  CategorySchema,
} from "../categories/schemas/category.schema";
import { Faq, FaqSchema } from "../faq/schemas/faq.schema";
import { RequestsModule } from "../requests/requests.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Faq.name, schema: FaqSchema },
    ]),
    RequestsModule, // provides RequestsService via exports
  ],
  providers: [BotService, BotUpdate, BotI18nService, SubmitRequestConversation],
})
export class BotModule {}
