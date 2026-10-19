import { useCallback, useState, useSyncExternalStore, type DependencyList } from "react";
import { WorkspaceHistory, type PlanningState } from "../utils/workspaceHistory";

export function useWorkspaceHistory(initial: () => PlanningState) {
  const [history] = useState(() => new WorkspaceHistory(initial()));
  useSyncExternalStore(history.subscribe, history.getVersion, history.getVersion);
  const [setters] = useState(() => ({
    setFunctions: (value: PlanningState["workpackages"] | ((previous: PlanningState["workpackages"]) => PlanningState["workpackages"])) => history.set("workpackages", value, "Edit workpackages"),
    setProjects: (value: PlanningState["projects"] | ((previous: PlanningState["projects"]) => PlanningState["projects"])) => history.set("projects", value, "Reorder projects"),
    setTeamMembers: (value: PlanningState["teamMembers"] | ((previous: PlanningState["teamMembers"]) => PlanningState["teamMembers"])) => history.set("teamMembers", value, "Edit team members"),
    setConfig: (value: PlanningState["configuration"] | ((previous: PlanningState["configuration"]) => PlanningState["configuration"])) => history.set("configuration", value, "Save configuration"),
    setTeamOtherWPScopes: (value: PlanningState["teamOtherWPScopes"] | ((previous: PlanningState["teamOtherWPScopes"]) => PlanningState["teamOtherWPScopes"])) => history.set("teamOtherWPScopes", value, "Save team scope"),
  }));
  return { history, ...setters, ...history.present, functions: history.present.workpackages, config: history.present.configuration };
}

export function useWorkspaceAction<T extends (...args: any[]) => any>(history: WorkspaceHistory, label: string, action: T, dependencies: DependencyList): T {
  return useCallback(((...args: Parameters<T>) => history.run(label, () => action(...args))) as T, [history, ...dependencies]);
}
