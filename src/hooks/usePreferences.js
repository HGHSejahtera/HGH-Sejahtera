import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const usePreferences = create(
    persist(
        (set) => ({
            pinTimeout: 3 * 60 * 1000, // default 3 minutes
            setPinTimeout: (ms) => set({ pinTimeout: ms }),
        }),
        {
            name: 'hgh-preferences',
        }
    )
);
