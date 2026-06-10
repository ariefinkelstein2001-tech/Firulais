import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, FONT } from "../theme";

const CANS = [
  { file: "lata-cachupin.webp", nick: "Cachupin", color: colors.yellow },
  { file: "lata-cholita.png", nick: "Cholita", color: colors.red },
  { file: "lata-pepita.png", nick: "Pepita", color: colors.green },
];

export const CansScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleY = interpolate(frame, [0, 16], [-40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const out = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.cream,
        justifyContent: "center",
        alignItems: "center",
        opacity: out,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 70,
          color: colors.dark,
          letterSpacing: 3,
          marginBottom: 50,
          textTransform: "uppercase",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Conocé la manada
      </div>
      <div style={{ display: "flex", gap: 50, alignItems: "flex-end" }}>
        {CANS.map((can, i) => {
          const delay = 10 + i * 10;
          const enter = spring({
            frame: frame - delay,
            fps,
            config: { damping: 13, mass: 0.7 },
          });
          const y = interpolate(enter, [0, 1], [120, 0]);
          return (
            <div
              key={can.nick}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                transform: `translateY(${y}px)`,
                opacity: enter,
              }}
            >
              <Img
                src={staticFile(can.file)}
                style={{
                  height: 440,
                  filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.28))",
                }}
              />
              <div
                style={{
                  marginTop: 18,
                  fontFamily: FONT,
                  fontSize: 46,
                  color: can.color,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                {can.nick}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
