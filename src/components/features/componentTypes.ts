import type React from 'react';
import type { PurchasePaymentDrafts, WorkpackageView } from '../../types';
import type { AllocationProject, FactorMap, ManagementOverhead, MemberMaintenancePreferences, MilestoneMap, MonthlyNumericMap, NumericMap, NumericInput, TeamMemberRecord, ToolDefinition, WorkpackageCard, WorkpackageAllocationMonth, WorkpackageAllocationCost, FteCostSettings, SupplierRecord } from '../../types';
import type { DEFAULT_FTE_RATES, DEFAULT_MGMT_SETTINGS, DEFAULT_OTHER_SETTINGS, DEFAULT_TOOL_FTE_RATES } from '../../constants';

export interface SvgIconProps {
  size?: number;
  className?: string;
}

export interface ToolIconProps extends SvgIconProps {
  toolName: string;
}

// ============================================================
// 1. CONSTANTS, SYSTEM DEFAULTS & THEMES
// ============================================================

export type CardEditHandler = (
  cardId: string,
  startEditing?: boolean,
  draft?: Partial<WorkpackageCard> | null
) => void;

interface ReusabilityRatesProps {
  fteRates?: typeof DEFAULT_FTE_RATES;
  toolFteRates?: typeof DEFAULT_TOOL_FTE_RATES;
}

export interface EditCardContentProps extends ReusabilityRatesProps {
  card: WorkpackageCard;
  reusabilityFactors?: FactorMap;
  onEdit: CardEditHandler;
  projectDuration?: number;
  projectMilestones?: MilestoneMap;
}

export interface FunctionCardProps extends ReusabilityRatesProps {
  card: WorkpackageCard;
  reusabilityFactors?: FactorMap;
  teamMembers?: TeamMemberRecord[];
  projectId?: string | null;
  projectDuration?: number;
  projectMilestones?: MilestoneMap;
  isCompact?: boolean;
  onEdit?: CardEditHandler;
  onDelete?: (cardId: string) => void;
  onDragStart?: (card: WorkpackageCard) => void;
  onDragEnd?: (event?: React.DragEvent<HTMLElement>) => void;
  draggedCard?: WorkpackageCard | null;
}

export interface ManagementOverheadsProps {
  allocationCosts: ReadonlyMap<string, WorkpackageAllocationCost>;
  overheads: ManagementOverhead[];
  project: AllocationProject;
  teamMembers?: TeamMemberRecord[];
  isCompact?: boolean;
}

export interface ToolRowProps extends ReusabilityRatesProps {
  project?: AllocationProject;
  workpackageView?: WorkpackageView;
  suppliers?: readonly SupplierRecord[];
  fteCosts?: FteCostSettings;
  managementAllocationCost?: WorkpackageAllocationCost;
  tool: ToolDefinition;
  reusabilityFactors?: FactorMap;
  teamMembers?: TeamMemberRecord[];
  toolCards?: WorkpackageCard[];
  projectId: string;
  projectDuration: number;
  projectMilestones: MilestoneMap;
  isCompact?: boolean;
  onEdit?: CardEditHandler;
  onDelete?: (cardId: string) => void;
  onDrop?: (cardId: string, projectId: string) => void;
  onDragStart?: (card: WorkpackageCard) => void;
  onDragEnd?: (event?: React.DragEvent<HTMLElement>) => void;
  draggedCard?: WorkpackageCard | null;
  hiddenSubcategories?: string[];
  onToggleSubcategory?: (projectId: string, subcategory: string) => void;
  onToggleTool?: (projectId: string, toolName: string) => void;
}

export interface SubcategoryManagerModalProps {
  project: AllocationProject;
  onClose: () => void;
  onToggleSubcategory: (projectId: string, subcategory: string) => void;
  onToggleTool: (projectId: string, toolName: string) => void;
  onResetSubcategories: (projectId: string) => void;
  activeToolView?: string;
}

