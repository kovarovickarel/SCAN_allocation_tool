import type { Dispatch, SetStateAction } from "react";

export type NumericInput = number | string;

export type NumericMap = Record<string, number>;

export type MonthlyNumericMap = Record<string, NumericMap>;

export type MemberMaintenancePreferences = Record<string, boolean>;

export interface WorkpackageAllocationMonth {
  requiredFTE: number;
  allocations: NumericMap;
  available: NumericMap;
}

export type FteMap = Record<string, number>;

export type MilestoneMap = Record<string, number>;

export type FactorMap = Record<string, number>;

export interface WorkpackageCard {
  id: string;
  name: string;
  tool: string;
  complexity?: string | null;
  reusability?: string;
  subcategory?: string | null;
  projectId?: string | null;
  otherEffort?: NumericInput;
  otherDuration?: NumericInput;
  otherStartMonth?: NumericInput | null;
  otherFinishMilestone?: string | null;
  otherHasMaintenance?: boolean;
  otherMaintenanceEffort?: NumericInput;
  memberAssignments?: NumericMap;
  memberMonthlyAssignments?: MonthlyNumericMap;
  memberMaintenancePreferences?: MemberMaintenancePreferences;
  customCoreFTE?: FteMap;
  customDevSupportFTE?: FteMap;
  customMeetingsFTE?: FteMap;
  _editing?: boolean;
  _isAltered?: boolean;
  _isMgmt?: boolean;
  _isNegated?: boolean;
  _nominalFte?: number;
  _fte?: number;
  _coveragePct?: number;
  _isMaintenanceOnlyUncovered?: boolean;
}

export interface AllocationProject {
  id: string;
  name: string;
  type: string;
  startDate: string;
  duration: number;
  stability: string;
  milestones: MilestoneMap;
  hiddenSubcategories?: string[];
  hiddenTools?: string[];
  customMgmtMonthlyFTE?: Record<string, NumericMap>;
  mgmtMemberAssignments?: Record<string, NumericMap>;
  mgmtMemberMonthlyAssignments?: Record<string, MonthlyNumericMap>;
  mgmtMemberMaintenancePreferences?: Record<string, MemberMaintenancePreferences>;
  subSet?: string[];
  toolSet?: string[];
}

export type TeamMemberRole = "engineering" | "management" | "both";

export interface TeamMemberRecord {
  id: string;
  firstName: string;
  lastName: string;
  tool: string;
  fte: NumericInput;
  role: TeamMemberRole;
  footprint: string;
}

export interface ToolDefinition {
  name: string;
  color: string;
  border: string;
  accent: string;
  text: string;
  subcategories: string[] | null;
}

export interface ManagementOverhead {
  tool: string;
  fte: number;
  engFTE: number;
  isAltered: boolean;
}

export interface ThemeContextValue {
  theme: string;
  isBasic: boolean;
  isRetro: boolean;
  mode: string;
  isBasicMode: boolean;
  setTheme?: Dispatch<SetStateAction<string>>;
}

declare global {
  function parseFloat(value: NumericInput | null | undefined): number;
  function parseInt(value: NumericInput | null | undefined, radix?: number): number;

  interface Window {
    __scan_dragged_card_id?: string;
  }
}

declare module "react" {
  interface SVGAttributes<T> {
    title?: string;
  }
}
