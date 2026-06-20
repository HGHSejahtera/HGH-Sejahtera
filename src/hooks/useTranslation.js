import { create } from 'zustand';
import { en } from '@/locales/en';
import { my } from '@/locales/my';

const dictionaries = {
    en,
    my
};

// Helper to get nested object property via string path like "sidebar.dashboard"
const getNestedProperty = (obj, path) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const useTranslation = create((set, get) => ({
    language: localStorage.getItem('app_language') || 'en',
    
    setLanguage: (lang) => {
        localStorage.setItem('app_language', lang);
        set({ language: lang });
    },
    
    t: (key) => {
        const { language } = get();
        const dict = dictionaries[language] || dictionaries.en;
        
        const text = getNestedProperty(dict, key);
        // Fallback to English if missing in Malay, then fallback to key itself
        if (!text && language !== 'en') {
            const fallbackText = getNestedProperty(dictionaries.en, key);
            return fallbackText || key;
        }
        
        return text || key;
    }
}));
