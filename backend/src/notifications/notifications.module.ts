import { Module, Global } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

// Global so any module can inject NotificationsService without re-importing
@Global()
@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
