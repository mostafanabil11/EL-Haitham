export interface PlaybackTicket {
  /** Where the player should load the stream from. Null when playback is not available. */
  url: string | null;
  /** Streaming format, so the client knows whether it needs an HLS shim. */
  kind: 'hls' | 'mp4' | 'iframe' | 'none';
  expiresAt: Date | null;
  /**
   * Rendered over the player by the client, per viewer. Not a substitute for
   * signed URLs — it is the part that changes behaviour rather than blocks it,
   * because a screen recording carrying the leaker's own phone number is a
   * recording they do not want to share.
   */
  watermark: { text: string } | null;
}

export interface UploadTarget {
  uploadUrl: string;
  assetId: string;
  /** Headers the client must send with the upload, if the provider requires any. */
  headers?: Record<string, string>;
}

/**
 * The seam that lets the video host stay undecided while everything around it
 * gets built.
 *
 * Every route in the app talks to this interface and never to a vendor SDK, so
 * choosing Bunny, Cloudflare Stream, Vimeo or YouTube later means writing one
 * class and changing VIDEO_PROVIDER in the environment — not touching the
 * enrollment gate, the player, or progress tracking.
 *
 * Note what is deliberately absent: there is no `getPlaybackUrl(assetId)`.
 * Minting a URL always requires knowing *who* is watching, so a caller cannot
 * accidentally produce a shareable link that outlives the session.
 */
export interface VideoProvider {
  readonly name: string;

  /** Whether the provider has enough configuration to actually work. */
  isConfigured(): boolean;

  createUploadUrl(lectureItemId: string): Promise<UploadTarget>;

  /**
   * Mints a short-lived, viewer-specific playback ticket. Callers MUST have
   * already checked that this user is entitled to this content.
   */
  getPlaybackTicket(
    assetId: string,
    viewer: { userId: string; name: string; phone: string },
    ttlMinutes: number,
  ): Promise<PlaybackTicket>;

  deleteAsset(assetId: string): Promise<void>;
}
