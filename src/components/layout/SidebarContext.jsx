import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
    const location = useLocation();

    // Set initial state based on screen size and current route
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (window.innerWidth < 1024) return true;
        if (location.pathname.startsWith('/inventory')) return true;
        return false;
    });
    
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    // Auto-collapse on smaller screens or specific routes
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsCollapsed(true);
                setIsMobileOpen(false);
            } else {
                // If screen is large, auto-expand UNLESS on the inventory page
                if (location.pathname.startsWith('/inventory')) {
                    setIsCollapsed(true);
                } else {
                    setIsCollapsed(false);
                }
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [location.pathname]);

    const toggleSidebar = () => {
        if (window.innerWidth < 768) {
            setIsMobileOpen(prev => !prev);
        } else {
            setIsCollapsed(prev => !prev);
        }
    };

    const closeMobile = () => setIsMobileOpen(false);

    return (
        <SidebarContext.Provider value={{ isCollapsed, isMobileOpen, toggleSidebar, closeMobile, setIsCollapsed }}>
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
