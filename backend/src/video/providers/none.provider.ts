import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { VideoProvider, PlaybackTicket, UploadTarget } from '../video-provider.interface';
import { buildWatermarkText } from '../watermark.util';

/**
 * The provider used while the hosting decision is still open.
 *
 * It is not a stub that pretends to work — it returns an honest "no playback
 * available" ticket so the whole surrounding system can be built and tested:
 * the enrollment gate still runs, the player page still renders, progress
 * still records, and the watermark text is still computed. Only the video
 * itself is missing.
 *
 * Uploads throw rather than silently succeeding, because an upload that
 * appears to work and stores nothing is worse than a clear error.
 */
@Injectable()
export class NoneProvider implements VideoProvider {
  readonly name = 'none';

  isConfigured(): boolean {
    return true;
  }

  async createUploadUrl(): Promise<UploadTarget> {
    throw new ServiceUnavailableException(
      'لم يتم اختيار مزوّد الفيديو بعد. اضبط VIDEO_PROVIDER في الإعدادات.',
    );
  }

  async getPlaybackTicket(
    _assetId: string,
    viewer: { userId: string; name: string; phone: string },
  ): Promise<PlaybackTicket> {
    return {
      url: null,
      kind: 'none',
      expiresAt: null,
      // Computed even here, so the overlay can be built and reviewed before a
      // provider exists.
      watermark: { text: buildWatermarkText(viewer) },
    };
  }

  async deleteAsset(): Promise<void> {
    // Nothing is stored, so there is nothing to remove.
  }
}
