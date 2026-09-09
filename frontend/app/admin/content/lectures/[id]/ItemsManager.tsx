'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import type { AdminLectureItem, LectureItemType } from '@/lib/admin-api';
import { Pill, EmptyState } from '../../../ui';

const TYPE_LABEL: Record<LectureItemType, string> = {
  video: 'فيديو',
  pdf: 'ملف',
  text: 'نص',
  live: 'بث مباشر',
};

export function ItemsManager({
  lectureId,
  items,
}: {
  lectureId: string;
  items: AdminLectureItem[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setPending(true);
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : fallback);
      return false;
    } finally {
      setPending(false);
    }
  }

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = String(form.get('type') ?? 'video') as LectureItemType;
    const minutes = Number(form.get('minutes') ?? 0);

    const ok = await run(
      () =>
        apiFetch(`/admin/content/lectures/${lectureId}/items`, {
          method: 'POST',
          body: JSON.stringify({
            titleAr: String(form.get('titleAr') ?? '').trim(),
            type,
            isFreePreview: form.get('isFreePreview') === 'on',
            ...(type === 'video'
              ? {
                  videoAssetId: String(form.get('videoAssetId') ?? '').trim() || null,
                  videoDurationSeconds: Math.round(minutes * 60),
                }
              : {}),
            ...(type === 'text' ? { contentHtml: String(form.get('contentHtml') ?? '') } : {}),
          }),
        }),
      'تعذّر إضافة الدرس.',
    );
    if (ok) setAdding(false);
  }

  // Whole-array reorder, matching the API: the server takes the complete
  // ordered list, so a stale client can never interleave two half-moves.
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const ids = items.map((item) => item._id);
    [ids[index], ids[target]] = [ids[target], ids[index]];

    await run(
      () =>
        apiFetch('/admin/content/items/reorder', {
          method: 'POST',
          body: JSON.stringify({ ids }),
        }),
      'تعذّر إعادة الترتيب.',
    );
  }

  async function remove(item: AdminLectureItem) {
    if (!window.confirm(`حذف "${item.titleAr}"؟ لا يمكن التراجع.`)) return;
    await run(
      () => apiFetch(`/admin/content/items/${item._id}`, { method: 'DELETE' }),
      'تعذّر حذف الدرس.',
    );
  }

  async function saveItem(item: AdminLectureItem, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const minutes = Number(form.get('minutes') ?? 0);

    const ok = await run(
      () =>
        apiFetch(`/admin/content/items/${item._id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            titleAr: String(form.get('titleAr') ?? '').trim(),
            isFreePreview: form.get('isFreePreview') === 'on',
            ...(item.type === 'video'
              ? {
                  videoAssetId: String(form.get('videoAssetId') ?? '').trim() || null,
                  videoDurationSeconds: Math.round(minutes * 60),
                }
              : {}),
            ...(item.type === 'text' ? { contentHtml: String(form.get('contentHtml') ?? '') } : {}),
          }),
        }),
      'تعذّر حفظ الدرس.',
    );
    if (ok) setEditingId(null);
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">الدروس ({items.length})</h2>
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:border-brand/40"
        >
          إضافة درس
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {adding && (
        <form onSubmit={addItem} className="mb-4 rounded-2xl border border-border bg-card p-4">
          <ItemFields />
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
            >
              {pending ? '...' : 'إضافة'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm transition hover:border-brand/40"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <EmptyState>لا توجد دروس. المحاضرة الفارغة لا يمكن نشرها.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={item._id} className="rounded-xl border border-border bg-card px-4 py-3">
              {editingId === item._id ? (
                <form onSubmit={(event) => saveItem(item, event)}>
                  <ItemFields item={item} />
                  <div className="mt-3 flex gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
                    >
                      {pending ? '...' : 'حفظ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-border px-4 py-2 text-sm transition hover:border-brand/40"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted">{index + 1}.</span>
                      <p className="truncate text-sm">{item.titleAr}</p>
                      <Pill>{TYPE_LABEL[item.type]}</Pill>
                      {item.isFreePreview && <Pill tone="positive">معاينة مجانية</Pill>}
                      {item.type === 'video' && !item.videoAssetId && (
                        <Pill tone="warning">بدون رابط</Pill>
                      )}
                    </div>
                    {item.type === 'video' && item.videoDurationSeconds > 0 && (
                      <p className="mt-0.5 text-xs text-muted">
                        {formatDuration(item.videoDurationSeconds)}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={pending || index === 0}
                      aria-label="تحريك لأعلى"
                      className="rounded-lg border border-border px-2 py-1.5 text-xs transition hover:border-brand/40 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={pending || index === items.length - 1}
                      aria-label="تحريك لأسفل"
                      className="rounded-lg border border-border px-2 py-1.5 text-xs transition hover:border-brand/40 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(item._id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs transition hover:border-brand/40"
                    >
                      تحرير
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      disabled={pending}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:border-red-500/60 hover:text-danger disabled:opacity-60"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Shared between add and edit so the two can never drift apart.
 *
 * On edit the type is fixed: changing a video into a text lesson would leave
 * the asset id orphaned and the enrollment gate reasoning about a lesson that
 * no longer has the shape it was created with. Delete and re-add instead.
 */
function ItemFields({ item }: { item?: AdminLectureItem }) {
  const [type, setType] = useState<LectureItemType>(item?.type ?? 'video');

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">عنوان الدرس</span>
        <input
          name="titleAr"
          required
          minLength={2}
          maxLength={200}
          defaultValue={item?.titleAr ?? ''}
          placeholder="شرح الدرس"
          className="form-control text-sm"
        />
      </label>

      {!item && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">النوع</span>
          <select
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as LectureItemType)}
            className="form-control text-sm"
          >
            {(Object.keys(TYPE_LABEL) as LectureItemType[]).map((value) => (
              <option key={value} value={value}>
                {TYPE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
      )}

      {type === 'video' && (
        <>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              رابط الفيديو <span className="font-normal text-muted">(الصق رابط يوتيوب)</span>
            </span>
            <input
              name="videoAssetId"
              dir="ltr"
              maxLength={200}
              placeholder="https://youtu.be/..."
              defaultValue={item?.videoAssetId ?? ''}
              className="form-control text-start text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">المدة (دقيقة)</span>
            <input
              name="minutes"
              type="number"
              min={0}
              step={1}
              dir="ltr"
              defaultValue={item ? Math.round(item.videoDurationSeconds / 60) : 0}
              className="form-control text-start text-sm"
            />
          </label>
        </>
      )}

      {type === 'text' && (
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">المحتوى</span>
          <textarea
            name="contentHtml"
            rows={5}
            required
            defaultValue={item?.contentHtml ?? ''}
            className="form-control min-h-28 text-sm"
          />
        </label>
      )}

      {type === 'pdf' && (
        <p className="text-xs text-muted sm:col-span-2">
          رفع الملفات يحتاج إعداد التخزين (R2) — غير مفعّل بعد.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          name="isFreePreview"
          type="checkbox"
          defaultChecked={item?.isFreePreview ?? false}
          className="size-4 accent-[var(--brand)]"
        />
        <span>
          معاينة مجانية{' '}
          <span className="text-muted">— يشاهدها أي زائر بدون شراء، مع العلامة المائية</span>
        </span>
      </label>
    </div>
  );
}
