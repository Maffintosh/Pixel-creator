import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getCursor } from "../../util/helpers/getCursor";
import { drawBackgroundGrid } from "../../util/helpers/drawBackgroundGrid";
import { useCanvasSettingsContext } from "../../store/CanvasSettingsContext";
import { useAppStateContext } from "../../store/AppStateContext";
import { useSelectedToolContext } from "../../store/SelectedToolContext";
import { getCanvasCtx } from "../../util/helpers/getCanvasContext";
import hsvToCss from "../../util/helpers/hsvToCss";
import { isEdge } from "../../util/helpers/isEdge";

export default function PixelCanvas() {
  const { resolution, zoom, pixelSize } = useCanvasSettingsContext();
  const { isGrab, isGrabbing } = useAppStateContext();
  const { penSize, selectedColor, selectedTool } = useSelectedToolContext();
  const [isDrawing, setIsDrawing] = useState(false);
  const [hoverPos, setHoverPos] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);

  const { logicWidth, logicHeight } = resolution;
  const visualWidth = logicWidth * pixelSize;
  const visualHeight = logicHeight * pixelSize;

  // Store pixel colors as 2D array
  const [pixels, setPixels] = useState<string[][]>(
    Array(logicHeight)
      .fill(null)
      .map(() => Array(logicWidth).fill("transparent")),
  );

  const [history, setHistory] = useState<string[][][]>([]);
  const [historyStep, setHistoryStep] = useState(0);

  useEffect(() => {
    const initial = pixels.map((row) => [...row]);
    setHistory([initial]);
    setHistoryStep(0);
  }, []);

  // Draw background grid on first page render
  useEffect(() => {
    const ctx = getCanvasCtx(gridCanvasRef.current);
    drawBackgroundGrid(ctx, logicHeight, logicWidth, pixelSize);
  }, []);

  // Draw the full grid
  const drawForegroundGrid = () => {
    const ctx = getCanvasCtx(canvasRef.current);
    // Clear canvas from ghost brush
    ctx.clearRect(0, 0, visualWidth, visualHeight);

    // Draw pixels
    for (let row = 0; row < logicHeight; row++) {
      for (let col = 0; col < logicWidth; col++) {
        ctx.fillStyle = pixels[row][col];
        ctx.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
      }
    }
  };

  const drawGhostBrush = () => {
    if (hoverPos && !isDrawing && !isGrab) {
      const ctx = getCanvasCtx(canvasRef.current);
      const { row, col } = hoverPos;

      ctx.fillStyle =
        selectedTool === "eraser" ? "transparent" : hsvToCss(selectedColor);

      for (let dy = 0; dy < penSize; dy++) {
        for (let dx = 0; dx < penSize; dx++) {
          if (penSize > 2 && isEdge(penSize, dy, dx)) continue;

          const r = row + dy;
          const c = col + dx;

          if (r >= 0 && r < logicHeight && c >= 0 && c < logicWidth) {
            ctx.fillRect(c * pixelSize, r * pixelSize, pixelSize, pixelSize);
          }
        }
      }
    }
  };

  useLayoutEffect(() => {
    drawForegroundGrid();
  }, [pixels, hoverPos, isDrawing]);

  useLayoutEffect(() => {
    drawGhostBrush();
  }, [hoverPos]);

  // Convert mouse coordinates to grid cell
  const getCell = (evt: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / zoom;
    const y = (evt.clientY - rect.top) / zoom;
    const col = Math.floor(x / pixelSize);
    const row = Math.floor(y / pixelSize);

    return { row, col };
  };

  const drawPixel = (row: number, col: number) => {
    if (isGrab) return;

    setPixels((prev) => {
      const newPixels = prev.map((r) => [...r]);

      for (let dy = 0; dy < penSize; dy++) {
        for (let dx = 0; dx < penSize; dx++) {
          if (penSize > 2 && isEdge(penSize, dy, dx)) continue;

          const r = row + dy;
          const c = col + dx;

          if (r >= 0 && r < logicHeight && c >= 0 && c < logicWidth) {
            newPixels[r][c] =
              selectedTool === "eraser"
                ? "transparent"
                : hsvToCss(selectedColor);
          }
        }
      }

      return newPixels;
    });
  };

  // HANDLERS
  const handleMouseDown = (e: React.MouseEvent) => {
    const { row, col } = getCell(e);
    drawPixel(row, col);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { row, col } = getCell(e);
    setHoverPos({ row, col });

    if (isDrawing) {
      drawPixel(row, col);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);

    const newPixels = pixels.map((row) => [...row]);

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyStep + 1);
      return [...newHistory, newPixels];
    });

    setHistoryStep((prev) => prev + 1);
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLocaleLowerCase() === "z") {
        e.preventDefault();
        console.log("Pressed");

        setHistoryStep((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (history[historyStep]) {
      setPixels(history[historyStep].map((row) => [...row]));
    }
  }, [historyStep]);

  return (
    <div
      className="relative"
      style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
    >
      <canvas
        style={{ imageRendering: "pixelated" }}
        className="absolute -z-10"
        ref={gridCanvasRef}
        width={visualWidth}
        height={visualHeight}
      />
      <canvas
        style={{ imageRendering: "pixelated" }}
        className={getCursor("canvas", isGrab, isGrabbing)}
        ref={canvasRef}
        width={visualWidth}
        height={visualHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
