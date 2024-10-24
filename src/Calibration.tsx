import { useEffect, useRef, useState } from "react";
import { VoiceControl } from "./voiceControl";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./Arkanoid";
import {
  CalibrationResult,
  CalibrationState,
  calibrationStateArrayForStep,
  CalibrationStep,
  evaluateState,
  isCalibrationStepComplete,
} from "./calibrationTypes";

const WARMUP_TIME = 5000;
const CALIBRATION_TIME = 10000;
const LOWEST_FREQ = 200;
const BAR_HEIGHT_SCALE = CANVAS_HEIGHT / 300; // 256 is the max amplitude but we want some gap at the top

const CALIBRATION_STEPS: CalibrationStep[] = [
  "voiceAmplitude",
  "noiseAmplitude",
  "frequencyRange",
];
const CALIBRATION_BUTTON: Record<CalibrationStep, string> = {
  voiceAmplitude: "Voice",
  noiseAmplitude: "Noise",
  frequencyRange: "Range",
};
const CALIBRATION_MESSAGE: Record<CalibrationStep, string> = {
  voiceAmplitude:
    "Finding voice level. Make some noise. Whistling is recommended.",
  noiseAmplitude: "Finding background noise level. Don't make any noise.",
  frequencyRange:
    "Finding frequency range. Whistle away! Alternate from high to low pitch.",
};

export function Calibration({
  voiceControl,
  calibrationState,
  onCalibrated,
}: {
  voiceControl: VoiceControl;
  calibrationState: { current: CalibrationState };
  onCalibrated: (result: CalibrationResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [calibrationStep, setCalibrationStep] =
    useState<CalibrationStep | null>(null);
  const calibrationStartedAt = useRef<number | null>(null);

  useEffect(() => {
    let animationFrameId: number;

    const dataArray = voiceControl.prepareByteFrequencyArray();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const draw = (
      result: CalibrationResult | null,
      elapsedMs: number | null,
      usedValue: { frequency: number } | { amplitude: number } | undefined,
    ) => {
      voiceControl.getByteFrequencyData(dataArray);
      ctx.fillStyle = "rgb(0, 0, 0)";
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
        const x =
          (frequency / voiceControl.frequencyPerDataPoint) * (barWidth + 1);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.strokeStyle = color;
        ctx.stroke();
      };
      if (result) {
        drawLineAtAmplitude(result.voiceAmplitude, "green");
        drawLineAtAmplitude(result.noiseAmplitude, "red");
        drawLineAtAmplitude(result.amplitudeThreshold, "orange");
        drawLineAtFrequency(result.minFreq, "blue");
        drawLineAtFrequency(result.maxFreq, "blue");
      }
      if (usedValue) {
        if ("amplitude" in usedValue) {
          drawLineAtAmplitude(usedValue.amplitude, "white");
        } else {
          drawLineAtFrequency(usedValue.frequency, "white");
        }
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
          ctx.fillText(
            `Calibrating... ${Math.ceil(calibrationLeft / 1000)}`,
            8,
            20
          );
        }
      }
    };

    let result: CalibrationResult = evaluateState(calibrationState.current);
    const calibrationLoop = () => {
      let usedValue = undefined;
      const elapsed =
        calibrationStartedAt.current === null
          ? null
          : Date.now() - calibrationStartedAt.current;
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
        const { frequency, amplitude } = voiceControl.getMaxAmplitudeFreq(
          null,
          null
        );
        if (calibrationStep === "voiceAmplitude") {
          calibrationState.current.voiceAmplitudes.push(amplitude);
          usedValue = { amplitude };
        } else if (calibrationStep === "noiseAmplitude") {
          calibrationState.current.noiseAmplitudes.push(amplitude);
          usedValue = { amplitude };
        } else if (
          calibrationStep === "frequencyRange" &&
          amplitude > result.amplitudeThreshold &&
          frequency > LOWEST_FREQ
        ) {
          calibrationState.current.freqs.push(frequency);
          usedValue = { frequency };
        }
        result = evaluateState(calibrationState.current);
      }
      draw(result, elapsed, usedValue);
      animationFrameId = requestAnimationFrame(calibrationLoop);
    };

    calibrationLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    voiceControl,
    calibrationState,
    onCalibrated,
    calibrationStartedAt,
    calibrationStep,
  ]);

  const startCalibration = (step: CalibrationStep) => {
    calibrationState.current[calibrationStateArrayForStep(step)] = [];
    setCalibrationStep(step);
    calibrationStartedAt.current = Date.now();
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-row">
        {CALIBRATION_STEPS.map((step, idx) => (
          <button
            key={step}
            // Disable if calibration is in progress or if previous step is not complete
            disabled={
              calibrationStep !== null ||
              (idx !== 0 &&
                !isCalibrationStepComplete(
                  calibrationState.current,
                  CALIBRATION_STEPS[idx - 1]
                ))
            }
            onClick={() => startCalibration(step)}
          >
            {`${
              isCalibrationStepComplete(calibrationState.current, step)
                ? "Recalibrate"
                : "Calibrate"
            } ${CALIBRATION_BUTTON[step]}`}
          </button>
        ))}
      </div>
      <div>
        <p>
          {calibrationStep === null
            ? "No calibration in progress but you can test your whistling. Single sharp spike is good, multiple spikes or wider frequency range is bad."
            : CALIBRATION_MESSAGE[calibrationStep]}
        </p>
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
