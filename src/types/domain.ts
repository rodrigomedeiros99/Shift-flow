/**
 * Core domain types for ShiftFlow.
 * These mirror the database schema (Database Schema v1.0 Parts 1–3) and are the
 * shared, reusable types referenced across features (§4 Shared Types). Feature
 * modules should extend these rather than redefining entity shapes.
 *
 * Note: these describe the application's domain model. Row-level Supabase types
 * (snake_case, generated) are introduced alongside data access in later phases;
 * this file intentionally stays framework-agnostic.
 */

import type { UserRole } from '@/lib/constants/roles';
import type {
  AbsenceType,
  ActivityAction,
  AssignmentStatus,
  AssignmentType,
  PlanStatus,
  SpecialAssignmentType,
} from '@/lib/constants/assignments';
import type { DepartmentKind } from '@/lib/constants/departments';

/** Branded UUID alias to make entity references self-documenting. */
export type UUID = string;
export type ISODateTime = string;
/** Calendar date in `YYYY-MM-DD` form. */
export type ISODate = string;

// --- Organization -----------------------------------------------------------

export interface Facility {
  id: UUID;
  name: string;
  code: string;
  active: boolean;
  createdAt: ISODateTime;
}

export interface Department {
  id: UUID;
  facilityId: UUID;
  name: string;
  /** Drives the planning flow (inbound = dock-door, outbound = task). */
  kind: DepartmentKind;
  active: boolean;
  createdAt: ISODateTime;
}

export interface ShiftKey {
  id: UUID;
  facilityId: UUID;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: string;
  /** Productive hours for the UPH calculator, or null until configured. */
  productiveHours: number | null;
  active: boolean;
}

// --- Workforce --------------------------------------------------------------

export interface EquipmentType {
  id: UUID;
  facilityId: UUID;
  name: string;
  certificationRequired: boolean;
  active: boolean;
}

export interface Associate {
  id: UUID;
  facilityId: UUID;
  firstName: string;
  lastName: string;
  employeeId: string | null;
  departmentId: UUID;
  defaultKeyId: UUID;
  active: boolean;
  notes: string | null;
  createdAt: ISODateTime;
}

export interface AssociateCertification {
  id: UUID;
  associateId: UUID;
  equipmentId: UUID;
  certified: boolean;
  certifiedAt: ISODateTime | null;
}

// --- Operations -------------------------------------------------------------

export interface TaskType {
  id: UUID;
  facilityId: UUID;
  departmentId: UUID;
  name: string;
  defaultEquipmentId: UUID | null;
  /** Inbound: staffed per active dock door (one position per door), not by count. */
  needsDockDoor: boolean;
  /** Whether the UPH labor calculator applies to this task. */
  usesUph: boolean;
  /** Configured Units Per Hour, or null until a supervisor sets it. */
  avgUnitsPerHour: number | null;
  active: boolean;
  sortOrder: number;
  createdAt: ISODateTime;
}

export interface DockDoor {
  id: UUID;
  facilityId: UUID;
  doorNumber: string;
  active: boolean;
  notes: string | null;
  sortOrder: number;
}

// --- Templates ---------------------------------------------------------------

export interface PlanTemplate {
  id: UUID;
  facilityId: UUID;
  departmentId: UUID;
  shiftKeyId: UUID;
  name: string;
  active: boolean;
  createdBy: UUID | null;
  createdAt: ISODateTime;
}

export interface TemplateItem {
  id: UUID;
  templateId: UUID;
  taskTypeId: UUID | null;
  dockDoorId: UUID | null;
  defaultEquipmentId: UUID | null;
  peopleNeeded: number;
  sortOrder: number;
  /** Inbound: expand to one slot per active dock door at generation time. */
  perActiveDoor: boolean;
  notes: string | null;
}

// --- Planning ---------------------------------------------------------------

