import { Injectable, ConflictException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { spawn } from "child_process";
import { join } from "path";
import { ScriptRun, ScriptRunDocument } from "./schemas/script-run.schema";

const OUTPUT_FLUSH_MS = 500; // пишем в БД не чаще раза в 500мс

@Injectable()
export class ScriptsRunnerService {
  constructor(
    @InjectModel(ScriptRun.name)
    private readonly runModel: Model<ScriptRunDocument>
  ) {}

  // ── Run ───────────────────────────────────────────────────────────────────

  async runParsePoll(): Promise<{ runId: string }> {
    const running = await this.runModel.exists({
      script: "parse-poll",
      status: "running",
    });
    if (running) throw new ConflictException("Скрипт уже выполняется");

    const run = await this.runModel.create({
      script: "parse-poll",
      status: "running",
      output: "",
      exitCode: null,
      finishedAt: null,
    });

    this._spawn(String(run._id));

    return { runId: String(run._id) };
  }

  private _spawn(runId: string): void {
    const scriptPath = join(
      process.cwd(),
      "src/scripts/parse-poll-students.ts"
    );
    const child = spawn(
      "npx",
      ["ts-node", "-r", "tsconfig-paths/register", scriptPath],
      {
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let output = "";
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingFlush = false;

    // Fix #14: дебаунсим запись в БД — не пишем на каждый chunk stdout,
    // а максимум раз в OUTPUT_FLUSH_MS мс.
    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(async () => {
        flushTimer = null;
        pendingFlush = false;
        await this.runModel.updateOne({ _id: runId }, { $set: { output } });
      }, OUTPUT_FLUSH_MS);
    };

    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
      pendingFlush = true;
      scheduleFlush();
    });

    child.stderr.on("data", (data: Buffer) => {
      output += data.toString();
      pendingFlush = true;
      scheduleFlush();
    });

    child.on("close", async (code) => {
      // Отменяем pending дебаунс и пишем финальное состояние сразу
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      await this.runModel.updateOne(
        { _id: runId },
        {
          $set: {
            status: code === 0 ? "success" : "error",
            exitCode: code,
            finishedAt: new Date(),
            output,
          },
        }
      );
    });

    child.on("error", async (err) => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      output += `\nProcess error: ${err.message}`;
      await this.runModel.updateOne(
        { _id: runId },
        {
          $set: {
            status: "error",
            exitCode: -1,
            finishedAt: new Date(),
            output,
          },
        }
      );
    });
  }

  // ── Logs ──────────────────────────────────────────────────────────────────

  getLogs(script: string) {
    return this.runModel
      .find({ script })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  }

  getRunById(id: string) {
    return this.runModel.findById(id).lean();
  }
}
