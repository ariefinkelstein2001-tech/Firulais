import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const FirulaisIntro: React.FC<{ titulo: string }> = ({ titulo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f4a300",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: 90,
          fontWeight: 800,
          color: "#1a1a1a",
          transform: `scale(${scale})`,
          opacity,
          textAlign: "center",
          padding: 40,
        }}
      >
        {titulo}
      </h1>
    </AbsoluteFill>
  );
};
