import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_VIEWPORT_MARGIN = "500px 0px";

export function useNearViewport<T extends Element>() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [nearViewport, setNearViewport] = useState(false);

  const observe = useCallback((element: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }

    const scrollRoot = element.closest<HTMLElement>("[data-notes-scroll]");
    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(entry.isIntersecting),
      { root: scrollRoot, rootMargin: NEAR_VIEWPORT_MARGIN },
    );
    observer.observe(element);
    observerRef.current = observer;
  }, []);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    },
    [],
  );

  return { nearViewport, observe };
}
