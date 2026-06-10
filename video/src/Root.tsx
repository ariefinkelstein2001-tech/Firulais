import { Composition } from "remotion";
import { FirulaisIntro } from "./FirulaisIntro";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FirulaisIntro"
      component={FirulaisIntro}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1080}
      defaultProps={{
        titulo: "Firulais Craft Mix",
      }}
    />
  );
};
