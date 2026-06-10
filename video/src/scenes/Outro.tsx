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

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 12 } });
  const scale = interpolate(pop, [0, 1], [0.6, 1]);

  const ctaOpacity = interpolate(frame, [20, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.red,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Img
        src={staticFile("firu.png")}
        style={{
          width: 360,
          transform: `scale(${scale})`,
          filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.3))",
        }}
      />
      <div
        style={{
          marginTop: 10,
          fontFamily: FONT,
          fontSize: 96,
          color: colors.yellow,
          letterSpacing: 4,
          textTransform: "uppercase",
          transform: `scale(${scale})`,
        }}
      >
        Free of Lice
      </div>
      <div
        style={{
          marginTop: 16,
          fontFamily: FONT,
          fontSize: 40,
          color: colors.white,
          letterSpacing: 6,
          opacity: ctaOpacity,
          textTransform: "uppercase",
        }}
      >
        Craft Mix · Est. 2025
      </div>
    </AbsoluteFill>
  );
};
