export type ChangedFile = {
  filename: string;
  status: string;
  patch?: string;
};

export type PullRequestRef = {
  number: number;
  title: string;
  body: string;
  headRef: string;
  baseRef: string;
  headSha: string;
  url?: string;
};

export type RepoRef = {
  owner: string;
  name: string;
  cloneUrl: string;
  defaultBranch?: string;
};

export type CommandSpec = {
  command: string;
  args: string[];
};

export type ReviewRuntimeConfig = {
  appDirectory?: string;
  installCommand?: CommandSpec;
  startCommand?: CommandSpec;
  env?: Record<string, string>;
  startTimeoutMs?: number;
};

export type ReviewJobStatus =
  | "queued"
  | "planning"
  | "testing"
  | "video_ready"
  | "awaiting_feedback"
  | "creating_issues"
  | "done"
  | "failed"
  | "ignored"
  | "running"
  | "completed";

export type QaAction =
  | { type: "goto"; url: string }
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string }
  | { type: "press"; selector: string; key: string }
  | { type: "waitForSelector"; selector: string }
  | { type: "waitForText"; text: string }
  | { type: "screenshot"; name: string }
  | { type: "sleep"; ms: number };

export type QaTask = {
  id: string;
  title: string;
  goal: string;
  steps: string[];
  expected: string[];
  startUrl: string;
  actions: QaAction[];
};

export type ReviewArtifact = {
  taskId: string;
  introCardPath: string;
  videoPath: string;
};

export type ReviewArtifacts = {
  taskArtifacts: ReviewArtifact[];
  finalVideoPath?: string;
  finalVideoUrl?: string;
};

export type TelegramActionId = "report_bug" | "add_another" | "create_issues";

export type TelegramBinding = {
  chatId: string;
  deliveryMessageId: string;
  threadId?: string;
  lastPromptMessageId?: string;
};

export type FeedbackConversationState =
  | {
      step: "idle";
    }
  | {
      step: "awaiting_timestamp";
    }
  | {
      step: "awaiting_description";
      timestampInput: string;
      timestampSeconds: number;
    };

export type ScreenshotArtifact = {
  timestampSeconds: number;
  status: "ready" | "failed";
  assetUrl?: string;
  error?: string;
};

export type CreatedIssueRef = {
  findingId: string;
  issueNumber: number;
  issueUrl: string;
  title: string;
};

export type FeedbackFinding = {
  id: string;
  createdAt: string;
  timestampInput: string;
  timestampSeconds: number;
  description: string;
  screenshot?: ScreenshotArtifact;
  issue?: CreatedIssueRef;
};

export type FeedbackState = {
  delivery?: {
    deliveredAt: string;
    summary: string;
    videoUrl: string;
  };
  telegram?: TelegramBinding;
  conversation: FeedbackConversationState;
  findings: FeedbackFinding[];
  screenshotsByTimestamp: Record<string, ScreenshotArtifact>;
  createdIssues: CreatedIssueRef[];
};

export type ReviewJob = {
  id: string;
  repo: RepoRef;
  pr: PullRequestRef;
  changedFiles: ChangedFile[];
  runtime: ReviewRuntimeConfig;
  status: ReviewJobStatus;
  tasks: QaTask[];
  createdAt: string;
  updatedAt: string;
  workspaceDir: string;
  outputDir: string;
  logs: string[];
  error?: string;
  artifacts?: ReviewArtifacts;
  feedback?: FeedbackState;
};
