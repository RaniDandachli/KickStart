import "./index.css";
import React from "react";
import { Composition } from "remotion";
import { RunItArcadeAd } from "./RunItArcadeAd";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="RunItArcadeAd"
      component={RunItArcadeAd}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
