'use client';

import { db } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/client';

export function useTransferMutations() {
  const supabase = createClient();

  const deleteTransfer = async (id: string) => {
    // Soft delete: update deleted_at and sync_status
    try {
      await db.transfers.update(id, {
        deleted_at: new Date().toISOString(),
        sync_status: 'pending',
        updated_at: new Date().toISOString(),
      });
      
      // Note: The useOfflineSync hook will handle pushing this change to the server
    } catch (error) {
      console.error('Failed to delete transfer:', error);
      throw error;
    }
  };

  return {
    deleteTransfer,
  };
}
