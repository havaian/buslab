/**
 * src/scripts/parse-poll-students.local.ts  [LOCAL]
 *
 * Запуск с локалки:
 *   npx ts-node -r tsconfig-paths/register src/scripts/parse-poll-students.local.ts
 *
 * .env переменные:
 *   TELEGRAM_API_ID=...
 *   TELEGRAM_API_HASH=...
 *   TELEGRAM_SESSION=...        (пусто при первом запуске)
 *   LOCAL_MONGO_URL=mongodb://localhost:27017/legal_clinic
 */

import * as dotenv from "dotenv";
dotenv.config();

import * as readline from "readline";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import mongoose from "mongoose";

// ── Конфиг ────────────────────────────────────────────────────────────────────

const API_ID = Number(process.env.TELEGRAM_API_ID ?? "0");
const API_HASH = String(process.env.TELEGRAM_API_HASH ?? "");
const SESSION = String(process.env.TELEGRAM_SESSION ?? "");
const MONGO = String(
  process.env.LOCAL_MONGO_URL ??
    process.env.MONGO_URL ??
    process.env.MONGO_URI ??
    "mongodb://localhost:27017/legal_clinic"
);

const CHAT_ID = "-1002637443124";
const POLL_UNI_FAC_MSG = 560;
const POLL_COURSE_MSG = 561;

// Telegram ID которые нужно исключить из импорта
const SKIP_IDS = new Set([8252936317]);

// ── Маппинг вариантов опроса → ObjectId'ы из БД ───────────────────────────────

const UNI_FAC_MAP: Record<string, { uniId: string; facId: string | null }> = {
  "Ommaviy huquq": {
    uniId: "69c984f927cd20596deb7c48",
    facId: "69c984fb27cd20596deb7c5e",
  },
  "Biznes huquqi va sud himoyasi": {
    uniId: "69c984f927cd20596deb7c48",
    facId: "69c984fb27cd20596deb7c5f",
  },
  "Jinoiy odil sudlov": {
    uniId: "69c984f927cd20596deb7c48",
    facId: "69c984fb27cd20596deb7c60",
  },
  "Xalqaro huquq va qiyosiy huquqshunoslik": {
    uniId: "69c984f927cd20596deb7c48",
    facId: "69c984fb27cd20596deb7c61",
  },
  "Huquqni sohalararo": {
    uniId: "69c984f927cd20596deb7c48",
    facId: "69c984fb27cd20596deb7c62",
  },
  WIUT: { uniId: "69c984fb27cd20596deb7c5a", facId: null },
  UWED: { uniId: "69c984fb27cd20596deb7c58", facId: null },
};

// ── Mongoose схема ────────────────────────────────────────────────────────────

const UserModel = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      telegramId: { type: Number, required: true, unique: true },
      role: { type: String, default: "user" },
      firstName: { type: String, default: "" },
      lastName: { type: String, default: "" },
      username: { type: String, default: "" },
      language: { type: String, default: "ru" },
      isBanned: { type: Boolean, default: false },
      offerAccepted: { type: Boolean, default: false },
      university: { type: String, default: null },
      faculty: { type: String, default: null },
      course: { type: Number, default: null },
      lastSeenSource: { type: String, default: null },
      hasUsedMiniapp: { type: Boolean, default: false },
      hasUsedPanel: { type: Boolean, default: false },
      currentAssignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
    },
    { timestamps: true, collection: "users" }
  )
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function ask(q: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((res) =>
    rl.question(q, (a) => {
      rl.close();
      res(a.trim());
    })
  );
}

function matchMapping(
  text: string
): { uniId: string; facId: string | null } | undefined {
  if (UNI_FAC_MAP[text]) return UNI_FAC_MAP[text];
  const tw = (s: string) =>
    s.trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();
  return Object.entries(UNI_FAC_MAP).find(([k]) => tw(k) === tw(text))?.[1];
}

async function getVoters(
  client: TelegramClient,
  msgId: number,
  option: Buffer
): Promise<Api.User[]> {
  const result: Api.User[] = [];
  let offset: string | undefined;
  const peer = await client.getInputEntity(CHAT_ID);
  while (true) {
    const res = await client.invoke(
      new Api.messages.GetPollVotes({
        peer,
        id: msgId,
        option,
        offset,
        limit: 50,
      })
    );
    for (const u of res.users) {
      if (u instanceof Api.User) result.push(u);
    }
    if (!res.nextOffset) break;
    offset = res.nextOffset;
  }
  return result;
}

