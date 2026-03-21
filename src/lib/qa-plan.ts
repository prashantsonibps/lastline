import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { config } from "@/lib/config";
import type { ChangedFile, PullRequestRef, QaTask, RepoRef } from "@/lib/types";

const qaTaskSchema = z.object({
  tasks: z
    .array(
      z.object({
        id: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-]+$/),
        title: z.string().min(1),
        goal: z.string().min(1),
        startUrl: z.string().min(1),
        steps: z.array(z.string().min(1)).min(1),
        expected: z.array(z.string().min(1)).min(1),
        actions: z
          .array(
            z.discriminatedUnion("type", [
              z.object({ type: z.literal("goto"), url: z.string().min(1) }),
              z.object({ type: z.literal("click"), selector: z.string().min(1) }),
              z.object({
                type: z.literal("fill"),
                selector: z.string().min(1),
                value: z.string(),
              }),
              z.object({
                type: z.literal("press"),
                selector: z.string().min(1),
                key: z.string().min(1),
              }),
              z.object({
                type: z.literal("waitForSelector"),
                selector: z.string().min(1),
              }),
              z.object({ type: z.literal("waitForText"), text: z.string().min(1) }),
              z.object({ type: z.literal("screenshot"), name: z.string().min(1) }),
              z.object({
                type: z.literal("sleep"),
                ms: z.number().int().positive().max(10000),
              }),
            ]),
          )
          .min(1),
      }),
    )
    .min(1)
    .max(5),
});

export async function generateQaPlan(input: {
  repo: RepoRef;
  pr: PullRequestRef;
  changedFiles: ChangedFile[];
}) {
  if (!config.openaiApiKey) {
    return createFallbackPlan(input.changedFiles);
  }

  const openai = createOpenAI({
    apiKey: config.openaiApiKey,
  });

  const { object } = await generateObject({
    model: openai(config.qaModel),
    schema: qaTaskSchema,
    temperature: 0.2,
    system: [
      "You create QA tasks for frontend pull requests.",
      "Return concise, deterministic tasks that can be executed by Playwright without interpretation.",
      "Prefer stable selectors like roles, labels, placeholders, and data-testid values when possible.",
      "Only cover user-visible changes.",
      "If you are uncertain, create a conservative smoke-flow task instead of inventing hidden features.",
    ].join(" "),
    prompt: [
      `Repository: ${input.repo.owner}/${input.repo.name}`,
      `PR #${input.pr.number}: ${input.pr.title}`,
      `PR body: ${input.pr.body || "(empty)"}`,
      "Changed files:",
      input.changedFiles.map((file) => `- ${file.filename}\n${file.patch ?? ""}`).join("\n"),
      "",
      "Create between 1 and 5 QA tasks.",
      "Each task must start with a goto action, use a relative URL such as / or /pricing, and include a human-readable goal.",
      "Use only these action types: goto, click, fill, press, waitForSelector, waitForText, screenshot, sleep.",
      "Use selectors that are valid Playwright locators, such as text=, [data-testid=...], role=button[name='...'], or CSS selectors.",
      "Avoid actions that require credentials unless the diff clearly adds auth flows.",
    ].join("\n"),
  });

  return object.tasks satisfies QaTask[];
}

function createFallbackPlan(changedFiles: ChangedFile[]): QaTask[] {
  const likelyRoutes = changedFiles
    .map((file) => file.filename)
    .filter((filename) => filename.includes("app/") || filename.includes("pages/"))
    .slice(0, 3);

  const primaryRoute = likelyRoutes[0]?.split("/").slice(-1)[0]?.replace(/\.(tsx|jsx|ts|js)$/, "") ?? "";
  const startUrl = primaryRoute && primaryRoute !== "page" && primaryRoute !== "index" ? `/${primaryRoute}` : "/";

  return [
    {
      id: "smoke-visual-review",
      title: "Smoke-test the changed experience",
      goal: "Load the most likely affected page and confirm the primary interface renders without obvious regressions.",
      startUrl,
      steps: [
        `Open ${startUrl}.`,
        "Wait for the page to settle.",
        "Capture a screenshot of the rendered UI.",
      ],
      expected: [
        "The page loads successfully.",
        "Primary headings, actions, and layout are visible.",
      ],
      actions: [
        { type: "goto", url: startUrl },
        { type: "sleep", ms: 1500 },
        { type: "screenshot", name: "landing-state" },
      ],
    },
  ];
}

