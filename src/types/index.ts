import type { Dispatch, SetStateAction } from "react";

export type NumericInput = number | string;

export type NumericMap = Record<string, number>;

/** One-based purchase months mapped to integer EUR cents, scoped by workpackage ID. */
export type PurchasePaymentDrafts = Record<string, NumericMap>;
export type PurchasePaymentSchedule = Pick<WorkpackageCard, "id" | "purchasePaymentOverrides">;

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
  /** Purchases are entered in EUR, independently of the FTE rate currency. */
  purchaseCostEUR?: number;
  /** One charge per external member and calendar month, shared by allocated effort. */
  externalSalaryCharges?: Record<string, ExternalSalaryCharge>;
}

export interface ExternalSalaryCharge {
  currency: string;
  salary: number;
  allocatedFTE: number;
  capacityFTE: number;
  totalAllocatedFTE?: number;
  /** Delay from the earned month to the cash payment; ledger keys remain earned months. */
  paymentDelayMonths?: number;
}

export interface SupplierRecord { id: string; name: string; }
export type PurchaseType = "License" | "Workstation" | "Hardware" | "Contracted workpackage";
export type WorkpackageView = "fte" | "non-fte" | "both";
export type PurchasePaymentMode = "at-once" | "even" | "split";

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
  isNonFte?: boolean;
  requiredEffort?: number[];
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
  kind?: "fte" | "non-fte";
  purchaseType?: PurchaseType;
  purchasePriceEUR?: number;
  supplierId?: string;
  supplierName?: string;
  purchaseMilestone?: string | null;
  /** One-based project months. */
  purchaseMonths?: number[];
  /** Absolute EUR payments by one-based project month, manually overridden in Spending. */
  purchasePaymentOverrides?: NumericMap;
  purchasePaymentMode?: PurchasePaymentMode;
  /** Fractions of the final price keyed by one-based project month. */
  purchasePaymentShares?: NumericMap;
  complexity?: string | null;
  reusability?: string;
  customReusabilityFactor?: NumericInput;
  reusabilityAppliesToMaintenance?: boolean;
  subcategory?: string | null;
  projectId?: string | null;
  /** Deadline for standard FTE pre-maintenance phases; Other retains otherFinishMilestone. */
  finishMilestone?: string | null;
  /** Project-relative first active month for standard FTE workpackages. */
  startMonth?: NumericInput | null;
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
  /** Defaults to true for projects created before this setting existed. */
  autoStartFte?: boolean;
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
  supplierId?: string;
  monthlySalaryCost?: number;
  monthlySalaryCurrency?: string;
  deferredPayment?: boolean;
  paymentDelayMonths?: number;
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
