import { useEffect, useRef, useState } from "react";
import { VoiceControl } from "./voiceControl";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./Arkanoid";

const WARMUP_TIME = 5000;
const CALIBRATION_TIME = 10000;
const LOWEST_FREQ = 200;
const BAR_HEIGHT_SCALE = CANVAS_HEIGHT / 300; // 256 is the max amplitude but we want some gap at the top

export type CalibrationResult = {
  minFreq: number;
  maxFreq: number;
  voiceAmplitude: number;
  noiseAmplitude: number;
  amplitudeThreshold: number;
};

export function isCalibrationResultComplete(result: CalibrationResult | null): result is CalibrationResult {
  return result !== null && result.minFreq > 0 && result.maxFreq > 0 && result.voiceAmplitude > 0 && result.noiseAmplitude > 0 && result.amplitudeThreshold > 0;
}

type CalibrationState = {
  freqs: number[];
  voiceAmplitudes: number[];
  noiseAmplitudes: number[];
};

function evaluateState(state: CalibrationState): CalibrationResult {
  state.freqs.sort((a, b) => a - b);
  state.voiceAmplitudes.sort((a, b) => a - b);
  state.noiseAmplitudes.sort((a, b) => a - b);
  const voiceAmplitude = state.voiceAmplitudes.length === 0 ? 0 : state.voiceAmplitudes[Math.floor(state.voiceAmplitudes.length / 2)];
  const noiseAmplitude = state.noiseAmplitudes.length === 0 ? 0 : state.noiseAmplitudes[Math.floor(state.noiseAmplitudes.length / 2)];
  return {
    // p10 and p90
    minFreq: state.freqs.length === 0 ? 0 : state.freqs[Math.floor(state.freqs.length * 0.1)],
    maxFreq: state.freqs.length === 0 ? 0 : state.freqs[Math.floor(state.freqs.length * 0.9)],
    // average of medians
    amplitudeThreshold: (voiceAmplitude + noiseAmplitude) / 2,
    voiceAmplitude,
    noiseAmplitude,
  }
}

type CalibrationStep = "voiceAmplitude" | "noiseAmplitude" | "frequencyRange";
const CALIBRATION_STEPS: CalibrationStep[] = ["voiceAmplitude", "noiseAmplitude", "frequencyRange"];
const CALIBRATION_BUTTON: Record<CalibrationStep, string> = {
  voiceAmplitude: "Voice",
  noiseAmplitude: "Noise",
  frequencyRange: "Range",
};
const CALIBRATION_MESSAGE: Record<CalibrationStep, string> = {
  voiceAmplitude: "Finding voice level. Make some noise. Whistling is recommended.",
  noiseAmplitude: "Finding background noise level. Don't make any noise.",
  frequencyRange: "Finding frequency range. Whistle away! Alternate from high to low pitch.",
};

