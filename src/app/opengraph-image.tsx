import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: "#c8f060", marginBottom: 24 }}>
          Pactly
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>
          Your AI sales agent makes promises.
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>
          Someone should check them.
        </div>
        <div style={{ fontSize: 28, color: "#94a3b8", marginTop: 32 }}>
          Automatic promise extraction and policy compliance for AI sales agents.
        </div>
      </div>
    ),
    { ...size }
  );
}
