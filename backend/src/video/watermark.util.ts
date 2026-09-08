import { toLocalEgyptianPhone } from '@/common/utils/phone.util';

/**
 * The text burned over every video, per viewer.
 *
 * This is the single highest-leverage anti-sharing measure in the platform,
 * and it works with any provider — including one with no DRM at all.
 *
 * The reasoning is worth being explicit about, because it is easy to
 * over-promise here: signed URLs stop a *link* being shared, but nothing stops
 * a screen recording. No provider prevents that, DRM included. So the goal is
 * not prevention, it is attribution — a recording that carries the leaker's own
 * name and phone number is a recording they do not want circulating in a class
 * group chat. It changes the incentive rather than the capability.
 *
 * The phone is shown in local form (01…) because that is what a student
 * recognises as their own number, and recognising it is the entire deterrent.
 */
export function buildWatermarkText(viewer: { name: string; phone: string }): string {
  const local = toLocalEgyptianPhone(viewer.phone);

  // Truncated so a very long name cannot push the number off-screen on a
  // narrow phone — the number is the identifying half.
  const name = viewer.name.length > 24 ? `${viewer.name.slice(0, 24)}…` : viewer.name;

  return `${name} · ${local}`;
}
