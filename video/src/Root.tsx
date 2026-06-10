import { Composition } from "remotion";
import { FirulaisVideo } from "./FirulaisVideo";
import { FirulaisIntro } from "./FirulaisIntro";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Video completo con assets reales (cuadrado, ideal para redes) */}
      <Composition
        id="FirulaisVideo"
        component={FirulaisVideo}
        durationInFrames={430}
        fps={30}
        width={1080}
        height={1080}
      />
      {/* Intro simple original */}
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
    </>
  );
};
