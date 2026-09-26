const STORAGE_KEY = 'modern_guest_daily_creations';
export const DEFAULT_GUEST_DAILY_LIMIT = 5;

interface DailyCreationRecord {
  date: string; // YYYY-MM-DD
  count: number;
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const roomLimitService = {
  getGuestDailyUsage(isAuthenticated: boolean, configuredLimit: number = DEFAULT_GUEST_DAILY_LIMIT) {
    if (isAuthenticated) {
      return {
        count: 0,
        max: Infinity,
        remaining: Infinity,
        isLimited: false,
        canCreate: true,
      };
    }

    if (typeof window === 'undefined') {
      return {
        count: 0,
        max: configuredLimit,
        remaining: configuredLimit,
        isLimited: true,
        canCreate: true,
      };
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const today = getTodayString();
      if (!raw) {
        return {
          count: 0,
          max: configuredLimit,
          remaining: configuredLimit,
          isLimited: true,
          canCreate: true,
        };
      }

      const record: DailyCreationRecord = JSON.parse(raw);
      if (record.date !== today) {
        // New day, reset count
        return {
          count: 0,
          max: configuredLimit,
          remaining: configuredLimit,
          isLimited: true,
          canCreate: true,
        };
      }

      const count = record.count || 0;
      const remaining = Math.max(0, configuredLimit - count);
      return {
        count,
        max: configuredLimit,
        remaining,
        isLimited: true,
        canCreate: count < configuredLimit,
      };
    } catch {
      return {
        count: 0,
        max: configuredLimit,
        remaining: configuredLimit,
        isLimited: true,
        canCreate: true,
      };
    }
  },

  recordCreation(isAuthenticated: boolean) {
    if (isAuthenticated || typeof window === 'undefined') return;

    try {
      const today = getTodayString();
      const raw = localStorage.getItem(STORAGE_KEY);
      let count = 0;

      if (raw) {
        const record: DailyCreationRecord = JSON.parse(raw);
        if (record.date === today) {
          count = record.count || 0;
        }
      }

      const newRecord: DailyCreationRecord = {
        date: today,
        count: count + 1,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecord));
    } catch (err) {
      console.warn('Failed to record guest room creation limit:', err);
    }
  },

  resetUsage() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
};
