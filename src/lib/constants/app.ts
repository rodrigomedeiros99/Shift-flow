/**
 * Application identity / branding constants.
 *
 * These are presentation labels, not operational data. The concrete facility a
 * user belongs to is resolved from their profile (Database Schema: facilities,
 * profiles.facility_id) once Auth lands in Phase 2; this default reflects the
 * initial deployment target described throughout the PRD.
 */
export const APP_NAME = 'ShiftFlow';
export const APP_DESCRIPTION =
  'Real-time warehouse labor planning and coordination for distribution center operations.';

export const DEFAULT_FACILITY_CODE = 'DFC 5523';
export const DEFAULT_FACILITY_NAME = 'Home Depot DFC 5523';
