'use client';

import { useEffect, useState } from 'react';

/**
 * The student's name and phone drifting slowly across the video.
 *
 * This does not stop anyone recording their screen — nothing does, DRM
 * included. It changes the incentive instead: a recording that carries the
 * leaker's own phone number is not one they want circulating in a class group
 * chat. Attribution rather than prevention.
 *
 * It moves because a fixed overlay is trivially cropped out. Nine positions on
 * a slow cycle mean a crop that removes it also removes a corner of the video,
 * and the position at any given moment is unpredictable to someone editing.
 */
const POSITIONS = [
  { top: '8%', insetInlineStart: '6%' },
  { top: '8%', insetInlineStart: '50%' },
  { top: '8%', insetInlineEnd: '6%' },
  { top: '45%', insetInlineStart: '8%' },
  { top: '45%', insetInlineEnd: '8%' },
  { bottom: '18%', insetInlineStart: '6%' },
  { bottom: '18%', insetInlineStart: '45%' },
  { bottom: '18%', insetInlineEnd: '6%' },
  { top: '28%', insetInlineStart: '30%' },
];

export function Watermark({ text }: { text: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Start somewhere random so two students watching the same lesson at the
    // same time do not produce identical overlays.
    setIndex(Math.floor(Math.random() * POSITIONS.length));

    const id = setInterval(() => {
      setIndex((i) => (i + 1 + Math.floor(Math.random() * 3)) % POSITIONS.length);
    }, 9000);

    return () => clearInterval(id);
  }, []);

  if (!text) return null;

  return (
    <div
      aria-hidden
      // pointer-events-none so it never blocks the player's own controls.
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
    >
      <span
        dir="ltr"
        style={POSITIONS[index]}
        className="absolute whitespace-nowrap font-mono text-[11px] text-white/35 mix-blend-difference transition-all duration-[2500ms] ease-in-out sm:text-xs"
      >
        {text}
      </span>
    </div>
  );
}
