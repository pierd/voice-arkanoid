import { useState, useEffect, useRef } from "react";
import { VoiceControl } from "./voiceControl";
import { Calibration } from "./Calibration";
import { Arkanoid } from "./Arkanoid";
import {
  CalibrationResult,
  emptyCalibrationState,
  isCalibrationResultComplete,
} from "./calibrationTypes";

type Mode = "welcome" | "game" | "calibrating" | "game-over";

function App() {
  const [mode, setMode] = useState<Mode>("welcome");
  const voiceControl = useRef<VoiceControl>();
  const [score, setScore] = useState(0);
  const calibrationState = useRef(emptyCalibrationState());
  const [calibrationResult, setCalibrationResult] =
    useState<CalibrationResult | null>(null);
  const [, rerender] = useState({});

  useEffect(() => {
    console.log("Creating voice control");
    VoiceControl.create().then((vc) => {
      console.log("Voice control created");
      voiceControl.current = vc;
      rerender({});
    });
    return () => {
      console.log("Disposing voice control");
      voiceControl.current?.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-4">
        Voice pitch controlled Arkanoid
      </h1>
      <div
        className="mb-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4"
        role="alert"
      >
        <p>
          Use your voice (whistle) to control the paddle. Pitch sets the
          position.
        </p>
        <button
          disabled={!voiceControl.current}
          onClick={() => setMode("calibrating")}
        >
          Calibrate
        </button>
        <button
          disabled={
            !voiceControl.current ||
            !isCalibrationResultComplete(calibrationResult)
          }
          onClick={() => setMode("game")}
        >
          Start Game
        </button>
      </div>
      {(() => {
        switch (mode) {
          case "welcome":
            return (
              <div className="mt-4">
                <p>Use your voice to control the paddle.</p>
                <p>
                  Whistle at different pitch to move the paddle left (low pitch)
                  or right (high pitch).
                </p>
                <p>Calibrate first, then start the game.</p>
              </div>
            );
          case "game":
            return (
              voiceControl.current &&
              isCalibrationResultComplete(calibrationResult) && (
                <Arkanoid
                  minFreq={calibrationResult.minFreq}
                  maxFreq={calibrationResult.maxFreq}
                  amplitudeThreshold={calibrationResult.amplitudeThreshold}
                  voiceControl={voiceControl.current}
                  onGameOver={(score) => {
                    setScore(score);
                    setMode("game-over");
                  }}
                />
              )
            );
          case "calibrating":
            return (
              voiceControl.current && (
                <Calibration
                  voiceControl={voiceControl.current}
                  calibrationState={calibrationState}
                  onCalibrated={setCalibrationResult}
                />
              )
            );
          case "game-over":
            return (
              <div className="mt-4 text-xl font-bold text-red-500">
                Game Over! Final Score: {score}
              </div>
            );
        }
      })()}
    </div>
  );
}

export default App;
