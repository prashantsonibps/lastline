import { generateText, Output } from "ai";
import { z } from "zod";
import { getLanguageModel, hasLanguageModelAccess } from "@/lib/ai-model";
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
  const curatedPlan = createCuratedPlan(input.repo);
  if (curatedPlan) {
    return curatedPlan;
  }

  if (!hasLanguageModelAccess()) {
    return createFallbackPlan(input.changedFiles);
  }

  const { output } = await generateText({
    model: getLanguageModel(config.qaModel),
    output: Output.object({
      schema: qaTaskSchema,
    }),
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

  return normalizeQaTasks(output.tasks) satisfies QaTask[];
}

function createCuratedPlan(repo: RepoRef): QaTask[] | null {
  const normalizedRepoName = repo.name.toLowerCase();

  if (normalizedRepoName !== "spaceguard") {
    return null;
  }

  return [
    {
      id: "spaceguard-globe-smoke",
      title: "Globe Landing Smoke Test",
      goal: "Verify the live landing experience renders the top navigation, live telemetry badge, and main globe shell correctly.",
      startUrl: "/",
      steps: [
        "Open the Globe landing page.",
        "Verify the top navigation shows SPACEGUARD, GLOBE, MARKETS, and PORTFOLIO.",
        "Verify the LIVE badge is visible.",
        "Verify the theme toggle button is visible.",
        "Capture a screenshot of the landing experience.",
      ],
      expected: [
        "The landing page loads successfully.",
        "The top navigation, LIVE telemetry indicator, and theme toggle are visible.",
      ],
      actions: [
        { type: "goto", url: "/" },
        { type: "waitForText", text: "SPACEGUARD" },
        { type: "waitForSelector", selector: "a[href='/']" },
        { type: "waitForSelector", selector: "a[href='/prediction']" },
        { type: "waitForSelector", selector: "a[href='/portfolio']" },
        { type: "waitForText", text: "LIVE" },
        { type: "waitForSelector", selector: "button[title*='mode']" },
        { type: "sleep", ms: 1200 },
        { type: "screenshot", name: "globe-landing" },
      ],
    },
    {
      id: "spaceguard-markets-smoke",
      title: "Prediction Markets Smoke Test",
      goal: "Verify the Markets page opens and renders at least one live market card with YES and NO actions.",
      startUrl: "/prediction",
      steps: [
        "Open the Markets page.",
        "Verify the MARKETS tab is active.",
        "Verify at least one prediction market question is visible.",
        "Verify percentage action buttons are rendered for the market.",
        "Capture a screenshot of the rendered market list.",
      ],
      expected: [
        "The Markets page loads successfully.",
        "A prediction market card is visible with interactive pricing buttons.",
      ],
      actions: [
        { type: "goto", url: "/prediction" },
        { type: "waitForSelector", selector: "a[href='/prediction']" },
        { type: "waitForText", text: "Will ISS" },
        { type: "waitForText", text: "YES" },
        { type: "waitForText", text: "NO" },
        { type: "waitForSelector", selector: "button:has-text('%')" },
        { type: "sleep", ms: 1000 },
        { type: "screenshot", name: "markets-view" },
      ],
    },
    {
      id: "spaceguard-portfolio-smoke",
      title: "Portfolio Smoke Test",
      goal: "Verify the Portfolio page opens, shows its primary heading, and begins loading account content.",
      startUrl: "/portfolio",
      steps: [
        "Open the Portfolio page.",
        "Verify the PORTFOLIO heading is visible.",
        "Verify the loading profile data state or initial content area is visible.",
        "Capture a screenshot of the portfolio view.",
      ],
      expected: [
        "The Portfolio page loads successfully.",
        "The primary PORTFOLIO heading and initial portfolio content state are visible.",
      ],
      actions: [
        { type: "goto", url: "/portfolio" },
        { type: "waitForSelector", selector: "a[href='/portfolio']" },
        { type: "waitForSelector", selector: "h1:has-text('PORTFOLIO')" },
        { type: "waitForText", text: "Loading profile data" },
        { type: "sleep", ms: 800 },
        { type: "screenshot", name: "portfolio-view" },
      ],
    },
  ];
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
        "Wait for at least one heading or prominent text block to appear.",
        "Capture a screenshot of the rendered UI.",
      ],
      expected: [
        "The page loads successfully.",
        "Prominent content and primary layout are visible.",
      ],
      actions: [
        { type: "goto", url: startUrl },
        { type: "sleep", ms: 1500 },
        { type: "waitForSelector", selector: "h1, h2, main, nav" },
        { type: "screenshot", name: "landing-state" },
      ],
    },
  ];
}

function normalizeQaTasks(tasks: QaTask[]) {
  return tasks.map((task) => ({
    ...task,
    startUrl: normalizeUrl(task.startUrl),
    actions: task.actions.map((action) =>
      action.type === "goto"
        ? {
            ...action,
            url: normalizeUrl(action.url),
          }
        : action,
    ),
  }));
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "/";
  }

  if (trimmed.startsWith("/")) {
    return trimmed.replace(/\s+/g, "");
  }

  try {
    const parsed = new URL(trimmed);
    const nextPath = `${parsed.pathname || "/"}${parsed.search}${parsed.hash}`.trim();
    return nextPath || "/";
  } catch {
    return trimmed;
  }
}
