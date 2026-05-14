import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { HookScene } from "./scenes/HookScene";
import { QueueScene } from "./scenes/QueueScene";
import { GameplayScene } from "./scenes/GameplayScene";
import { VSScene } from "./scenes/VSScene";
import { WinScene } from "./scenes/WinScene";
import { BreadthScene } from "./scenes/BreadthScene";
import { CTAScene } from "./scenes/CTAScene";

// Timeline (30 fps = 300 frames = 10 s)
// Hook      0 – 44   (45f = 1.5 s)
// Queue    45 – 77   (33f = 1.1 s)
// Gameplay 78 – 110  (33f = 1.1 s)
// VS      111 – 143  (33f = 1.1 s)
// Win     144 – 176  (33f = 1.1 s)
// Breadth 177 – 209  (33f = 1.1 s)
// CTA     210 – 299  (90f = 3.0 s)

export const RunItArcadeAd: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#05000F" }}>
      <Sequence from={0} durationInFrames={45}>
        <HookScene />
      </Sequence>
      <Sequence from={45} durationInFrames={33}>
        <QueueScene />
      </Sequence>
      <Sequence from={78} durationInFrames={33}>
        <GameplayScene />
      </Sequence>
      <Sequence from={111} durationInFrames={33}>
        <VSScene />
      </Sequence>
      <Sequence from={144} durationInFrames={33}>
        <WinScene />
      </Sequence>
      <Sequence from={177} durationInFrames={33}>
        <BreadthScene />
      </Sequence>
      <Sequence from={210} durationInFrames={90}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
