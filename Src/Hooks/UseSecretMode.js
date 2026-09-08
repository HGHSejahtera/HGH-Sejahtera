import { create } from 'zustand';

export const useSecretMode = create((set) => ({
    isHGHMode: localStorage.getItem('hgh_mode') === 'true',
    toggleHGHMode: () => set((state) => {
        const newValue = !state.isHGHMode;
        localStorage.setItem('hgh_mode', newValue);
        return { isHGHMode: newValue };
    })
}));
