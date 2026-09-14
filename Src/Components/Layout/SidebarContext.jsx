import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
    const location = useLocation();

    const [ExpandedPage, SetExpandedPage] = useState(null);
    const [Page, SetPage] = useState(location.key);
    if (Page !== location.key) {
        SetPage(location.key);
        SetExpandedPage(null);
    }
    const isCollapsed = ExpandedPage !== location.key;
    
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    // Expansion is temporary for the current page. Resizing never auto-expands.
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                SetExpandedPage(null);
                setIsMobileOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleSidebar = () => {
        if (window.innerWidth < 768) {
            setIsMobileOpen(prev => !prev);
        } else {
            SetExpandedPage(Previous => Previous === location.key ? null : location.key);
        }
    };

    const closeMobile = () => setIsMobileOpen(false);

    return (
        <SidebarContext.Provider value={{ isCollapsed, isMobileOpen, toggleSidebar, closeMobile }}>
            {children}
        </SidebarContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) throw new Error('useSidebar must be used within SidebarProvider');
    return context;
}
