import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, FONT } from "../theme";

const LETTERS = "FIRULAIS".split("");

export const DogScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const out = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: colors.dark, opacity: out }}>
      <OffthreadVideo
        src={staticFile("perroca.mp4")}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.85,
        }}
      />
      {/* Degradado para que el texto se lea sobre el video */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center" }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 90,
            fontFamily: FONT,
            fontSize: 130,
            color: colors.yellow,
            textShadow: "0 6px 24px rgba(0,0,0,0.5)",
          }}
        >
          {LETTERS.map((letter, i) => {
            const appear = interpolate(frame, [i * 4, i * 4 + 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={i}
                style={{
                  opacity: appear,
                  transform: `translateY(${(1 - appear) * 40}px)`,
                }}
              >
                {letter}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
