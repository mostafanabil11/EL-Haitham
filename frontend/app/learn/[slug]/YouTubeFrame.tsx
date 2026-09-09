'use client';

import { useEffect, useRef } from 'react';

/**
 * A YouTube embed we can still read the clock from.
 *
 * A plain <iframe> would have been three lines, and would have silently
 * broken the two things Phase 4 built and tested: resume-where-you-stopped,
 * and progress — which now feeds the parent reports. The iframe is
 * cross-origin, so `currentTime` is unreachable from the page; the IFrame API
 * is the only way to get it back.
 *
 * The failure mode mattered more than the cost: nothing would have errored.
 * Every lecture would have played, every student would have sat at 0%, and
 * the first sign would have been a parent report claiming their child had
 * watched nothing.
 */

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayer;
  PlayerState: { PLAYING: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = 'https://www.youtube.com/iframe_api';

/**
 * Loads the API script once per page and resolves when it is ready.
 *
 * YouTube's loader calls a single global callback, so two players mounting
 * together would have the second overwrite the first's callback and hang. One
 * shared promise avoids that.
 */
let apiReady: Promise<void> | null = null;

function loadApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();

  apiReady ??= new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = API_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return apiReady;
}

export function YouTubeFrame({
  embedUrl,
  resumeAt,
  onTick,
}: {
  embedUrl: string;
  resumeAt: number;
  /** Called with the current position while playing. */
  onTick: (positionSeconds: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  // Held in a ref so the polling interval always calls the latest callback
  // without the player being torn down and rebuilt every time the parent
  // re-renders. Assigned in an effect, not during render — a render can be
  // discarded, and writing a ref from one is what React warns about.
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    void loadApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT) return;

      const player = new window.YT.Player(hostRef.current, {
        events: {
          onReady: () => {
            // Resume once, and only with meaningful distance left — dropping
            // someone at the last ten seconds is worse than starting over.
            const duration = player.getDuration();
            if (resumeAt > 5 && duration > 0 && resumeAt < duration - 10) {
              player.seekTo(resumeAt, true);
            }
          },
        },
      });
      playerRef.current = player;

      // Polled rather than event-driven: the API reports state changes, not
      // position, so the clock has to be read. One read per second is
      // nothing; the caller decides how often to actually write.
      interval = setInterval(() => {
        if (!window.YT || player.getPlayerState?.() !== window.YT.PlayerState.PLAYING) return;
        onTickRef.current(Math.floor(player.getCurrentTime()));
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      try {
        playerRef.current?.destroy();
      } catch {
        // Already torn down with the iframe. Nothing to clean up.
      }
      playerRef.current = null;
    };
    // embedUrl identifies the video; a change means a different lesson.
  }, [embedUrl, resumeAt]);

  return (
    <iframe
      ref={hostRef as unknown as React.RefObject<HTMLIFrameElement>}
      src={embedUrl}
      title="مشغّل الفيديو"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      className="h-full w-full border-0"
    />
  );
}
