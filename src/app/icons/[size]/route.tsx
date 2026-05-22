import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const ALLOWED = new Set([72, 96, 128, 144, 152, 192, 256, 384, 512]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ size: string }> },
) {
  const raw = parseInt((await params).size, 10);
  const dim = ALLOWED.has(raw) ? raw : 192;

  const radius = Math.round(dim * 0.2);
  const fontSize = Math.round(dim * 0.42);
  const letterSpacing = Math.round(dim * -0.02);

  return new ImageResponse(
    (
      <div
        style={{
          background:     "#fb923c",
          width:          "100%",
          height:         "100%",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          borderRadius:   `${radius}px`,
        }}
      >
        <span
          style={{
            color:         "#fff",
            fontSize,
            fontWeight:    700,
            letterSpacing: `${letterSpacing}px`,
          }}
        >
          eK
        </span>
      </div>
    ),
    { width: dim, height: dim },
  );
}
