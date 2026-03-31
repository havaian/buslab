/**
 * src/scripts/parse-poll-students.ts
 *
 * Парсит голосовавших в двух опросах студенческой группы через MTProto (GramJS),
 * матчит на университет/факультет/курс и upsert-ит записи в MongoDB.
 *
 * Запуск:
 *   npm run parse-poll
 *
 * Первый запуск — интерактивная авторизация (телефон + код).
 * Сессия сохраняется в TELEGRAM_SESSION (выводится в конце — скопируй в .env).
 *
 * Зависимости (установить в корне монорепо или в backend/):
 *   npm install telegram input
 */

import "dotenv/config";
import * as readline from "readline";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import mongoose from "mongoose";

// ── Конфиг ────────────────────────────────────────────────────────────────────

const API_ID = Number(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH ?? "";
const SESSION_STRING = process.env.TELEGRAM_SESSION ?? "";
const MONGODB_URI = process.env.MONGODB_URI ?? "";

// Chat ID: ссылка t.me/c/2637443124/... → GramJS EntityLike строка с префиксом -100
const STUDENT_CHAT_ID = "-1002637443124";

const POLL_UNI_FAC_MSG_ID = 560; // опрос "Fakultetingiz | Universitetingiz"
const POLL_COURSE_MSG_ID = 561; // опрос "Kursingiz"

// ── Маппинг вариантов опроса → IDs из БД ─────────────────────────────────────
// Ключи — точные строки из Telegram-опроса (uz)
// Символ в "o'rganish" — типографская кавычка U+2019, скопирована из скриншота

const FACULTY_POLL_MAP: Record<
  string,
  { uniId: string; facId: string | null }
> = {
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
  "Huquqni sohalararo o\u2019rganish": {
    uniId: "69c984f927cd20596deb7c48",
    facId: "69c984fb27cd20596deb7c62",
  },
  WIUT: { uniId: "69c984fb27cd20596deb7c5a", facId: null },
  UWED: { uniId: "69c984fb27cd20596deb7c58", facId: null },
};

// ── Mongoose (минимальная схема — только нужные поля) ─────────────────────────

const UserSchema = new mongoose.Schema(
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
);

const UserModel = mongoose.model("User", UserSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Получает всех проголосовавших за конкретный вариант опроса.
 * GramJS возвращает max ~50 за раз — пагинируем через offset.
 */
async function getPollVoters(
  client: TelegramClient,
  chatId: string,
  msgId: number,
  option: Buffer // bytes варианта ответа
): Promise<Api.TypeUser[]> {
  const voters: Api.TypeUser[] = [];
  let offset = "";

  while (true) {
    const result = await client.invoke(
      new Api.messages.GetPollVotes({
        peer: await client.getInputEntity(chatId),
        id: msgId,
        option,
        offset: offset || undefined,
        limit: 50,
      })
    );

    voters.push(...result.users);

    if (!result.nextOffset) break;
    offset = result.nextOffset;
  }

  return voters;
}

/**
 * Получает объект Message с опросом — нужен для извлечения bytes вариантов.
 */
async function getPollMessage(
  client: TelegramClient,
  chatId: string,
  msgId: number
): Promise<Api.Message> {
  const result = await client.invoke(
    new Api.channels.GetMessages({
      channel: await client.getInputEntity(chatId),
      id: [new Api.InputMessageID({ id: msgId })],
    })
  );

  const messages = (result as Api.messages.ChannelMessages).messages;
  const msg = messages[0];
  if (!(msg instanceof Api.Message))
    throw new Error(`Message ${msgId} not found`);
  return msg;
}

// ── Основная логика ───────────────────────────────────────────────────────────

async function main() {
  if (!API_ID || !API_HASH) {
    throw new Error("TELEGRAM_API_ID и TELEGRAM_API_HASH не заданы в .env");
  }
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI не задан в .env");
  }

  // ── Авторизация GramJS ──────────────────────────────────────────────────────
  console.log("Подключаемся к Telegram (MTProto)...");
  const session = new StringSession(SESSION_STRING);
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => prompt("Номер телефона (с +): "),
    password: async () => prompt("Пароль 2FA (если есть): "),
    phoneCode: async () => prompt("Код из Telegram: "),
    onError: (err) => console.error("Ошибка авторизации:", err),
  });

  const savedSession = client.session.save() as unknown as string;
  if (!SESSION_STRING) {
    console.log("\n✅ Сессия создана. Добавь в .env:");
    console.log(`TELEGRAM_SESSION="${savedSession}"\n`);
  }

  // ── Получаем опросы ─────────────────────────────────────────────────────────
  console.log("Получаем опросы...");
  const [msgUniFac, msgCourse] = await Promise.all([
    getPollMessage(client, STUDENT_CHAT_ID, POLL_UNI_FAC_MSG_ID),
    getPollMessage(client, STUDENT_CHAT_ID, POLL_COURSE_MSG_ID),
  ]);

  const pollUniFac = msgUniFac.media as Api.MessageMediaPoll;
  const pollCourse = msgCourse.media as Api.MessageMediaPoll;

  if (!pollUniFac?.poll || !pollCourse?.poll) {
    throw new Error(
      "Не удалось получить опросы — убедись что message ID верные"
    );
  }

  // ── Парсим опрос 1: универ/факультет ───────────────────────────────────────
  // Map<telegramId, { uniId, facId, firstName, lastName, username }>
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
    const optionText = answer.text?.text ?? "";
    // Матчим по первым двум словам — защита от различий в кавычках/апострофах
    const firstTwoWords = (s: string) =>
      s.trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();
    const mapping =
      FACULTY_POLL_MAP[optionText] ??
      Object.entries(FACULTY_POLL_MAP).find(
        ([key]) => firstTwoWords(key) === firstTwoWords(optionText)
      )?.[1];

    if (!mapping) {
      console.warn(
        `  ⚠️  Вариант не найден в маппинге: "${optionText}" — пропускаем`
      );
      continue;
    }

    console.log(
      `  Вариант: "${optionText}" → uniId=${mapping.uniId}, facId=${
        mapping.facId ?? "null"
      }`
    );
    const voters = await getPollVoters(
      client,
      STUDENT_CHAT_ID,
      POLL_UNI_FAC_MSG_ID,
      answer.option
    );

    for (const rawUser of voters) {
      if (!(rawUser instanceof Api.User)) continue;
      const tgId = Number(rawUser.id);
      uniFacMap.set(tgId, {
        uniId: mapping.uniId,
        facId: mapping.facId,
        firstName: rawUser.firstName ?? "",
        lastName: rawUser.lastName ?? "",
        username: rawUser.username ?? "",
      });
    }

    console.log(`    └─ ${voters.length} голосов`);
  }

  // ── Парсим опрос 2: курс ────────────────────────────────────────────────────
  // Map<telegramId, course>
  const courseMap = new Map<number, number>();

  console.log("\nПарсим опрос 2 (курс)...");
  for (const answer of pollCourse.poll.answers) {
    const optionText = answer.text?.text ?? "";
    const course = Number(optionText);

    if (isNaN(course) || course < 1 || course > 4) {
      console.warn(
        `  ⚠️  Неожиданный вариант курса: "${optionText}" — пропускаем`
      );
      continue;
    }

    const voters = await getPollVoters(
      client,
      STUDENT_CHAT_ID,
      POLL_COURSE_MSG_ID,
      answer.option
    );
    for (const rawUser of voters) {
      if (!(rawUser instanceof Api.User)) continue;
      courseMap.set(Number(rawUser.id), course);
    }

    console.log(`  Курс ${course}: ${voters.length} голосов`);
  }

  await client.disconnect();
  console.log("\nTelegram отключён.");

  // ── MongoDB upsert ──────────────────────────────────────────────────────────
  console.log("Подключаемся к MongoDB...");
  await mongoose.connect(MONGODB_URI);

  // Объединяем два Map — берём всех кто голосовал хотя бы в одном опросе
  const allTgIds = new Set([...uniFacMap.keys(), ...courseMap.keys()]);
  console.log(`\nВсего уникальных telegramId из опросов: ${allTgIds.size}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const tgId of allTgIds) {
    const uniFac = uniFacMap.get(tgId);
    const course = courseMap.get(tgId) ?? null;

    // Если нет данных по универу — пропускаем (только курс без универа бессмысленно)
    if (!uniFac) {
      console.warn(
        `  ⚠️  telegramId=${tgId} есть только в опросе курса, без универа — пропускаем`
      );
      skipped++;
      continue;
    }

    const existing = await UserModel.findOne({ telegramId: tgId });

    if (existing) {
      await UserModel.updateOne(
        { telegramId: tgId },
        {
          $set: {
            university: uniFac.uniId,
            faculty: uniFac.facId,
            course,
          },
        }
      );
      updated++;
    } else {
      await UserModel.create({
        telegramId: tgId,
        role: "student",
        firstName: uniFac.firstName,
        lastName: uniFac.lastName,
        username: uniFac.username,
        university: uniFac.uniId,
        faculty: uniFac.facId,
        course,
      });
      created++;
    }
  }

  await mongoose.disconnect();

  console.log("\n═══════════════════════════════════");
  console.log(`✅ Готово!`);
  console.log(`   Создано:  ${created}`);
  console.log(`   Обновлено: ${updated}`);
  console.log(`   Пропущено: ${skipped}`);
  console.log("═══════════════════════════════════");
}

main().catch((err) => {
  console.error("Фатальная ошибка:", err);
  process.exit(1);
});
