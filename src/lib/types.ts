export type ChangedFile = {
  filename: string;
  status: string;
  patch?: string;
};

export type PullRequestRef = {
  number: number;
  title: string;
  body: string;
  url?: string;
  headRef: string;
  baseRef: string;
  headSha: string;
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
  reviewBaseUrl?: string;
  skipInstall?: boolean;
  skipAppStart?: boolean;
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
  | "ignored";

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

export type VideoArtifact = {
  kind: "local_path" | "remote_url";
  location: string;
  isDurable: boolean;
};

export type ReviewArtifacts = {
  taskArtifacts: ReviewArtifact[];
  finalVideo?: VideoArtifact;
};

export type QaTaskSummary = {
  id: string;
  title: string;
  goal: string;
  steps: string[];
  expected: string[];
};

export type FeedbackFinding = {
  id: string;
  timestampText: string;
  timestampSeconds: number;
  note: string;
  screenshotArtifact?: VideoArtifact;
  issueUrl?: string;
  createdAt: string;
};

export type FeedbackState = {
  telegramChatId?: string;
  videoDeliveredAt?: string;
  findings: FeedbackFinding[];
};

export type VideoReadyHandoff = {
  repo: {
    owner: string;
    name: string;
  };
  pr: {
    number: number;
    title: string;
    url?: string;
  };
  commitSha: string;
  qaTaskSummaries: QaTaskSummary[];
  stitchedVideo?: VideoArtifact;
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
  handoff?: VideoReadyHandoff;
  feedback: FeedbackState;
};