export interface UnassignedPoolProps extends ReusabilityRatesProps {
  suppliers?: readonly SupplierRecord[];
  workpackageKind?: "fte" | "non-fte";
  onChangeWorkpackageKind?: (kind: "fte" | "non-fte") => void;
  cards: WorkpackageCard[];
  reusabilityFactors?: FactorMap;
  onEdit: CardEditHandler;
  onDelete: (cardId: string) => void;
  onDrop: (cardId: string, projectId: string) => void;
  onDragStart: (card: WorkpackageCard) => void;
  onDragEnd: (event?: React.DragEvent<HTMLElement>) => void;
  draggedCard: WorkpackageCard | null;
  onAddClick: () => void;
  activeToolView?: string;
  isSplitView?: boolean;
  isCompact?: boolean;
  onToggleCompact: () => void;
}

export interface TeamMembersPoolProps {
  toolName: string;
  members: TeamMemberRecord[];
  allMembers: TeamMemberRecord[];
  onAddClick: () => void;
  onEditMember: (member: TeamMemberRecord) => void;
  onDeleteMember: (memberId: string) => void;
  isCompact?: boolean;
  onToggleCompact: () => void;
  onOpenTimeline: () => void;
}

export interface AddTeamMemberModalProps {
  toolName: string;
  defaultCurrency?: string;
  initialMember?: TeamMemberRecord | null;
  allMembers?: TeamMemberRecord[];
  onClose: () => void;
  onSave: (member: TeamMemberRecord) => void;
}

export interface AddFunctionModalProps extends ReusabilityRatesProps {
  onClose: () => void;
  reusabilityFactors?: FactorMap;
  onAdd: (card: WorkpackageCard) => void;
  otherDefaults?: typeof DEFAULT_OTHER_SETTINGS;
  activeToolView?: string;
}

export interface AddFunctionDraft {
  name: string;
  tool: string;
  complexity: string | null;
  reusability: string;
  customReusabilityFactor: NumericInput;
  reusabilityAppliesToMaintenance: boolean;
  subcategory: string | null;
  otherEffort: NumericInput;
  otherDuration: NumericInput;
  otherFinishMilestone: string | null;
  otherHasMaintenance: boolean;
  otherMaintenanceEffort: NumericInput;
}

export interface AddProjectModalProps {
  onClose: () => void;
  onAdd: (project: AllocationProject) => void;
  stabilityFactors?: FactorMap;
}

export interface AddProjectDraft {
  name: string;
  type: string;
  isRFQ: boolean;
  duration: NumericInput;
  stability: string;
  startDate: string;
  milestones: MilestoneMap;
}

export interface ProjectTimelineModalProps {
  project: AllocationProject;
  cards: WorkpackageCard[];
  toolFteRates: typeof DEFAULT_TOOL_FTE_RATES;
  fteRates: typeof DEFAULT_FTE_RATES;
  mgmtSettings?: typeof DEFAULT_MGMT_SETTINGS;
  reusabilityFactors?: FactorMap;
  stabilityFactors?: FactorMap;
  onSaveTimeline: (
    projectId: string,
    customMgmtMonthlyFTE: Record<string, NumericMap>,
    updatedCards: WorkpackageCard[]
  ) => void;
  onClose: () => void;
  activeToolView?: string;
}

export interface AssignMemberToWPModalProps {
  card: WorkpackageCard;
  project: AllocationProject;
  members?: TeamMemberRecord[];
  crossTeamMemberIds?: ReadonlySet<string>;
  allCards?: WorkpackageCard[];
  allocationMonths: readonly WorkpackageAllocationMonth[];
  onSave: (cardId: string, assignments: NumericMap, monthlyAssignments: MonthlyNumericMap) => void;
  onClose: () => void;
}

