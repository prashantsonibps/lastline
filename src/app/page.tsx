import { listReviewJobs } from "@/lib/review-jobs-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const jobs = await listReviewJobs();

  return (
    <main
      style={{
        padding: "48px 24px 72px",
        maxWidth: 1080,
        margin: "0 auto",
      }}
    >
      <section
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 36,
        }}
      >
        <p
          style={{
            color: "#7cf4c3",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            fontSize: 12,
            margin: 0,
          }}
        >
          Person 1 Control Surface
        </p>
        <h1
          style={{
            fontSize: "clamp(2.6rem, 6vw, 5rem)",
            lineHeight: 1,
            margin: 0,
            maxWidth: 820,
          }}
        >
          Turn pull requests into review-ready evidence.
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 18,
            color: "#a1b0d2",
            maxWidth: 760,
            lineHeight: 1.6,
          }}
        >
          Webhook intake, PR checkout, QA plan generation, Playwright execution,
          and stitched review artifacts live here. The machine side now targets a
          `video_ready` handoff so Telegram and issue creation can attach to the
          same run record.
        </p>
      </section>

      <section
        style={{
          border: "1px solid rgba(161, 176, 210, 0.2)",
          borderRadius: 24,
          background: "rgba(19, 27, 50, 0.76)",
          backdropFilter: "blur(16px)",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22 }}>Recent Jobs</h2>
          <code>/api/github/pr-webhook</code>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {jobs.length === 0 ? (
            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: "rgba(11, 16, 32, 0.7)",
                border: "1px dashed rgba(161, 176, 210, 0.2)",
                color: "#a1b0d2",
              }}
            >
              No jobs yet. Post a payload to <code>/api/reviews/run</code> to
              smoke-test the pipeline before the GitHub hook is live.
            </div>
          ) : (
            jobs.map((job) => (
              <article
                key={job.id}
                style={{
                  padding: 18,
                  borderRadius: 18,
                  background: "rgba(11, 16, 32, 0.78)",
                  border: "1px solid rgba(161, 176, 210, 0.16)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <strong>
                    {job.repo.owner}/{job.repo.name} #{job.pr.number}
                  </strong>
                  <code>{job.status}</code>
                </div>
                <span style={{ color: "#a1b0d2" }}>{job.pr.title}</span>
                <span style={{ color: "#a1b0d2" }}>
                  {job.tasks.length} task(s) • {new Date(job.updatedAt).toLocaleString()}
                </span>
                {job.handoff?.stitchedVideo ? (
                  <span style={{ color: "#7cf4c3" }}>
                    video_ready artifact: {job.handoff.stitchedVideo.kind}
                  </span>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
