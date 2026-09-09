import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@/config/config.module';
import { ConfigService } from '@/config/config.service';
import { NoneProvider } from './providers/none.provider';
import { YouTubeProvider } from './providers/youtube.provider';
import type { VideoProvider } from './video-provider.interface';

export const VIDEO_PROVIDER = Symbol('VIDEO_PROVIDER');

/**
 * Selects the video provider from configuration at boot.
 *
 * Adding Bunny, Cloudflare Stream or Vimeo later means writing one class that
 * implements VideoProvider and adding a case here. Nothing else in the
 * application changes — the enrollment gate, the player and progress tracking
 * all talk to the interface.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    NoneProvider,
    YouTubeProvider,
    {
      provide: VIDEO_PROVIDER,
      inject: [ConfigService, NoneProvider, YouTubeProvider],
      useFactory: (
        configService: ConfigService,
        none: NoneProvider,
        youtube: YouTubeProvider,
      ): VideoProvider => {
        const logger = new Logger('VideoProvider');
        const choice = configService.videoProvider;

        switch (choice) {
          case 'none':
            logger.warn('VIDEO_PROVIDER=none — lectures will list but not play.');
            return none;

          case 'youtube':
            logger.log('VIDEO_PROVIDER=youtube — playback is an embedded YouTube iframe.');
            return youtube;

          // case 'bunny': return new BunnyStreamProvider(configService);
          // case 'vimeo': return new VimeoProvider(configService);

          default:
            // Falling back rather than throwing: an unrecognised value should
            // degrade to "video does not play", not stop the whole platform
            // from booting and take the catalogue down with it.
            logger.error(`Unknown VIDEO_PROVIDER "${choice}" — falling back to none.`);
            return none;
        }
      },
    },
  ],
  exports: [VIDEO_PROVIDER],
})
export class VideoModule {}
