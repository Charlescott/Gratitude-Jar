import { useState } from "react";

export function getInitials(input) {
  if (!input) return "??";
  const clean = String(input).replace(/@.*/, "").trim();
  if (!clean) return "??";
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export default function Avatar({
  src,
  name,
  size = 42,
  fontSize,
  className = "",
  style = {},
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const initials = getInitials(name);
  const resolvedFontSize =
    fontSize ?? `${Math.max(10, Math.round(size * 0.4))}px`;

  const baseStyle = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: "999px",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: resolvedFontSize,
    color: "#fff",
    background: showImage
      ? "transparent"
      : "linear-gradient(135deg, #2f80ed, #27ae60)",
    flexShrink: 0,
    ...style,
  };

  return (
    <div className={className} style={baseStyle} aria-hidden="true">
      {showImage ? (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        initials
      )}
    </div>
  );
}