export interface DailyPlan {
  id: UUID;
  facilityId: UUID;
  departmentId: UUID;
  shiftKeyId: UUID;
  planDate: ISODate;
  version: number;
  status: PlanStatus;
  middleMileOwner: 'outbound' | 'inbound' | null;
  createdBy: UUID;
  publishedAt: ISODateTime | null;
  closedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

export interface Assignment {
  id: UUID;
  dailyPlanId: UUID;
  associateId: UUID;
  taskTypeId: UUID | null;
  equipmentId: UUID | null;
  dockDoorId: UUID | null;
  assignmentType: AssignmentType;
  status: AssignmentStatus;
  notes: string | null;
  isPrimaryPlanned: boolean;
  startedAt: ISODateTime | null;
  endedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

export interface SpecialAssignment {
  id: UUID;
  dailyPlanId: UUID;
  associateId: UUID;
  type: SpecialAssignmentType;
  taskTypeId: UUID | null;
  equipmentId: UUID | null;
  dockDoorId: UUID | null;
  relatedAssociateId: UUID | null;
  notes: string | null;
  createdAt: ISODateTime;
}

export interface CallOff {
  id: UUID;
  dailyPlanId: UUID;
  associateId: UUID;
  type: AbsenceType;
  reason: string | null;
  createdAt: ISODateTime;
}

/** A dock door a leader marked active for a plan (inbound Step 4). */
export interface PlanDockDoor {
  id: UUID;
  dailyPlanId: UUID;
  dockDoorId: UUID;
  /** Equipment chosen for this door today (optional; changes daily). */
  equipmentId: UUID | null;
  createdAt: ISODateTime;
}

export interface PlannedAssignmentHistory {
  id: UUID;
  dailyPlanId: UUID;
  associateId: UUID;
  departmentId: UUID;
  shiftKeyId: UUID;
  taskTypeId: UUID | null;
  equipmentId: UUID | null;
  dockDoorId: UUID | null;
  planDate: ISODate;
  createdAt: ISODateTime;
}

/** One recorded in-day change to the live board (Live Operations, PRD §4.1). */
export interface ActivityHistory {
  id: UUID;
  dailyPlanId: UUID;
  associateId: UUID;
  fromTaskTypeId: UUID | null;
  toTaskTypeId: UUID | null;
  fromEquipmentId: UUID | null;
  toEquipmentId: UUID | null;
  fromDockDoorId: UUID | null;
  toDockDoorId: UUID | null;
  actionType: ActivityAction;
  reason: string | null;
  changedBy: UUID | null;
  changedAt: ISODateTime;
}

/** Append-only audit trail of important actions (Phase 10, Database Schema Part 3). */
export interface AuditLog {
  id: UUID;
  facilityId: UUID;
  userId: UUID | null;
  dailyPlanId: UUID | null;
  actionType: string;
  entityType: string | null;
  entityId: UUID | null;
  createdAt: ISODateTime;
}

// --- Security ---------------------------------------------------------------

export interface Profile {
  id: UUID;
  fullName: string;
  email: string;
  role: UserRole;
  facilityId: UUID;
  departmentId: UUID | null;
  active: boolean;
  createdAt: ISODateTime;
}

// --- Notifications ----------------------------------------------------------

/** Operational notification categories (Phase 1 of the Notification Center). */
export type NotificationType =
  | 'plan_published'
  | 'draft_exists'
  | 'staffing_warning'
  | 'rotation_alert'
  | 'uph_warning';

/** Visual/urgency tier for a notification. */
export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface Notification {
  id: UUID;
  facilityId: UUID;
  /** Recipient; null is reserved for a future facility/role broadcast. */
  userId: UUID | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  /** Route to open when the notification is clicked. */
  link: string | null;
  dailyPlanId: UUID | null;
  isRead: boolean;
  readAt: ISODateTime | null;
  createdAt: ISODateTime;
}

// --- Load Priority Board -----------------------------------------------------

/** Lifecycle of a daily Load Priority board. */
export type LoadPriorityStatus = 'draft' | 'published' | 'closed';

/** Open/closed state of a single door entry. */
export type LoadPriorityDoorStatus = 'open' | 'closed';

/** A configurable zone range: Zone N covers door numbers doorLow..doorHigh. */
export interface LoadPriorityZone {
  id: UUID;
  facilityId: UUID;
  zone: number;
  doorLow: number;
  doorHigh: number;
  active: boolean;
  sortOrder: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * One recurring row of the Weekly Master Schedule: a door's default lane/carrier,
 * close time, and zone for a given weekday (0 = Sunday … 6 = Saturday). Active
 * rows are copied (snapshotted) into a daily board.
 */
export interface LoadPriorityWeeklySchedule {
  id: UUID;
  facilityId: UUID;
  weekday: number;
  doorNumber: string;
  laneNumber: string | null;
  carrierLabel: string | null;
  /** `HH:MM` (24h) local close time. */
  closeTime: string;
  zone: number;
  active: boolean;
  notes: string | null;
  sortOrder: number;
  createdBy: UUID | null;
  updatedBy: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** A daily Load Priority board for a date + shift key. */
export interface LoadPriorityBoard {
  id: UUID;
  facilityId: UUID;
  shiftKeyId: UUID;
  boardDate: ISODate;
  status: LoadPriorityStatus;
  createdBy: UUID | null;
  publishedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** One door priority on a board — lane/carrier/zone/close are snapshots. */
export interface LoadPriorityEntry {
  id: UUID;
  boardId: UUID;
  facilityId: UUID;
  doorNumber: string;
  zone: number;
  laneNumberSnapshot: string | null;
  carrierLabelSnapshot: string | null;
  /** `HH:MM` (24h) close time for today, or null if none. */
  closeTime: string | null;
  status: LoadPriorityDoorStatus;
  closedAt: ISODateTime | null;
  closedBy: UUID | null;
  notes: string | null;
  sortOrder: number;
  /** Weekly row this entry was copied from, or null for one-off/imported doors. */
  sourceWeeklyScheduleId: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
