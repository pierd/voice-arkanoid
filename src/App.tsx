import { useState, useEffect, useRef } from "react";

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 10;
const BALL_RADIUS = 10;
const BRICK_ROWS = 5;
const BRICK_COLUMNS = 8;
const BRICK_WIDTH = 80;
const BRICK_HEIGHT = 20;
const BRICK_PADDING = 10;
const BRICK_OFFSET_TOP = 30;
const BRICK_OFFSET_LEFT = 30;

type Mode = "menu" | "game" | "calibrating" | "game-over";

function VoiceControlledArkanoid({
  minFreq,
  maxFreq,
  amplitudeThreshold,
  voiceControl,
  onGameOver,
}: {
  minFreq: number;
  maxFreq: number;
  amplitudeThreshold: number;
  voiceControl: VoiceControl;
  onGameOver: (score: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paddle = useRef({
    x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
    y: CANVAS_HEIGHT - PADDLE_HEIGHT - 10,
  });
  const ball = useRef({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 30,
    dx: 1.5,
    dy: -2,
  });

  const generateBricks = () => {
    const newBricks = [];
    for (let c = 0; c < BRICK_COLUMNS; c++) {
      for (let r = 0; r < BRICK_ROWS; r++) {
        newBricks.push({
          x: c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT,
          y: r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP,
          status: 1,
        });
      }
    }
    return newBricks;
  };
  const bricks = useRef<
    { x: number; y: number; status: number }[]
  >(generateBricks());
  const score = useRef(0);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas!.getContext("2d")!;
    let animationFrameId: number;

    const updatePaddlePosition = () => {
      const { frequency: maxFrequency, amplitude: maxAmplitude } =
        voiceControl.getMaxAmplitudeFreq(minFreq, maxFreq);

      if (maxAmplitude > amplitudeThreshold) {
        const normalizedPosition =
          (maxFrequency - minFreq) / (maxFreq - minFreq);
        const newPaddleX = normalizedPosition * (CANVAS_WIDTH - PADDLE_WIDTH);
        paddle.current.x = newPaddleX;
      }
    };

    const updateBallPosition = () => {
      const prev = ball.current;
      const newX = prev.x + prev.dx;
      const newY = prev.y + prev.dy;
      let newDx = prev.dx;
      let newDy = prev.dy;

      // Wall collision
      if (newX + BALL_RADIUS > CANVAS_WIDTH || newX - BALL_RADIUS < 0) {
        newDx = -newDx;
      }
      if (newY - BALL_RADIUS < 0) {
        newDy = -newDy;
      }

      // Paddle collision
      if (
        newY + BALL_RADIUS > paddle.current.y &&
        newX > paddle.current.x &&
        newX < paddle.current.x + PADDLE_WIDTH
      ) {
        newDy = -newDy;
      }

      // Game over
      if (newY + BALL_RADIUS > CANVAS_HEIGHT) {
        onGameOver(score.current);
      }

      ball.current = { x: newX, y: newY, dx: newDx, dy: newDy };
    };

    const checkBrickCollision = () => {
      const prevBricks = bricks.current;
      const newBricks = [...prevBricks];
      let collided = false;

      for (let i = 0; i < newBricks.length; i++) {
        const brick = newBricks[i];
        if (brick.status === 1) {
          if (
            ball.current.x > brick.x &&
            ball.current.x < brick.x + BRICK_WIDTH &&
            ball.current.y > brick.y &&
            ball.current.y < brick.y + BRICK_HEIGHT
          ) {
            ball.current.dy = -ball.current.dy;
            brick.status = 0;
            score.current += 1;
            collided = true;
          }
        }
      }

      bricks.current = collided ? newBricks : prevBricks;
    };

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw paddle
      ctx.fillStyle = "#0000FF";
      ctx.fillRect(
        paddle.current.x,
        paddle.current.y,
        PADDLE_WIDTH,
        PADDLE_HEIGHT
      );

      // Draw ball
      ctx.beginPath();
      ctx.arc(ball.current.x, ball.current.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "#FF0000";
      ctx.fill();
      ctx.closePath();

      // Draw bricks
      bricks.current.forEach((brick) => {
        if (brick.status === 1) {
          ctx.fillStyle = "#00FF00";
          ctx.fillRect(brick.x, brick.y, BRICK_WIDTH, BRICK_HEIGHT);
        }
      });

      // Draw score
      ctx.font = "16px Arial";
      ctx.fillStyle = "#000000";
      ctx.fillText(`Score: ${score.current}`, 8, 20);
    };

    const gameLoop = () => {
      updatePaddlePosition();
      updateBallPosition();
      checkBrickCollision();
      draw();
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    paddle,
    ball,
    bricks,
    score,
    minFreq,
    maxFreq,
    amplitudeThreshold,
    voiceControl,
    onGameOver,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="border border-gray-300"
    />
  );
}

function Menu() {
  return <div></div>;
}

type CalibrationState = {
  minFreq: number;
  maxFreq: number;
  amplitudeThreshold: number;
};
type CalibrationStep = "amplitudeThreshold" | "frequencyRange";

// TODO: this needs to be smarter, it's too strict right now so the values are a bit off, needs to be a bit more fuzzy
function Calibration({
  voiceControl,
  onCalibrated,
}: {
  voiceControl: VoiceControl;
  onCalibrated: (state: CalibrationState) => void;
}) {
  const state = useRef<CalibrationState>({
    minFreq: 10000,
    maxFreq: 0,
    amplitudeThreshold: 0,
  });
  const [calibrationStep, setCalibrationStep] =
    useState<CalibrationStep>("amplitudeThreshold");
  const calibrationStartedAt = useRef(Date.now());
  const [, rerender] = useState({});

  useEffect(() => {
    const intervalId = setInterval(() => {
      rerender({});
    }, 1000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let animationFrameId: number;

    const updateAmplitudeThreshold = () => {
      const { amplitude: maxAmplitude } = voiceControl.getMaxAmplitudeFreq(
        null,
        null
      );
      state.current.amplitudeThreshold = Math.max(
        maxAmplitude,
        state.current.amplitudeThreshold
      );
    };
    const updateFrequencyRange = () => {
      const { frequency, amplitude } = voiceControl.getMaxAmplitudeFreq(
        null,
        null
      );
      if (amplitude > state.current.amplitudeThreshold * 2) {
        // clamp frequency to 800-4000 Hz
        const f = Math.min(Math.max(frequency, 800), 4000);
        state.current.minFreq = Math.min(f, state.current.minFreq);
        state.current.maxFreq = Math.max(f, state.current.maxFreq);
      }
    };
    const update = () => {
      if (calibrationStep === "amplitudeThreshold") {
        updateAmplitudeThreshold();
      } else {
        updateFrequencyRange();
      }
    };

    const calibrationLoop = () => {
      update();
      const elapsed = Date.now() - calibrationStartedAt.current;
      if (elapsed > 15000) {
        state.current.amplitudeThreshold *= 2.0;
        onCalibrated(state.current);
      } else if (elapsed > 5000) {
        setCalibrationStep("frequencyRange");
      }
      animationFrameId = requestAnimationFrame(calibrationLoop);
    };

    calibrationLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [onCalibrated, voiceControl, calibrationStartedAt, calibrationStep]);

  return (
    <div className="mt-4 space-y-2">
      <div>
        <p>
          {calibrationStep === "amplitudeThreshold"
            ? "Finding noise level. Don't make any noise."
            : "Finding frequency range. Make control noise. Alternate from high to low pitch."}
        </p>
        <p>Current noise level: {state.current.amplitudeThreshold}</p>
        <p>Current min freq: {state.current.minFreq}</p>
        <p>Current max freq: {state.current.maxFreq}</p>
      </div>
    </div>
  );
}

class VoiceControl {
  private context: AudioContext;
  private analyzerNode: AnalyserNode;
  private microphone;

  constructor(
    context: AudioContext,
    analyzerNode: AnalyserNode,
    microphone: MediaStreamAudioSourceNode
  ) {
    this.context = context;
    this.analyzerNode = analyzerNode;
    this.microphone = microphone;
  }

  public dispose() {
    this.microphone.disconnect();
    this.context.close();
  }

  public getMaxAmplitudeFreq(minFreq: number | null, maxFreq: number | null) {
    const bufferLength = this.analyzerNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyzerNode.getByteFrequencyData(dataArray);

    let maxAmplitude = 0;
    let maxFrequency = 0;

    for (let i = 0; i < bufferLength; i++) {
      const frequency =
        (i * this.analyzerNode.context.sampleRate) / this.analyzerNode.fftSize;
      if (
        (minFreq === null || frequency >= minFreq) &&
        (maxFreq === null || frequency <= maxFreq) &&
        dataArray[i] > maxAmplitude
      ) {
        maxAmplitude = dataArray[i];
        maxFrequency = frequency;
      }
    }
    return { frequency: maxFrequency, amplitude: maxAmplitude };
  }

  public static async create() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new window.AudioContext();
      const analyzerNode = context.createAnalyser();
      const microphone = context.createMediaStreamSource(stream);
      microphone.connect(analyzerNode);
      analyzerNode.fftSize = 2048;
      return new VoiceControl(context, analyzerNode, microphone);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }
}

function App() {
  const [mode, setMode] = useState<Mode>("menu");
  const voiceControl = useRef<VoiceControl>();
  const [score, setScore] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationState, setCalibrationState] =
    useState<CalibrationState | null>(/* FIXME null*/ {
      minFreq: 1000,
      maxFreq: 1500,
      amplitudeThreshold: 200,
    });

  useEffect(() => {
    console.log("Creating voice control");
    VoiceControl.create().then((vc) => {
      console.log("Voice control created");
      voiceControl.current = vc;
    });
    return () => {
      console.log("Disposing voice control");
      voiceControl.current?.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-4">Voice-Controlled Arkanoid</h1>
      <div
        className="mb-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4"
        role="alert"
      >
        <p className="font-bold">Voice Control Active</p>
        {/* <p>Use your voice to control the paddle. The louder you speak, the more the paddle will move.</p> */}
        <button onClick={() => setCalibrating(true)}>Calibrate</button>
        <button disabled={!calibrationState} onClick={() => setMode("game")}>
          Start Game
        </button>
      </div>
      {voiceControl.current && calibrating && (
        <Calibration
          voiceControl={voiceControl.current}
          onCalibrated={(state) => {
            setCalibrationState(state);
            setCalibrating(false);
          }}
        />
      )}
      {(() => {
        switch (mode) {
          case "menu":
            return <Menu />;
          case "game":
            return (
              voiceControl.current &&
              calibrationState && (
                <VoiceControlledArkanoid
                  minFreq={calibrationState.minFreq}
                  maxFreq={calibrationState.maxFreq}
                  amplitudeThreshold={calibrationState.amplitudeThreshold}
                  voiceControl={voiceControl.current}
                  onGameOver={(score) => {
                    setScore(score);
                    setMode("game-over");
                  }}
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