export interface AdjustMemberAllocationModalProps {
  card: WorkpackageCard;
  member: TeamMemberRecord;
  isCrossTeam?: boolean;
  project: AllocationProject;
  allCards?: WorkpackageCard[];
  allProjects?: AllocationProject[];
  currentAllocationFTE?: number;
  otherCommitmentFTE?: number;
  initialIncludeMaintenance?: boolean;
  allocationMonths?: readonly {
    maxFTE: number;
    isMaintenance: boolean;
    currentFTE: number;
    requiredFTE: number;
    phaseLabel: string;
  }[];
  onSave: (fte: number, includeMaintenance: boolean) => void;
  onClose: () => void;
}

export interface TeamTimelineModalProps {
  fteCosts?: FteCostSettings;
  toolName: string;
  initialShowOtherWPs?: boolean;
  initialExcludedOtherWPIds?: readonly string[];
  onSaveOtherWPs?: (showOtherWPs: boolean, excludedOtherWPIds: string[]) => void;
  members?: TeamMemberRecord[];
  allMembers?: TeamMemberRecord[];
  projects?: AllocationProject[];
  cards?: WorkpackageCard[];
  toolFteRates: typeof DEFAULT_TOOL_FTE_RATES;
  fteRates: typeof DEFAULT_FTE_RATES;
  mgmtSettings?: typeof DEFAULT_MGMT_SETTINGS;
  reusabilityFactors?: FactorMap;
  stabilityFactors?: FactorMap;
  onClose: () => void;
  onSaveAssignments?: (cardId: string, assignments: NumericMap) => void;
  onSaveMonthlyAssignments?: (
    cardId: string,
    assignments: MonthlyNumericMap,
    maintenancePreferences?: MemberMaintenancePreferences
  ) => void;
  onSaveMgmtAssignments?: (projectId: string, toolName: string, assignments: NumericMap) => void;
  onSaveMgmtMonthlyAssignments?: (
    projectId: string,
    toolName: string,
    assignments: MonthlyNumericMap,
    maintenancePreferences?: MemberMaintenancePreferences
  ) => void;
}

export interface TeamAllocationPriorityModalProps {
  toolName: string;
  projects: readonly { id: string; name: string; workpackageCount: number }[];
  initialPriorities: NumericMap;
  onConfirm: (priorities: NumericMap) => void;
  onClose: () => void;
}

export interface ProjectBasketProps {
  suppliers?: readonly SupplierRecord[];
  fteCosts?: FteCostSettings;
  project: AllocationProject;
  cards: WorkpackageCard[];
  teamMembers?: TeamMemberRecord[];
  index: number;
  onEdit: CardEditHandler;
  onDelete: (cardId: string) => void;
  onDrop: (cardId: string, projectId: string) => void;
  onDragStart: (card: WorkpackageCard) => void;
  onDragEnd: (event?: React.DragEvent<HTMLElement>) => void;
  draggedCard: WorkpackageCard | null;
  draggedProjectIndex: number | null;
  targetProjectIndex: number | null;
  onProjectDragStart: (index: number) => void;
  onProjectDragEnd: () => void;
  onProjectDrop: (draggedIndex: number, targetIndex: number) => void;
  onUpdateProject: (projectId: string, updates: Partial<AllocationProject>) => void;
  onDeleteProject: (projectId: string) => void;
  onToggleSubcategory: (projectId: string, subcategory: string) => void;
  onToggleTool: (projectId: string, toolName: string) => void;
  onResetSubcategories: (projectId: string) => void;
  onSaveTimeline: ProjectTimelineModalProps["onSaveTimeline"];
  onSavePurchasePayments?: (projectId: string, drafts: PurchasePaymentDrafts) => boolean;
  stabilityFactors?: FactorMap;
  reusabilityFactors?: FactorMap;
  mgmtSettings?: typeof DEFAULT_MGMT_SETTINGS;
  toolFteRates: typeof DEFAULT_TOOL_FTE_RATES;
  fteRates: typeof DEFAULT_FTE_RATES;
  activeToolView?: string;
}
