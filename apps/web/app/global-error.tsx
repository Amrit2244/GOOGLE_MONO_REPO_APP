"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: 32, textAlign: "center", fontFamily: "sans-serif" }}>
          <h2>System Error</h2>
          <p>An unexpected error occurred.</p>
          <button
            onClick={() => reset()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
