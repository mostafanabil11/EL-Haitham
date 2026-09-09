import { Injectable, BadRequestException } from '@nestjs/common';
import { VideoProvider, PlaybackTicket, UploadTarget } from '../video-provider.interface';
import { buildWatermarkText } from '../watermark.util';
import { extractYouTubeId } from '../youtube-id.util';
import { ConfigService } from '@/config/config.service';

/**
 * Playback via YouTube, embedded in our own page.
 *
 * **What this provider does not do, stated plainly:** it does not gate access
 * to the video. A YouTube id is a public credential — anyone holding it can
 * watch on youtube.com regardless of what this platform thinks, and an
 * unlisted video is unlisted, not private. The enrollment gate still decides
 * who is *given* the id (the learn service withholds `videoAssetId` from
 * anyone without an entitlement, and this ticket is minted per request), so a
 * casual visitor cannot browse the catalogue and collect links. But once a
 * paying student has the id, forwarding it costs them nothing and we cannot
 * revoke it.
 *
 * That is a deliberate trade for zero hosting cost and zero bandwidth bills,
 * and the moving watermark carrying the student's name and phone is what is
 * left doing the deterrent work. If leaking ever becomes a real revenue
 * problem, this is the class to replace — see PLAN.md §4.1.
 */
@Injectable()
export class YouTubeProvider implements VideoProvider {
  readonly name = 'youtube';

  constructor(private configService: ConfigService) {}

  // Nothing to configure. YouTube needs no key for embedded playback, which
  // is most of why it is here.
  isConfigured(): boolean {
    return true;
  }

  async createUploadUrl(): Promise<UploadTarget> {
    throw new BadRequestException(
      'الفيديوهات تُرفع على يوتيوب مباشرة. الصق رابط الفيديو في حقل «رابط الفيديو» بدل الرفع من هنا.',
    );
  }

  async getPlaybackTicket(
    assetId: string,
    viewer: { userId: string; name: string; phone: string },
    ttlMinutes: number,
  ): Promise<PlaybackTicket> {
    const id = extractYouTubeId(assetId);
    if (!id) {
      // A lesson with no link yet, or one carrying an asset id from a previous
      // provider. Returning an honest "not available" ticket rather than
      // throwing: the caller already renders that state, and a 404 shown to a
      // student who paid is a worse outcome than a clear message. The teacher
      // sees the same lesson flagged "بدون رابط" in the admin list, which is
      // where a missing link is actually fixed.
      return {
        url: null,
        kind: 'none',
        expiresAt: null,
        watermark: { text: buildWatermarkText(viewer) },
      };
    }

    const params = new URLSearchParams({
      // The player is driven by the IFrame API so progress keeps working; the
      // API refuses to attach without this.
      enablejsapi: '1',
      // Suggested videos at the end are the single worst default here: a
      // student who finishes a lecture should not be handed a competitor's
      // channel. rel=0 confines them to this channel, which is the strongest
      // constraint YouTube still honours.
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      // Locks the embed to our origin, so the id lifted from the page cannot
      // be embedded on someone else's site. It does nothing about youtube.com
      // itself — see the class comment.
      origin: this.configService.frontendUrl,
    });

    // youtube-nocookie defers YouTube's tracking cookies until playback
    // actually starts. Students here are minors; this costs nothing.
    const url = `https://www.youtube-nocookie.com/embed/${id}?${params}`;

    return {
      url,
      kind: 'iframe',
      // The ticket still expires, and the player still re-requests. Honest
      // about what that buys with this provider: it limits how long a scraped
      // *page response* stays useful, not how long the video is reachable.
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      watermark: { text: buildWatermarkText(viewer) },
    };
  }

  async deleteAsset(): Promise<void> {
    // The video lives on the teacher's YouTube channel and is not ours to
    // delete. Removing the lecture item unlinks it here; taking it down on
    // YouTube is a decision made on YouTube.
  }
}
