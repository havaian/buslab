import { Context } from "grammy";

/** Extended Grammy context - adds locale to every update. */
export interface BotContext extends Context {
  locale: string;
}
