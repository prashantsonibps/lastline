import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createManualReviewJob } from "@/lib/review-jobs-store";
import { executeReviewJob } from "@/lib/review-orchestrator";

const manualRunSchema = z.object({
  repo: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
    cloneUrl: z.string().url(),
  }),
  pr: z.object({
    number: z.number().int().positive(),
    title: z.string().min(1),
    body: z.string().default(""),
    headRef: z.string().min(1),
    baseRef: z.string().min(1),
    headSha: z.string().min(1),
  }),
  changedFiles: z
    .array(
      z.object({
        filename: z.string().min(1),
        patch: z.string().optional(),
        status: z.string().min(1),
      }),
    )
    .default([]),
});

export async function POST(request: NextRequest) {
  const body = manualRunSchema.parse(await request.json());
  const job = await createManualReviewJob(body);
  void executeReviewJob(job.id);

  return NextResponse.json({
    accepted: true,
    jobId: job.id,
  });
}

