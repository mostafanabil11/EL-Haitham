// Prices are stored as integer minor units (piastres) everywhere, so 6500 is
// 65.00 EGP. Formatting happens once, here, rather than at each call site
// where someone will eventually forget to divide by 100.
export function formatPrice(minorUnits: number): string {
  const major = minorUnits / 100;
  // Whole pounds are the overwhelming case (40, 65, 75, 100) and "65 ج.م"
  // reads better than "65.00 ج.م" on a card.
  const amount = Number.isInteger(major) ? String(major) : major.toFixed(2);
  return `${amount} ج.م`;
}

// Deliberately Western digits, matching lang="ar-EG-u-nu-latn" on <html>.
export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return '—';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);

  if (hours === 0) return `${minutes} دقيقة`;
  if (minutes === 0) return hours === 1 ? 'ساعة' : `${hours} ساعات`;
  return `${hours}:${String(minutes).padStart(2, '0')} ساعة`;
}

// Builds the wa.me deep link the whole purchase flow depends on. The prefilled
// message carries the lecture title and price so the teacher can see what is
// being asked for without a back-and-forth — in Phase 3 this gains a purchase
// request number too.
export function buildWhatsAppLink(
  whatsappNumber: string | null,
  lectureTitle: string,
  price: string,
): string | null {
  if (!whatsappNumber) return null;

  const message = `السلام عليكم، أريد الاشتراك في محاضرة:\n${lectureTitle}\nالسعر: ${price}`;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}
