'use client';

import { useOfflineSync } from '@/lib/hooks/use-offline-sync';
import { Wifi, WifiOff, RefreshCw, Check, CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function ManualSyncButton() {
  const { isOnline, isSyncing, syncExpenses, pendingCount } = useOfflineSync();

  const handleSync = async () => {
    if (!isOnline) {
      alert('You are offline. Please check your internet connection.');
      return;
    }
    try {
      await syncExpenses();
    } catch (error) {
      console.error('Manual sync failed:', error);
      alert('Sync failed. Check console for details.');
    }
  };

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive rounded-full text-xs font-medium border border-destructive/20" title="You are offline">
        <WifiOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Offline</span>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant={pendingCount > 0 ? "default" : "ghost"}
      onClick={handleSync}
      disabled={isSyncing}
      className={cn(
        "relative transition-all duration-300 h-8 text-xs font-medium rounded-full",
        pendingCount > 0 ? "px-4 pr-3 hover:bg-primary/90" : "px-3 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground",
        isSyncing ? "opacity-90 cursor-wait" : ""
      )}
    >
      <AnimatePresence mode="wait">
        {isSyncing ? (
          <motion.div
            key="syncing"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Syncing...</span>
          </motion.div>
        ) : pendingCount > 0 ? (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Sync Pending ({pendingCount})</span>
          </motion.div>
        ) : (
          <motion.div
            key="synced"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <Check className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Synced</span>
          </motion.div>
        )}
      </AnimatePresence>
    </Button>
  );
}
