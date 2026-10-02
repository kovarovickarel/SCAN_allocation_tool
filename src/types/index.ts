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

export interface AutomaticAllocationTarget {
  id: string;
  role: "engineering" | "management";
  months: readonly { requiredFTE: number; isMaintenance: boolean }[];
  assignments: MonthlyNumericMap;
  maintenancePreferences?: MemberMaintenancePreferences;
}

export interface AutomaticAllocationProject {
  id: string;
  monthOffset: number;
  duration: number;
  targets: readonly AutomaticAllocationTarget[];
}

export type FteMap = Record<string, number>;

export type MilestoneMap = Record<string, number>;

export type FactorMap = Record<string, number>;

export interface FteCostSettings {
  currency: string;
  hourlyRates: Record<string, number | null>;
}

export interface WorkpackageAllocationCost {
  currency: string;
  totalCost: number;
  allocatedHours: number;
  unpricedHours: number;
  missingLocations: string[];
}

export interface ProjectSpendingMember {
  id: string;
  member?: TeamMemberRecord;
  monthlyCosts: WorkpackageAllocationCost[];
  totalCost: WorkpackageAllocationCost;
}

export interface ProjectSpendingTrack {
  id: string;
  name: string;
  tool: string;
  isManagement: boolean;
  monthlyCosts: WorkpackageAllocationCost[];
  totalCost: WorkpackageAllocationCost;
  members: ProjectSpendingMember[];
}

export interface ProjectSpendingTool {
  tool: string;
  tracks: ProjectSpendingTrack[];
  monthlyCosts: WorkpackageAllocationCost[];
  totalCost: WorkpackageAllocationCost;
}

export interface WorkpackageCard {
  id: string;
  name: string;
  tool: string;
  complexity?: string | null;
  reusability?: string;
  customReusabilityFactor?: NumericInput;
  reusabilityAppliesToMaintenance?: boolean;
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
  _allocationCost?: WorkpackageAllocationCost;
}

export interface AllocationProject {
  id: string;
  name: string;
  type: string;
  isRFQ?: boolean;
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
  isExternal?: boolean;
  monthlySalaryCost?: number;
  monthlySalaryCurrency?: string;
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
