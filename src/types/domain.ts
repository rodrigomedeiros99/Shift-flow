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
  reason: string | null;
  createdAt: ISODateTime;
}

/** A dock door a leader marked active for a plan (inbound Step 4). */
export interface PlanDockDoor {
  id: UUID;
  dailyPlanId: UUID;
  dockDoorId: UUID;
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
