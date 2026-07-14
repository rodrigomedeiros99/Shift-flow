import { getCurrentProfile, PLANNER_ROLES } from '@/features/auth/queries';

/**
 * Download the Load Priority import template (CSV, opens in Excel). Planner-gated;
 * viewers get 403. Example rows are safe static text (no formula-leading cells).
 */
export async function GET() {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !(PLANNER_ROLES as readonly string[]).includes(profile.role)
  ) {
    return new Response('Unauthorized', { status: 403 });
  }

  const csv =
    [
      'Dock Door,Lane or Carrier,Close Time,Zone,Notes',
      'DD735,5084,5:00 PM,2,',
      'DD748,UPS,6:00 PM,3,',
      'DD755,,7:00 PM,3,Priority',
    ].join('\r\n') + '\r\n';

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="load-priority-template.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
