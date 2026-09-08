import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings, SettingsDocument, PUBLIC_SETTINGS_FIELDS } from './schemas/settings.schema';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(@InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>) {}

  // Upsert against an empty filter — there is only ever one settings
  // document, created lazily on first read/write rather than via a seed.
  private async ensure(): Promise<SettingsDocument> {
    return this.settingsModel.findOneAndUpdate({}, { $setOnInsert: {} }, { upsert: true, new: true });
  }

  // Served unauthenticated to render the landing page. Projected to an
  // explicit allow-list at the database level, so a field added to the schema
  // later is private by default and becomes public only when someone adds it
  // to PUBLIC_SETTINGS_FIELDS on purpose.
  async getPublicSettings() {
    await this.ensure();

    const settings = await this.settingsModel
      .findOne({}, PUBLIC_SETTINGS_FIELDS.join(' '))
      .lean();

    return {
      success: true,
      message: 'Public settings retrieved successfully',
      data: settings,
    };
  }

  async getSettings() {
    const settings = await this.ensure();

    return {
      success: true,
      message: 'Settings retrieved successfully',
      data: settings,
    };
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const settings = await this.settingsModel.findOneAndUpdate(
      {},
      { $set: dto },
      { upsert: true, new: true },
    );

    return {
      success: true,
      message: 'Settings updated successfully',
      data: settings,
    };
  }
}
