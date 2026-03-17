import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";

import { AuthModule } from "./auth/auth.module";
import { AdminUsersModule } from "./admin-users/admin-users.module";
import { UsersModule } from "./users/users.module";
import { RequestsModule } from "./requests/requests.module";
import { CategoriesModule } from "./categories/categories.module";
import { FaqModule } from "./faq/faq.module";
import { StatsModule } from "./stats/stats.module";
import { FilesModule } from "./files/files.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { SchedulerModule } from "./scheduler/scheduler.module";
import { StudentLogsModule } from "./student-logs/student-logs.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      process.env.MONGO_URL ||
        process.env.MONGO_URI ||
        "mongodb://localhost:27017/legal_clinic"
    ),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/static/uploads",
      serveStaticOptions: { index: false },
    }),
    NotificationsModule,
    AuthModule,
    AdminUsersModule,
    UsersModule,
    RequestsModule,
    CategoriesModule,
    FaqModule,
    StatsModule,
    FilesModule,
    SchedulerModule,
    StudentLogsModule,
  ],
})
export class AppModule {}
