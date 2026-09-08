'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Player } from './Player';
import { formatDuration } from '@/lib/format';

export type LearnItem = {
  id: string;
  titleAr: string;
  type: 'video' | 'pdf' | 'text' | 'live';
  videoDurationSeconds: number;
  isFreePreview: boolean;
  unlocked: boolean;
  contentHtml: string | null;
  attachments: { name: string; key: string }[];
  progress: { lastPositionSeconds: number; furthestSeconds: number; completedAt: string | null } | null;
};

export function LearnClient({
  items,
  hasAccess,
  lectureSlug,
}: {
  items: LearnItem[];
  hasAccess: boolean;
  lectureSlug: string;
}) {
  // Open the first thing they can actually watch — for a paying student the
  // first lesson, for a visitor the free preview — rather than a locked item
  // that shows them nothing.
  const firstPlayable = items.find((i) => i.unlocked) ?? items[0];
  const [activeId, setActiveId] = useState(firstPlayable?.id);

  const active = items.find((i) => i.id === activeId) ?? firstPlayable;
  if (!active) return null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {active.type === 'video' ? (
          <Player
            key={active.id}
            itemId={active.id}
            resumeAt={active.progress?.lastPositionSeconds ?? 0}
            canPlay={active.unlocked}
          />
        ) : null}

        <div>
          <h2 className="text-lg font-semibold">{active.titleAr}</h2>
          {active.videoDurationSeconds > 0 && (
            <p className="text-xs text-muted">{formatDuration(active.videoDurationSeconds)}</p>
          )}
        </div>

        {active.unlocked && active.contentHtml && (
          <div
            className="prose-sm max-w-none leading-relaxed"
            dangerouslySetInnerHTML={{ __html: active.contentHtml }}
          />
        )}

        {active.unlocked && active.attachments.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold">المرفقات</h3>
            {active.attachments.map((a) => (
              <span key={a.key} className="text-sm text-muted">
                {a.name}
              </span>
            ))}
          </div>
        )}

        {!active.unlocked && (
          <div className="rounded-lg border border-brand/40 bg-brand/5 p-4 text-sm">
            <p className="mb-2">هذا الدرس متاح للمشتركين فقط.</p>
            <Link href={`/lectures/${lectureSlug}`} className="font-medium text-brand hover:underline">
              اشترك في المحاضرة
            </Link>
          </div>
        )}
      </div>

      <nav aria-label="دروس المحاضرة" className="flex w-full shrink-0 flex-col gap-2 lg:w-80">
        {items.map((item, index) => {
          const isActive = item.id === active.id;
          const done = !!item.progress?.completedAt;

          return (
            <button
              key={item.id}
              onClick={() => setActiveId(item.id)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-start transition ${
                isActive ? 'border-brand bg-brand/10' : 'border-border hover:border-brand/50'
              }`}
            >
              <span className="w-5 shrink-0 text-xs text-muted">{done ? '✓' : index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.titleAr}</span>
                <span className="block text-xs text-muted">
                  {item.videoDurationSeconds > 0 ? formatDuration(item.videoDurationSeconds) : item.type}
                </span>
              </span>
              {!item.unlocked && (
                <span className="shrink-0 text-xs text-muted" title="مقفل">
                  🔒
                </span>
              )}
              {item.isFreePreview && !hasAccess && (
                <span className="shrink-0 text-[10px] text-brand">مجاني</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
