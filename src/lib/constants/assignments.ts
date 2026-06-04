/**
 * Assignment status & type vocabularies.
 * Ref: PRD §4 (Assignment Statuses), Database Schema Part 2 (assignments,
 * special_assignments). Kept as the single source of truth so planning, the
 * dashboard, and TV Mode render identical labels and colors.
 */

/** Live operational state of an associate within a plan (PRD §4). */
export const ASSIGNMENT_STATUSES = [
  'assigned',
  'active',
  'available',
  'break',
  'lunch',
  'training',
  'overtime',
  'completed',
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: 'Assigned',
  active: 'Active',
  available: 'Available',
  break: 'Break',
  lunch: 'Lunch',
  training: 'Training',
  overtime: 'Overtime',
  completed: 'Completed',
};

/**
 * Tailwind classes per status, driven by the `--color-status-*` design tokens
 * (§5 Status Indicators). Returned as background + text pairs for badges.
 */
export const ASSIGNMENT_STATUS_CLASSES: Record<AssignmentStatus, string> = {
  assigned: 'bg-status-assigned/15 text-status-assigned',
  active: 'bg-status-active/15 text-status-active',
  available: 'bg-status-available/15 text-status-available',
  break: 'bg-status-break/15 text-status-break',
  lunch: 'bg-status-lunch/15 text-status-lunch',
  training: 'bg-status-training/15 text-status-training',
  overtime: 'bg-status-overtime/15 text-status-overtime',
  completed: 'bg-status-completed/15 text-status-completed',
};

/** How an assignment was created (Database Schema Part 2: assignments). */
export const ASSIGNMENT_TYPES = [
  'planned',
  'overtime',
  'training',
  'support',
  'housekeeping',
] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

/** Special-case assignments captured by the morning wizard (special_assignments). */
export const SPECIAL_ASSIGNMENT_TYPES = [
  'overtime',
  'middle_mile',
  'icqa_support',
  'training',
  'support_outbound',
] as const;

export type SpecialAssignmentType = (typeof SPECIAL_ASSIGNMENT_TYPES)[number];

/** Live-operations actions recorded in activity_history (Database Schema Part 2). */
export const ACTIVITY_ACTIONS = [
  'assigned',
  'moved',
  'switched',
  'removed',
  'completed',
  'status_changed',
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  assigned: 'Assigned',
  moved: 'Moved',
  switched: 'Switched',
  removed: 'Removed',
  completed: 'Completed',
  status_changed: 'Status',
};

/** Lifecycle of a daily plan (Database Schema Part 2: daily_plans.status). */
export const PLAN_STATUSES = [
  'draft',
  'published',
  'closed',
  'archived',
] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];