async function getPollMsg(
  client: TelegramClient,
  msgId: number
): Promise<Api.Message> {
  const peer = await client.getInputEntity(CHAT_ID);
  const res = await client.invoke(
    new Api.channels.GetMessages({
      channel: peer,
      id: [new Api.InputMessageID({ id: msgId })],
    })
  );
  const msg = (res as Api.messages.ChannelMessages).messages[0];
  if (!(msg instanceof Api.Message))
    throw new Error(`Message ${msgId} not found`);
  return msg;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!API_ID || !API_HASH)
    throw new Error("TELEGRAM_API_ID / TELEGRAM_API_HASH не заданы");

  console.log(`MongoDB: ✅`);
  console.log("Подключаемся к Telegram...");

  const client = new TelegramClient(
    new StringSession(SESSION),
    API_ID,
    API_HASH,
    { connectionRetries: 5 }
  );
  await client.start({
    phoneNumber: () => ask("Номер телефона (с +): "),
    password: () => ask("Пароль 2FA (если есть): "),
    phoneCode: () => ask("Код из Telegram: "),
    onError: (e) => console.error("Ошибка авторизации:", e),
  });

  if (!SESSION) {
    console.log("\n✅ Сессия создана. Добавь в .env:");
    console.log(`TELEGRAM_SESSION=${String(client.session.save())}\n`);
  }

  console.log("Получаем опросы...");
  const [msgUniFac, msgCourse] = await Promise.all([
    getPollMsg(client, POLL_UNI_FAC_MSG),
    getPollMsg(client, POLL_COURSE_MSG),
  ]);

  const pollUniFac = msgUniFac.media as Api.MessageMediaPoll;
  const pollCourse = msgCourse.media as Api.MessageMediaPoll;
  if (!pollUniFac?.poll || !pollCourse?.poll)
    throw new Error("Не удалось получить опросы");

  const uniFacMap = new Map<
    number,
    {
      uniId: string;
      facId: string | null;
      firstName: string;
      lastName: string;
      username: string;
    }
  >();
  console.log("\nПарсим опрос 1 (университет/факультет)...");
  for (const answer of pollUniFac.poll.answers) {
    const text = answer.text?.text ?? "";
    const mapping = matchMapping(text);
    if (!mapping) {
      console.warn(`  ⚠️  Не найден маппинг для: "${text}"`);
      continue;
    }
    console.log(
      `  "${text}" → uni=${mapping.uniId} fac=${mapping.facId ?? "null"}`
    );
    const voters = await getVoters(client, POLL_UNI_FAC_MSG, answer.option);
    for (const u of voters) {
      if (SKIP_IDS.has(Number(u.id))) continue;
      uniFacMap.set(Number(u.id), {
        uniId: mapping.uniId,
        facId: mapping.facId,
        firstName: u.firstName ?? "",
        lastName: u.lastName ?? "",
        username: u.username ?? "",
      });
    }
    console.log(`    └─ ${voters.length} голосов`);
  }

  const courseMap = new Map<number, number>();
  console.log("\nПарсим опрос 2 (курс)...");
  for (const answer of pollCourse.poll.answers) {
    const text = answer.text?.text ?? "";
    const course = Number(text);
    if (isNaN(course) || course < 1 || course > 4) {
      console.warn(`  ⚠️  Неожиданный курс: "${text}"`);
      continue;
    }
    const voters = await getVoters(client, POLL_COURSE_MSG, answer.option);
    for (const u of voters) {
      if (SKIP_IDS.has(Number(u.id))) continue;
      courseMap.set(Number(u.id), course);
    }
    console.log(`  Курс ${course}: ${voters.length} голосов`);
  }

  await client.destroy();
  console.log("\nTelegram отключён.");

  await mongoose.connect(MONGO);
  const allIds = new Set([...uniFacMap.keys(), ...courseMap.keys()]);
  console.log(`\nВсего telegramId из опросов: ${allIds.size}`);

  let upserted = 0,
    skipped = 0;
  for (const tgId of allIds) {
    const uniFac = uniFacMap.get(tgId);
    const course = courseMap.get(tgId) ?? null;

    if (!uniFac) {
      console.warn(
        `  ⚠️  telegramId=${tgId} только в опросе курса — пропускаем`
      );
      skipped++;
      continue;
    }

    await UserModel.findOneAndUpdate(
      { telegramId: tgId },
      {
        $set: {
          role: "student",
          university: uniFac.uniId,
          faculty: uniFac.facId,
          course,
        },
        $setOnInsert: {
          firstName: uniFac.firstName,
          lastName: uniFac.lastName,
          username: uniFac.username,
        },
      },
      { upsert: true, new: true }
    );
    upserted++;
  }

  await mongoose.disconnect();

  console.log("\n═══════════════════════════════════");
  console.log("✅ Готово!");
  console.log(`   Обновлено/создано: ${upserted}`);
  console.log(`   Пропущено:         ${skipped}`);
  console.log("═══════════════════════════════════");
}

main().catch((e) => {
  console.error("Фатальная ошибка:", e);
  process.exit(1);
});
