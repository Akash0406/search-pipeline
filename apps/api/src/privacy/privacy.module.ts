/**
 * PrivacyModule — data-control operations. This slice implements account
 * deletion (Req 7, 50.1); export/disconnect/delete-data land in a later task.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountDeletionService } from './account-deletion.service.js';
import { PrivacyController } from './privacy.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [PrivacyController],
  providers: [AccountDeletionService],
})
export class PrivacyModule {}
