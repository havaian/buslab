/**
 * One-time migration: build StudentLog entries retroactively from existing requests.
 * Run inside the container:
 *   docker exec -it legal_clinic_backend npx ts-node -r tsconfig-paths/register src/scripts/seed-student-logs.ts
 */

import "reflect-metadata";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI || "";

const studentLogSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: { type: String, required: true },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Request",
      required: true,
    },
    details: { type: String, default: "" },
    timeSpentMinutes: { type: Number, default: null },
  },
  { timestamps: true, collection: "studentlogs" }
);

const requestSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: { type: String },
    answerText: { type: String, default: null },
    adminComment: { type: String, default: null },
    assignedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "requests" }
);

const StudentLog = mongoose.model("StudentLog", studentLogSchema);
const Request = mongoose.model("Request", requestSchema);

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected.");

  const requests = await Request.find({ studentId: { $ne: null } }).lean();
  console.log(`Found ${requests.length} requests with a student assigned.`);

  let created = 0;
  let skipped = 0;

  for (const req of requests as any[]) {
    if (!req.studentId) continue;

    const studentId = req.studentId;
    const requestId = req._id;

    // Skip if logs already exist for this request
    const existing = await StudentLog.findOne({ requestId });
    if (existing) {
      skipped++;
      continue;
    }

    const logs: any[] = [];

    // took_request
    if (req.assignedAt) {
      logs.push({
        studentId,
        action: "took_request",
        requestId,
        createdAt: req.assignedAt,
        updatedAt: req.assignedAt,
      });
    }

    // submitted_answer — has answer text and status is answered or closed
    if (
      req.answerText &&
      (req.status === "answered" || req.status === "closed")
    ) {
      const timeSpentMinutes = req.assignedAt
        ? Math.round(
            (new Date(req.updatedAt).getTime() -
              new Date(req.assignedAt).getTime()) /
              60000
          )
        : null;
      logs.push({
        studentId,
        action: "submitted_answer",
        requestId,
        timeSpentMinutes,
        createdAt: req.updatedAt,
        updatedAt: req.updatedAt,
      });
    }

    // answer_approved — closed
    if (req.status === "closed") {
      logs.push({
        studentId,
        action: "answer_approved",
        requestId,
        createdAt: req.updatedAt,
        updatedAt: req.updatedAt,
      });
    }

    // answer_rejected — has adminComment and still assigned (sent back at least once)
    if (req.status === "assigned" && req.adminComment) {
      logs.push({
        studentId,
        action: "answer_rejected",
        requestId,
        details: req.adminComment,
        createdAt: req.updatedAt,
        updatedAt: req.updatedAt,
      });
    }

    if (logs.length > 0) {
      await StudentLog.insertMany(logs);
      created += logs.length;
      console.log(
        `  [${String(requestId).slice(-6)}] status=${req.status} → ${
          logs.length
        } log(s)`
      );
    }
  }

  console.log(
    `\nDone. Created: ${created} entries. Already had logs: ${skipped} requests.`
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
