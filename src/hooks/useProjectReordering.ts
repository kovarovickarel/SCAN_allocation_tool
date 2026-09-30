import { useCallback, useEffect, useRef, type Dispatch, type DragEvent as ReactDragEvent, type SetStateAction } from "react";

type ProjectReorderingOptions<TProject> = {
  projects: TProject[];
  setProjects: Dispatch<SetStateAction<TProject[]>>;
  draggedProjectIndex: number | null;
  setDraggedProjectIndex: Dispatch<SetStateAction<number | null>>;
  setTargetProjectIndex: Dispatch<SetStateAction<number | null>>;
};

export function useProjectReordering<TProject>({
  projects,
  setProjects,
  draggedProjectIndex,
  setDraggedProjectIndex,
  setTargetProjectIndex,
}: ProjectReorderingOptions<TProject>) {
  const slotRefs = useRef([]);
  const projectContainerRef = useRef(null);
  const autoScrollRafRef = useRef(null);
  const autoScrollSpeedRef = useRef(0);
  const lastMouseXRef = useRef(0);
  const draggedProjectIndexRef = useRef(null);
  const projectsCountRef = useRef(projects.length);

  useEffect(() => {
    draggedProjectIndexRef.current = draggedProjectIndex;
  }, [draggedProjectIndex]);

  useEffect(() => {
    projectsCountRef.current = projects.length;
  }, [projects.length]);

  const updateTargetIndexFromX = useCallback((mouseX: number) => {
    const slots = slotRefs.current;
    if (!slots || slots.length === 0) return;

    let closestIndex = draggedProjectIndexRef.current;
    let minDistance = Infinity;

    for (let i = 0; i < projectsCountRef.current; i++) {
      const el = slots[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;

      if (mouseX >= rect.left && mouseX <= rect.right) {
        closestIndex = i;
        minDistance = 0;
        break;
      }

      const dist = Math.abs(mouseX - midX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    setTargetProjectIndex((prev) => (prev !== closestIndex ? closestIndex : prev));
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
  }, []);

  const startAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current) return;
    const scrollLoop = () => {
      if (projectContainerRef.current && autoScrollSpeedRef.current !== 0) {
        projectContainerRef.current.scrollLeft += autoScrollSpeedRef.current;
        if (lastMouseXRef.current > 0) {
          updateTargetIndexFromX(lastMouseXRef.current);
        }
      }
      autoScrollRafRef.current = requestAnimationFrame(scrollLoop);
    };
    autoScrollRafRef.current = requestAnimationFrame(scrollLoop);
  }, [updateTargetIndexFromX]);

  useEffect(() => {
    if (draggedProjectIndex === null) {
      stopAutoScroll();
      return;
    }

    const handleWindowDragOver = (e) => {
      lastMouseXRef.current = e.clientX;
      const container = projectContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const edgeThreshold = 140;

      if (e.clientX < containerRect.left + edgeThreshold) {
        if (e.clientX >= containerRect.left) {
          const ratio = (containerRect.left + edgeThreshold - e.clientX) / edgeThreshold;
          autoScrollSpeedRef.current = -Math.round(14 + ratio * 22);
        } else {
          const overDistance = containerRect.left - e.clientX;
          const outsideBoost = Math.min(60, overDistance * 0.35);
          autoScrollSpeedRef.current = -Math.round(36 + outsideBoost);
        }
        startAutoScroll();
      } else if (e.clientX > containerRect.right - edgeThreshold) {
        if (e.clientX <= containerRect.right) {
          const ratio = (e.clientX - (containerRect.right - edgeThreshold)) / edgeThreshold;
          autoScrollSpeedRef.current = Math.round(14 + ratio * 22);
        } else {
          const overDistance = e.clientX - containerRect.right;
          const outsideBoost = Math.min(60, overDistance * 0.35);
          autoScrollSpeedRef.current = Math.round(36 + outsideBoost);
        }
        startAutoScroll();
      } else {
        autoScrollSpeedRef.current = 0;
      }
    };

    window.addEventListener("dragover", handleWindowDragOver);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
    };
  }, [draggedProjectIndex, startAutoScroll, stopAutoScroll]);

  const handleProjectDragStart = useCallback((index: number) => {
    setDraggedProjectIndex(index);
    setTargetProjectIndex(index);
  }, []);

  const handleProjectDragEnd = useCallback(() => {
    setDraggedProjectIndex(null);
    setTargetProjectIndex(null);
    stopAutoScroll();
  }, [stopAutoScroll]);

  const handleProjectContainerDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (draggedProjectIndex === null) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    lastMouseXRef.current = e.clientX;
    updateTargetIndexFromX(e.clientX);
  }, [draggedProjectIndex, updateTargetIndexFromX]);

  const handleProjectDrop = useCallback((fromIndex: number | null, toIndex: number | null) => {
    setDraggedProjectIndex(null);
    setTargetProjectIndex(null);
    stopAutoScroll();
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    setProjects((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, [stopAutoScroll]);
  return {
    slotRefs,
    projectContainerRef,
    stopAutoScroll,
    handleProjectDragStart,
    handleProjectDragEnd,
    handleProjectContainerDragOver,
    handleProjectDrop,
  };
}
