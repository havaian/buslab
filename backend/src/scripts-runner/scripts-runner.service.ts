import { Injectable, ConflictException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { spawn } from "child_process";
import { join } from "path";
import { ScriptRun, ScriptRunDocument } from "./schemas/script-run.schema";

@Injectable()
export class ScriptsRunnerService {
  constructor(
    @InjectModel(ScriptRun.name)
    private readonly runModel: Model<ScriptRunDocument>
  ) {}

  // ── Run ───────────────────────────────────────────────────────────────────

  async runParsePoll(): Promise<{ runId: string }> {
    // Запрещаем параллельный запуск
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

    // Запускаем асинхронно — не ждём завершения
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
        // stdin должен быть закрыт — скрипт не ожидает ввода если SESSION задан
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    const append = async (chunk: string) => {
      await this.runModel.updateOne(
        { _id: runId },
        { $set: { output: chunk } }
      );
    };

    let output = "";

    child.stdout.on("data", async (data: Buffer) => {
      output += data.toString();
      await append(output);
    });

    child.stderr.on("data", async (data: Buffer) => {
      output += data.toString();
      await append(output);
    });

    child.on("close", async (code) => {
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
