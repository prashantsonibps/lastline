"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useMemo, useState } from "react";
import type { ReviewAssistantUIMessage } from "@/lib/review-assistant/agent";

type JobSummary = {
  id: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  status: string;
  updatedAt: string;
  stitchedVideo?: string;
};

type ReviewChatProps = {
  initialJobs: JobSummary[];
};

function MessageBubble({ message }: { message: ReviewAssistantUIMessage }) {
  const isUser = message.role === "user";

  return (
    <article
      style={{
        alignSelf: isUser ? "flex-end" : "stretch",
        maxWidth: isUser ? "78%" : "100%",
        padding: isUser ? "14px 16px" : 0,
        borderRadius: 20,
        background: isUser ? "linear-gradient(135deg, #7cf4c3, #46d1f3)" : "transparent",
        color: isUser ? "#04121b" : "inherit",
        boxShadow: isUser ? "0 16px 32px rgba(70, 209, 243, 0.14)" : "none",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <div
                key={`${message.id}-${index}`}
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  fontSize: 15,
                }}
              >
                {part.text}
              </div>
            );
          }

          if (part.type.startsWith("tool-")) {
            const toolPart = part as {
              errorText?: string;
              input?: unknown;
              output?: unknown;
              state: string;
              type: string;
            };
            const title = toolPart.type.replace("tool-", "");

            return (
              <section
                key={`${message.id}-${index}`}
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(161, 176, 210, 0.18)",
                  background: "rgba(11, 16, 32, 0.82)",
                  padding: 14,
                  boxShadow: "0 14px 30px rgba(0, 0, 0, 0.18)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <strong style={{ fontSize: 14 }}>{title}</strong>
                  <code style={{ color: "#7cf4c3" }}>{toolPart.state}</code>
                </div>
                {toolPart.state === "output-error" ? (
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      color: "#ff8d90",
                    }}
                  >
                    {toolPart.errorText}
                  </pre>
                ) : toolPart.state === "output-available" ? (
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      color: "#c9d7fb",
                      fontSize: 13,
                    }}
                  >
                    {JSON.stringify(toolPart.output, null, 2)}
                  </pre>
                ) : (
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      color: "#a1b0d2",
                      fontSize: 13,
                    }}
                  >
                    {JSON.stringify(toolPart.input, null, 2)}
                  </pre>
                )}
              </section>
            );
          }

          return null;
        })}
      </div>
    </article>
  );
}

export function ReviewChat({ initialJobs }: ReviewChatProps) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat<ReviewAssistantUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const starterPrompts = useMemo(
    () => [
      "List the most recent review jobs and tell me which one is ready for feedback.",
      "Inspect the latest handoff payload and summarize the review status.",
      "Tell me how to deliver a review to Telegram for a specific job.",
    ],
    [],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const next = input.trim();
    if (!next) {
      return;
    }

    sendMessage({ text: next });
    setInput("");
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 20px 48px",
      }}
    >
      <div
        style={{
          width: "min(1280px, 100%)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
          gap: 24,
        }}
      >
        <aside
          style={{
            display: "grid",
            gap: 18,
            alignSelf: "start",
          }}
        >
          <section
            style={{
              borderRadius: 28,
              padding: 24,
              background:
                "linear-gradient(160deg, rgba(124, 244, 195, 0.16), rgba(15, 23, 43, 0.84) 46%, rgba(11, 16, 32, 0.96))",
              border: "1px solid rgba(124, 244, 195, 0.18)",
              boxShadow: "0 22px 54px rgba(3, 7, 18, 0.34)",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#7cf4c3",
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                fontSize: 12,
              }}
            >
              Lastline Operator Chat
            </p>
            <h1
              style={{
                margin: "12px 0 10px",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 1.02,
              }}
            >
              Run the review workflow through AI SDK + Chat SDK.
            </h1>
            <p
              style={{
                margin: 0,
                color: "#d2defa",
                lineHeight: 1.7,
              }}
            >
              Inspect jobs, send the stitched review to Telegram, save findings, and turn them into GitHub issues from one shared assistant.
            </p>
          </section>

          <section
            style={{
              borderRadius: 24,
              padding: 20,
              background: "rgba(11, 16, 32, 0.76)",
              border: "1px solid rgba(161, 176, 210, 0.14)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18 }}>Recent Jobs</h2>
              <code style={{ color: "#7cf4c3" }}>{initialJobs.length}</code>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {initialJobs.length === 0 ? (
                <div style={{ color: "#a1b0d2", lineHeight: 1.6 }}>
                  No review jobs yet. Post to <code>/api/reviews/run</code> to create one.
                </div>
              ) : (
                initialJobs.map((job) => (
                  <article
                    key={job.id}
                    style={{
                      padding: 14,
                      borderRadius: 18,
                      background: "rgba(19, 27, 50, 0.72)",
                      border: "1px solid rgba(161, 176, 210, 0.12)",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>
                      {job.repo} #{job.prNumber}
                    </strong>
                    <span style={{ color: "#c7d6fa", fontSize: 14 }}>{job.prTitle}</span>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        color: "#9fb2dc",
                        fontSize: 12,
                      }}
                    >
                      <code>{job.status}</code>
                      <span>{new Date(job.updatedAt).toLocaleString()}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>

        <section
          style={{
            minHeight: "calc(100vh - 64px)",
            borderRadius: 30,
            border: "1px solid rgba(161, 176, 210, 0.16)",
            background: "rgba(7, 11, 24, 0.8)",
            boxShadow: "0 30px 80px rgba(0, 0, 0, 0.32)",
            display: "grid",
            gridTemplateRows: "1fr auto",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 22,
              display: "grid",
              gap: 14,
              alignContent: "start",
              overflowY: "auto",
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  padding: "12px 4px 0",
                }}
              >
                <div style={{ color: "#a1b0d2", lineHeight: 1.7 }}>
                  Start by asking the assistant to list jobs, inspect a handoff, or deliver a review to Telegram.
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                  }}
                >
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      style={{
                        textAlign: "left",
                        borderRadius: 18,
                        border: "1px solid rgba(161, 176, 210, 0.14)",
                        background: "rgba(19, 27, 50, 0.62)",
                        color: "#eff3ff",
                        padding: "14px 16px",
                        cursor: "pointer",
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              borderTop: "1px solid rgba(161, 176, 210, 0.14)",
              padding: 18,
              background: "rgba(11, 16, 32, 0.88)",
              display: "grid",
              gap: 12,
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about jobs, handoffs, Telegram delivery, findings, or issue creation..."
              rows={3}
              style={{
                width: "100%",
                resize: "vertical",
                borderRadius: 18,
                border: "1px solid rgba(161, 176, 210, 0.18)",
                background: "rgba(19, 27, 50, 0.92)",
                color: "#eff3ff",
                padding: "14px 16px",
                font: "inherit",
                lineHeight: 1.6,
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span style={{ color: "#98abd6", fontSize: 13 }}>
                {status === "streaming" || status === "submitted" ? "Assistant is working..." : "Ready"}
              </span>
              <button
                type="submit"
                disabled={!input.trim() || status === "streaming" || status === "submitted"}
                style={{
                  border: 0,
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #7cf4c3, #46d1f3)",
                  color: "#031018",
                  fontWeight: 700,
                  padding: "12px 18px",
                  cursor: "pointer",
                  opacity: !input.trim() || status === "streaming" || status === "submitted" ? 0.6 : 1,
                }}
              >
                Send
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
