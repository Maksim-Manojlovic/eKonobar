import { ImageResponse } from "next/og";

export const size        = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius:   "7px",
        }}
      >
        <span style={{ color: "#fff", fontSize: 18, fontWeight: 700, letterSpacing: "-1px" }}>
          eK
        </span>
      </div>
    ),
    size,
  );
}
