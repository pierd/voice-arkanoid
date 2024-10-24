export type CalibrationStep =
  | "voiceAmplitude"
  | "noiseAmplitude"
  | "frequencyRange";

export type CalibrationResult = {
  minFreq: number;
  maxFreq: number;
  voiceAmplitude: number;
  noiseAmplitude: number;
  amplitudeThreshold: number;
};

export function isCalibrationResultComplete(
  result: CalibrationResult | null
): result is CalibrationResult {
  return (
    result !== null &&
    result.minFreq > 0 &&
    result.maxFreq > 0 &&
    result.voiceAmplitude > 0 &&
    result.noiseAmplitude > 0 &&
    result.amplitudeThreshold > 0
  );
}

export type CalibrationState = {
  freqs: number[];
  voiceAmplitudes: number[];
  noiseAmplitudes: number[];
};

export function emptyCalibrationState(): CalibrationState {
  return {
    freqs: [],
    voiceAmplitudes: [],
    noiseAmplitudes: [],
  };
}

export function calibrationStateArrayForStep(
  step: CalibrationStep
): keyof CalibrationState {
  switch (step) {
    case "voiceAmplitude":
      return "voiceAmplitudes";
    case "noiseAmplitude":
      return "noiseAmplitudes";
    case "frequencyRange":
      return "freqs";
  }
}

export function isCalibrationStepComplete(
  state: CalibrationState,
  step: CalibrationStep
): boolean {
  return state[calibrationStateArrayForStep(step)].length > 0;
}

export function evaluateState(state: CalibrationState): CalibrationResult {
  state.freqs.sort((a, b) => a - b);
  state.voiceAmplitudes.sort((a, b) => a - b);
  state.noiseAmplitudes.sort((a, b) => a - b);
  const voiceAmplitude =
    state.voiceAmplitudes.length === 0
      ? 0
      : state.voiceAmplitudes[Math.floor(state.voiceAmplitudes.length / 2)];
  const noiseAmplitude =
    state.noiseAmplitudes.length === 0
      ? 0
      : state.noiseAmplitudes[Math.floor(state.noiseAmplitudes.length / 2)];
  return {
    // p10 and p90
    minFreq:
      state.freqs.length === 0
        ? 0
        : state.freqs[Math.floor(state.freqs.length * 0.1)],
    maxFreq:
      state.freqs.length === 0
        ? 0
        : state.freqs[Math.floor(state.freqs.length * 0.9)],
    // average of medians
    amplitudeThreshold: (voiceAmplitude + noiseAmplitude) / 2,
    voiceAmplitude,
    noiseAmplitude,
  };
}
