import { AbsoluteFill, Series } from "remotion";
import "./load-fonts";
import { colors } from "./theme";
import { LogoIntro } from "./scenes/LogoIntro";
import { DogScene } from "./scenes/DogScene";
import { CansScene } from "./scenes/CansScene";
import { Outro } from "./scenes/Outro";

// 30 fps · escenas: 90 + 120 + 130 + 90 = 430 frames (~14.3 s)
export const FirulaisVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.dark }}>
      <Series>
        <Series.Sequence durationInFrames={90}>
          <LogoIntro />
        </Series.Sequence>
        <Series.Sequence durationInFrames={120}>
          <DogScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={130}>
          <CansScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={90}>
          <Outro />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
