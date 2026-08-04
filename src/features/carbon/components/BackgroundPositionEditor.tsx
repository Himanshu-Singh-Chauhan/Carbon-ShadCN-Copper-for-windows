import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Icon } from "../../../components/ui/icon";
import type { AppBackgroundPosition } from "../../../lib/model";

const DEFAULT_POSITION: AppBackgroundPosition = { x: 50, y: 50, zoom: 1 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function BackgroundPositionEditor({
  imageUrl,
  initialPosition,
  onCancel,
  onSave,
}: {
  imageUrl: string;
  initialPosition?: AppBackgroundPosition;
  onCancel: () => void;
  onSave: (position: AppBackgroundPosition) => void;
}) {
  const [position, setPosition] = useState(
    initialPosition ?? DEFAULT_POSITION,
  );
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<
    | {
        pointerId: number;
        x: number;
        y: number;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") onSave(position);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, onSave, position]);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setDragging(true);
  }

  function moveImage(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    setPosition((current) => ({
      ...current,
      x: clamp(
        current.x - (deltaX / bounds.width) * (100 / current.zoom),
        0,
        100,
      ),
      y: clamp(
        current.y - (deltaY / bounds.height) * (100 / current.zoom),
        0,
        100,
      ),
    }));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = undefined;
    setDragging(false);
  }

  return (
    <section
      className="absolute inset-0 z-[90] overflow-hidden bg-canvas text-ink"
      aria-label="Edit background position"
      data-no-window-drag
    >
      <div
        className={dragging ? "absolute inset-0 cursor-grabbing" : "absolute inset-0 cursor-grab"}
        data-background-position-canvas
        data-no-window-drag
        onPointerDown={beginDrag}
        onPointerMove={moveImage}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={(event) => {
          event.preventDefault();
          const factor = Math.exp(-event.deltaY * 0.0015);
          setPosition((current) => ({
            ...current,
            zoom: clamp(current.zoom * factor, 1, 6),
          }));
        }}
      >
        <img
          className="pointer-events-none h-full w-full select-none object-cover will-change-transform"
          data-background-position-image
          src={imageUrl}
          alt=""
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          style={{
            objectPosition: `${position.x}% ${position.y}%`,
            transform: `scale(${position.zoom})`,
            transformOrigin: `${position.x}% ${position.y}%`,
          }}
        />
      </div>

      <div
        className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-3"
        data-editor-control
      >
        <button
          type="button"
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-black/55 px-3 text-xs font-semibold text-white shadow-panel backdrop-blur-xl outline-none transition-transform active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70"
          onClick={onCancel}
        >
          <Icon icon={Cancel01Icon} size={14} />
          Cancel
        </button>
        <span className="rounded-xl border border-white/15 bg-black/55 px-3 py-2 text-xs font-semibold text-white shadow-panel backdrop-blur-xl">
          Position background
        </span>
        <button
          type="button"
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white px-3 text-xs font-semibold text-black shadow-panel outline-none transition-transform active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70"
          onClick={() => onSave(position)}
        >
          <Icon icon={CheckmarkCircle02Icon} size={14} />
          Save
        </button>
      </div>

      <div
        className="absolute bottom-3 left-1/2 z-10 flex w-[calc(100%-24px)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/15 bg-black/60 px-3 py-2.5 text-white shadow-float backdrop-blur-2xl"
        data-editor-control
      >
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-white/80 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
          onClick={() => setPosition(DEFAULT_POSITION)}
        >
          Reset
        </button>
        <input
          className="min-w-0 flex-1 cursor-pointer accent-white"
          type="range"
          min="1"
          max="6"
          step="0.01"
          value={position.zoom}
          aria-label="Background zoom"
          onChange={(event) =>
            setPosition((current) => ({
              ...current,
              zoom: Number(event.target.value),
            }))
          }
        />
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-white/75">
          {position.zoom.toFixed(1)}×
        </span>
      </div>

      <p className="pointer-events-none absolute bottom-[62px] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/45 px-2.5 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur-lg">
        Drag to move · Scroll to zoom
      </p>
    </section>
  );
}
