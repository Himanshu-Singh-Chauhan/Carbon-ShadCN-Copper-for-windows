import { useEffect, useRef } from "react";

export function useRightClickDragScroll<T extends HTMLElement = HTMLElement>() {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isPointerDown = false;
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocityY = 0;
    let animationFrameId: number | null = null;

    const stopMomentum = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) {
        return;
      }

      stopMomentum();
      isPointerDown = true;
      isDragging = false;
      startY = e.clientY;
      startScrollTop = container.scrollTop;
      lastY = e.clientY;
      lastTime = performance.now();
      velocityY = 0;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return;

      const deltaY = e.clientY - startY;
      const distance = Math.abs(deltaY);

      if (!isDragging && distance > 4) {
        isDragging = true;
        document.body.classList.add("right-click-dragging");
      }

      if (isDragging) {
        container.scrollTop = startScrollTop - deltaY;

        const now = performance.now();
        const dt = now - lastTime;
        if (dt > 0) {
          const instantV = (lastY - e.clientY) / dt;
          velocityY = 0.6 * instantV + 0.4 * velocityY;
          lastY = e.clientY;
          lastTime = now;
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button !== 2 || !isPointerDown) return;
      isPointerDown = false;

      if (isDragging) {
        document.body.classList.remove("right-click-dragging");

        const preventContextMenu = (cmEvent: MouseEvent) => {
          cmEvent.preventDefault();
          cmEvent.stopPropagation();
        };

        window.addEventListener("contextmenu", preventContextMenu, {
          capture: true,
          once: true,
        });

        setTimeout(() => {
          window.removeEventListener("contextmenu", preventContextMenu, {
            capture: true,
          });
        }, 100);

        if (Math.abs(velocityY) > 0.05) {
          let lastFrameTime = performance.now();
          const step = (now: number) => {
            const dt = Math.min(now - lastFrameTime, 32);
            lastFrameTime = now;

            container.scrollTop += velocityY * dt;
            velocityY *= 0.92;

            if (
              Math.abs(velocityY) > 0.02 &&
              container.scrollTop > 0 &&
              container.scrollTop < container.scrollHeight - container.clientHeight
            ) {
              animationFrameId = requestAnimationFrame(step);
            } else {
              animationFrameId = null;
            }
          };
          animationFrameId = requestAnimationFrame(step);
        }
      }
    };

    container.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      stopMomentum();
      document.body.classList.remove("right-click-dragging");
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  return containerRef;
}
