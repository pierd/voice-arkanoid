import { useEffect, useRef } from "react";
import { VoiceControl } from "./voiceControl";

export const CANVAS_WIDTH = 300;
export const CANVAS_HEIGHT = 300;
const PADDLE_WIDTH = CANVAS_WIDTH / 4;
const PADDLE_HEIGHT = CANVAS_HEIGHT / 60;
const BALL_RADIUS = PADDLE_HEIGHT;
const BRICK_ROWS = 5;
const BRICK_COLUMNS = 8;
const BRICK_WIDTH = CANVAS_WIDTH / 10;
const BRICK_HEIGHT = CANVAS_HEIGHT / 30;
const BRICK_PADDING = PADDLE_HEIGHT;
const BRICK_OFFSET_TOP = BRICK_PADDING;
const BRICK_OFFSET_LEFT = CANVAS_WIDTH - BRICK_COLUMNS * (BRICK_WIDTH + BRICK_PADDING);

export function Arkanoid({
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
    dx: PADDLE_HEIGHT / 6,
    dy: PADDLE_HEIGHT / -5,
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
        newX < paddle.current.x + PADDLE_WIDTH &&
        newDy > 0
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
