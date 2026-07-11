'use client';

import * as React from 'react';
import { ExportSection } from './export-section';
import { ConnectionsSection } from './connections-section';
import { RetentionSection } from './retention-section';
import { DeleteDataSection } from './delete-data-section';
import { DeleteAccountSection } from './delete-account-section';

/**
 * Privacy & data-control surface (Req 49–53). Composes the export, connected
 * sources (disconnect), retention policy, and deletion flows. Destructive
 * actions are grouped last and gated behind explicit confirmation; account
 * deletion is clearly separated into its own danger card (Req 14, 50).
 */
export function PrivacyClient() {
  return (
    <div className="space-y-6">
      <ExportSection />
      <ConnectionsSection />
      <RetentionSection />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Danger zone</h2>
        <div className="space-y-6">
          <DeleteDataSection />
          <DeleteAccountSection />
        </div>
      </div>
    </div>
  );
}
