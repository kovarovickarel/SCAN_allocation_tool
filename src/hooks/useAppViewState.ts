import { useCallback, useState } from "react";

export function useAppViewState() {
  const [theme, setTheme] = useState("vibrant");
  const [appMode, setAppMode] = useState("extended");
  const [activeToolView, setActiveToolView] = useState("all");
  const [showTeamTimeline, setShowTeamTimeline] = useState(false);
  const [isTeamBucketCompact, setIsTeamBucketCompact] = useState(() => {
    try {
      return localStorage.getItem("scan_team_bucket_compact") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleTeamBucketCompact = useCallback(() => {
    setIsTeamBucketCompact((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("scan_team_bucket_compact", String(next));
      } catch {}
      return next;
    });
  }, []);

  const [isWorkpackagePoolCompact, setIsWorkpackagePoolCompact] = useState(() => {
    try {
      return localStorage.getItem("scan_wp_pool_compact") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleWorkpackagePoolCompact = useCallback(() => {
    setIsWorkpackagePoolCompact((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("scan_wp_pool_compact", String(next));
      } catch {}
      return next;
    });
  }, []);

  const restoreViewPreferences = useCallback((view: { theme: string; mode: string; activeToolView: string; teamCompact: boolean; poolCompact: boolean }) => {
    setTheme(view.theme); setAppMode(view.mode); setActiveToolView(view.activeToolView);
    setIsTeamBucketCompact(view.teamCompact); setIsWorkpackagePoolCompact(view.poolCompact);
    setShowTeamTimeline(false);
    try {
      localStorage.setItem("scan_team_bucket_compact", String(view.teamCompact));
      localStorage.setItem("scan_wp_pool_compact", String(view.poolCompact));
    } catch {}
  }, []);

  const isBasic = theme === "basic";
  const isRetro = theme === "retro";
  const isBasicMode = appMode === "basic";

  return {
    theme,
    setTheme,
    appMode,
    setAppMode,
    activeToolView,
    setActiveToolView,
    showTeamTimeline,
    setShowTeamTimeline,
    isTeamBucketCompact,
    handleToggleTeamBucketCompact,
    isWorkpackagePoolCompact,
    handleToggleWorkpackagePoolCompact,
    isBasic,
    isRetro,
    isBasicMode,
    restoreViewPreferences,
  };
}
