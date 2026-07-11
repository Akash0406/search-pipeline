/**
 * Raw-source retention policy surface (Req 53.1).
 *
 * Exposes the configurable raw-artifact retention window: the global default
 * from central configuration plus any per-user override
 * (`user_preferences.raw_retention_days`), and the resulting effective window.
 * Read-only; the actual cleanup runs in the worker's retention job.
 */
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Config } from '@careerstack/config';
import type { Database } from '@careerstack/database';
import { userPreferences } from '@careerstack/database';
import type { RetentionPolicyResponse } from '@careerstack/contracts';
import { CONFIG, DB } from '../common/di-tokens.js';

@Injectable()
export class RetentionService {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(DB) private readonly db: Database,
  ) {}

  /** The effective retention policy for a user (Req 53.1). */
  async getPolicy(userId: string): Promise<RetentionPolicyResponse> {
    const globalDays = this.config.retention.rawRetentionDays;
    const [prefs] = await this.db
      .select({ rawRetentionDays: userPreferences.rawRetentionDays })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    const override = prefs?.rawRetentionDays ?? null;
    return {
      rawRetentionDays: globalDays,
      userOverrideDays: override,
      effectiveDays: override ?? globalDays,
    };
  }
}
