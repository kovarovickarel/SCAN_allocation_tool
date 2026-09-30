import { useEffect } from "react";

export function useEscapeKey(onClose: (() => void) | null | undefined, isEnabled = true) {
  useEffect(() => {
    if (!isEnabled || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isEnabled]);
}