export function Calibration({
  voiceControl,
  onCalibrated,
}: {
  voiceControl: VoiceControl;
  onCalibrated: (result: CalibrationResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<CalibrationState>({
    freqs: [],
    voiceAmplitudes: [],
    noiseAmplitudes: [],
  });
  const [calibrationStep, setCalibrationStep] = useState<CalibrationStep | null>(null);
  const calibrationStartedAt = useRef<number | null>(null);

  useEffect(() => {
    let animationFrameId: number;

    const dataArray = voiceControl.prepareByteFrequencyArray();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const draw = (result: CalibrationResult | null, elapsedMs: number | null) => {
      voiceControl.getByteFrequencyData(dataArray);
      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
          const barHeight = dataArray[i] * BAR_HEIGHT_SCALE;

          const r = barHeight + 25 * (i / dataArray.length);
          const g = 250 * (i / dataArray.length);
          const b = 50;

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

          x += barWidth + 1;
      }

      // Draw lines
      const drawLineAtAmplitude = (amplitude: number, color: string) => {
        const y = canvas.height - amplitude * BAR_HEIGHT_SCALE;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.strokeStyle = color;
        ctx.stroke();
      };
      const drawLineAtFrequency = (frequency: number, color: string) => {
        const x = (frequency / voiceControl.frequencyPerDataPoint) * (barWidth + 1);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.strokeStyle = color;
        ctx.stroke();
      };
      if (result) {
        drawLineAtAmplitude(result.voiceAmplitude, "green");
        drawLineAtAmplitude(result.noiseAmplitude, "red");
        drawLineAtFrequency(result.minFreq, "blue");
        drawLineAtFrequency(result.maxFreq, "blue");
      }

      // Draw countdown
      if (elapsedMs) {
        ctx.font = "16px Arial";
        ctx.fillStyle = "#ffffff";
        if (elapsedMs < WARMUP_TIME) {
          const warmupLeft = WARMUP_TIME - elapsedMs;
          ctx.fillText(`Get ready! ${Math.ceil(warmupLeft / 1000)}`, 8, 20);
        } else {
          const calibrationLeft = WARMUP_TIME + CALIBRATION_TIME - elapsedMs;
          ctx.fillText(`Calibrating... ${Math.ceil(calibrationLeft / 1000)}`, 8, 20);
        }
      }
    };

    let result: CalibrationResult = evaluateState(state.current);
    const calibrationLoop = () => {
      const elapsed = calibrationStartedAt.current === null ? null : Date.now() - calibrationStartedAt.current;
      if (!elapsed) {
        // not calibrating - just draw
      } else if (elapsed < WARMUP_TIME) {
        // warmup
      } else if (elapsed > WARMUP_TIME + CALIBRATION_TIME) {
        // finished
        console.log("Calibration finished", result);
        onCalibrated(result);
        setCalibrationStep(null);
        calibrationStartedAt.current = null;
      } else {
        // actually calibrating
        const { frequency, amplitude } = voiceControl.getMaxAmplitudeFreq(null, null);
        if (calibrationStep === "voiceAmplitude") {
          state.current.voiceAmplitudes.push(amplitude);
        } else if (calibrationStep === "noiseAmplitude") {
          state.current.noiseAmplitudes.push(amplitude);
        } else if (calibrationStep === "frequencyRange" && amplitude > result.amplitudeThreshold && frequency > LOWEST_FREQ) {
          state.current.freqs.push(frequency);
        }
        result = evaluateState(state.current);
      }
      draw(result, elapsed);
      animationFrameId = requestAnimationFrame(calibrationLoop);
    };

    calibrationLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [onCalibrated, voiceControl, calibrationStartedAt, calibrationStep]);

  const startCalibration = (step: CalibrationStep) => {
    switch (step) {
      case "voiceAmplitude":
        state.current.voiceAmplitudes = [];
        break;
      case "noiseAmplitude":
        state.current.noiseAmplitudes = [];
        break;
      case "frequencyRange":
        state.current.freqs = [];
        break;
    }
    setCalibrationStep(step);
    calibrationStartedAt.current = Date.now();
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-row">
        {CALIBRATION_STEPS.map((step) => (
        <button
          key={step}
          disabled={calibrationStep !== null}
          onClick={() => startCalibration(step)}
        >
          {CALIBRATION_BUTTON[step]}
        </button>
        ))}
      </div>
      <div>
        <p>{calibrationStep === null ? '' : CALIBRATION_MESSAGE[calibrationStep]}</p>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border border-gray-300"
      />
    </div>
  );
}

    //   <div>
    //     <p>
    //       {calibrationStep === "amplitudeThreshold"
    //         ? "Finding noise level. Don't make any noise."
    //         : "Finding frequency range. Make control noise. Alternate from high to low pitch."}
    //     </p>
    //     <p>Current noise level: {state.current.amplitudeThreshold}</p>
    //     <p>Current min freq: {state.current.minFreq}</p>
    //     <p>Current max freq: {state.current.maxFreq}</p>
    //   </div>
