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

export const LogoIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 11, mass: 0.8 } });
  const logoScale = interpolate(pop, [0, 1], [0.3, 1]);

  const tagOpacity = interpolate(frame, [18, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagY = interpolate(frame, [18, 34], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out al final de la escena para empalmar con la siguiente.
  const out = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.yellow,
        justifyContent: "center",
        alignItems: "center",
        opacity: out,
      }}
    >
      <Img
        src={staticFile("logo.png")}
        style={{
          width: 620,
          maxWidth: "70%",
          transform: `scale(${logoScale})`,
        }}
      />
      <div
        style={{
          marginTop: 24,
          fontFamily: FONT,
          fontSize: 54,
          letterSpacing: 4,
          color: colors.dark,
          opacity: tagOpacity,
          transform: `translateY(${tagY}px)`,
          textTransform: "uppercase",
        }}
      >
        Craft Mix · Free of Lice
      </div>
    </AbsoluteFill>
  );
};
