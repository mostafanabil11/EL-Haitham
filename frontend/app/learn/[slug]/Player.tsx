'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Watermark } from '@/components/Watermark';
import { YouTubeFrame } from './YouTubeFrame';

type Ticket = {
  url: string | null;
  kind: 'hls' | 'mp4' | 'iframe' | 'none';
  watermark: { text: string } | null;
  durationSeconds: number;
  provider: string;
};

type Props = {
  itemId: string;
  resumeAt: number;
  canPlay: boolean;
};

// How often playback position is reported. Every few seconds would be a write
// per student per interval for no benefit — resuming within 15 seconds of
// where you stopped is indistinguishable from exact.
const REPORT_INTERVAL_MS = 15000;

export function Player({ itemId, resumeAt, canPlay }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Written by the iframe player on every tick; read by the same interval that
  // reports a <video> element's currentTime, so both providers share one
  // reporting path rather than growing a second one.
  const framePositionRef = useRef<number | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasResumed = useRef(false);

  // The ticket is requested on play, not on render, so its short life starts
  // when watching starts rather than when the page is opened and left.
  const start = useCallback(async () => {
    if (ticket || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<{ message: string; data: Ticket }>(
        `/learn/items/${itemId}/playback`,
        { method: 'POST' },
      );
      setTicket(res.data);
      if (!res.data.url) setError(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تشغيل الفيديو.');
    } finally {
      setLoading(false);
    }
  }, [itemId, ticket, loading]);

  // Report progress on an interval and once more on unmount, so closing the
  // tab mid-lesson does not lose the last stretch.
  useEffect(() => {
    if (!ticket?.url) return;

    const report = () => {
      const el = videoRef.current;
      const position = el
        ? el.paused
          ? null
          : Math.floor(el.currentTime)
        : framePositionRef.current;
      if (position === null) return;

      apiFetch('/learn/progress', {
        method: 'POST',
        body: JSON.stringify({ itemId, positionSeconds: position }),
        // A failed progress write must never surface to the student — it is
        // bookkeeping, not the lesson.
      }).catch(() => {});
    };

    const id = setInterval(report, REPORT_INTERVAL_MS);
    return () => {
      clearInterval(id);
      report();
    };
  }, [ticket, itemId]);

  if (!canPlay) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-border/20 text-center">
        <p className="px-6 text-sm text-muted">اشترك في المحاضرة لمشاهدة هذا الدرس.</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
      {ticket?.url ? (
        <>
          {ticket.kind === 'iframe' ? (
            <YouTubeFrame
              embedUrl={ticket.url}
              resumeAt={resumeAt}
              onTick={(seconds) => {
                framePositionRef.current = seconds;
              }}
            />
          ) : (
            <video
              ref={videoRef}
              src={ticket.kind === 'mp4' ? ticket.url : undefined}
              controls
              controlsList="nodownload"
              onContextMenu={(e) => e.preventDefault()}
              playsInline
              className="h-full w-full"
              onLoadedMetadata={(e) => {
                // Resume once, and only if there is meaningful distance left —
                // dropping someone back at the last 10 seconds is worse than
                // starting over.
                if (hasResumed.current) return;
                hasResumed.current = true;
                const el = e.currentTarget;
                if (resumeAt > 5 && resumeAt < el.duration - 10) el.currentTime = resumeAt;
              }}
            />
          )}
          {ticket.watermark && <Watermark text={ticket.watermark.text} />}
        </>
      ) : (
        <button
          onClick={start}
          disabled={loading}
          className="flex h-full w-full flex-col items-center justify-center gap-3 text-center transition hover:bg-white/5"
        >
          {loading ? (
            <span className="text-sm text-white/60">جارٍ التحميل...</span>
          ) : error ? (
            <span className="max-w-sm px-6 text-sm text-white/70">{error}</span>
          ) : (
            <>
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-2xl text-white">
                ▶
              </span>
              <span className="text-sm text-white/70">
                {resumeAt > 5 ? 'متابعة المشاهدة' : 'تشغيل'}
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
