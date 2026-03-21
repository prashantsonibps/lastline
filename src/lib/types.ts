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
};

export type RepoRef = {
  owner: string;
  name: string;
  cloneUrl: string;
  defaultBranch?: string;
};

export type ReviewJobStatus =
  | "queued"
  | "running"
  | "completed"
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

export type ReviewArtifacts = {
  taskArtifacts: ReviewArtifact[];
  finalVideoPath?: string;
};

export type ReviewJob = {
  id: string;
  repo: RepoRef;
  pr: PullRequestRef;
  changedFiles: ChangedFile[];
  status: ReviewJobStatus;
  tasks: QaTask[];
  createdAt: string;
  updatedAt: string;
  workspaceDir: string;
  outputDir: string;
  logs: string[];
  error?: string;
  artifacts?: ReviewArtifacts;
};

