import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, ChevronLeft, X, UserRound, Package, Users, ScanLine, List } from 'lucide-react';
import { cn } from '@/Lib/Utils';
import { useAuthStore } from '@/Hooks/UseAuth';
import { useSidebar } from './SidebarContext';
import { useTranslation } from '@/Hooks/UseTranslation';


const SidebarContent = ({ isCollapsed, toggleSidebar, closeMobile, allowedLinks, user, role }) => (
    <aside className={cn(
        "flex flex-col h-full w-full transition-all duration-300 ease-in-out",
        "bg-gradient-to-b from-[oklch(0.18_0.05_270)] via-[oklch(0.15_0.04_270)] to-[oklch(0.12_0.06_275)]",
        isCollapsed ? "w-16" : "w-64"
    )}>
        {/* Logo */}
        <div className="h-16 flex items-center border-b border-white/[0.06] shrink-0 px-2 relative">
            <button 
                onClick={toggleSidebar} 
                className={cn("absolute left-2 right-2 p-2 rounded-md hover:bg-white/10 transition-all duration-300 flex justify-center items-center group hidden md:flex",
                    !isCollapsed ? "opacity-0 invisible pointer-events-none" : "opacity-100 visible"
                )}
                title="Expand Sidebar"
            >
                <span className="text-lg font-black bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent group-hover:hidden">H</span>
                <ChevronLeft className="h-5 w-5 text-zinc-400 rotate-180 hidden group-hover:block" />
            </button>
            <div className={cn("flex items-center justify-between overflow-hidden transition-all duration-300", 
                isCollapsed ? "w-0 opacity-0 invisible pl-0" : "w-full opacity-100 visible pl-3 pr-1"
            )}>
                <span className="text-xl font-black bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent tracking-wider whitespace-nowrap">HGH</span>
                <button 
                    onClick={toggleSidebar} 
                    className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-colors hidden md:block shrink-0"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
            </div>
        </div>
        
        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
            <nav className={cn("space-y-0.5", isCollapsed ? "px-2" : "px-3")}>
                {allowedLinks.map((link, index) => (
                    link.type === 'divider' ? (
                        <div key={`divider-${index}`} className="my-2 border-t border-white/[0.06] mx-2" />
                    ) : link.comingSoon ? (
                        <div
                            key={link.path}
                            title={isCollapsed ? `${link.name} (Coming Soon)` : undefined}
                            className={cn(
                                "flex items-center rounded-lg text-sm font-medium cursor-not-allowed opacity-40",
                                isCollapsed ? "justify-center p-2.5" : "px-3 py-2.5",
                                "text-zinc-500"
                            )}
                        >
                            <link.icon className={cn("h-[18px] w-[18px] shrink-0", !isCollapsed && "mr-3")} />
                            <span className={cn("overflow-hidden whitespace-nowrap transition-all duration-300", isCollapsed ? "w-0 opacity-0" : "w-full opacity-100")}>
                                {link.name}
                            </span>
                        </div>
                    ) : (
                    <NavLink
                        key={link.path}
                        to={link.path}
                        onClick={closeMobile}
                        title={isCollapsed ? link.name : undefined}
                        className={({ isActive }) => cn(
                            "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                            isCollapsed ? "justify-center p-2.5" : "px-3 py-2.5",
                            isActive 
                                ? "bg-gradient-to-r from-indigo-500/20 to-violet-500/15 text-white shadow-[inset_0_0_0_1px_rgba(129,140,248,0.2)]" 
                                : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                        )}
                    >
                        <link.icon className={cn("h-[18px] w-[18px] shrink-0 transition-all duration-300", !isCollapsed && "mr-3")} />
                        <span className={cn("overflow-hidden whitespace-nowrap transition-all duration-300", isCollapsed ? "w-0 opacity-0" : "w-full opacity-100")}>
                            {link.name}
                        </span>
                    </NavLink>
                    )
                ))}
            </nav>
        </div>

        {/* User Info & Logout */}
        <div className={cn(
            "border-t border-white/[0.06] shrink-0 flex items-center justify-between transition-all duration-300",
            isCollapsed ? "p-2 flex-col justify-center gap-2" : "p-3"
        )}>
            <div className={cn("flex items-center flex-1 overflow-hidden transition-all duration-300", isCollapsed ? "" : "px-1")}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg shadow-indigo-500/20">
                    {user?.name?.charAt(0)?.toUpperCase() || role.charAt(0)}
                </div>
                <div className={cn("overflow-hidden transition-all duration-300", isCollapsed ? "w-0 opacity-0 ml-0" : "w-full opacity-100 ml-3 pr-2")}>
                    <div className="w-[140px]">
                        <p className="text-sm font-medium text-white leading-tight break-words">{user?.name || 'User'}</p>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{role}</p>
                    </div>
                </div>
            </div>
            
            <button
                onClick={() => useAuthStore.getState().logout()}
                className={cn(
                    "p-2 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0",
                    isCollapsed && "w-full flex justify-center"
                )}
                title="Log Out"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
        </div>
    </aside>
);

export function Sidebar() {
    const { user } = useAuthStore();
    const { isCollapsed, isMobileOpen, toggleSidebar, closeMobile } = useSidebar();
    const { t } = useTranslation();
    const role = user?.role || 'Staff';
    
    const links = [
        { name: t('sidebar.dashboard'), icon: LayoutDashboard, path: '/Dashboard', roles: ['Founder', 'Manager', 'Developer', 'Staff'] },
        { name: 'POS', icon: ScanLine, path: '/POS', roles: ['Founder', 'Manager', 'Developer', 'Staff'] },
        { name: 'Orders', icon: List, path: '/Orders', roles: ['Founder', 'Manager', 'Developer'] },
        { name: t('sidebar.inventory'), icon: Package, path: '/Inventory', roles: ['Founder', 'Manager', 'Developer'] },
        { name: t('sidebar.agents'), icon: Users, path: '/Agent-Management', roles: ['Founder', 'Manager', 'Developer'] },
        { name: 'Agent', icon: UserRound, path: '/Agent', roles: ['Agent'] },
        { name: t('sidebar.settings'), icon: Settings, path: '/Settings', roles: ['Founder', 'Manager', 'Developer', 'Staff', 'Agent'] },
    ];

    const allowedLinks = links.filter(link => link.type === 'divider' || link.roles.includes(role) || (role === 'Developer' && link.path !== '/Agent'));

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden md:block shrink-0 h-full">
                <SidebarContent 
                    isCollapsed={isCollapsed} 
                    toggleSidebar={toggleSidebar} 
                    closeMobile={closeMobile} 
                    allowedLinks={allowedLinks} 
                    user={user} 
                    role={role} 
                />
            </div>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMobile} />
                    <div className="relative z-10 h-full w-64">
                        <button 
                            onClick={closeMobile} 
                            className="absolute top-4 right-4 z-20 p-1 rounded-md text-zinc-400 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <SidebarContent 
                            isCollapsed={false} 
                            toggleSidebar={toggleSidebar} 
                            closeMobile={closeMobile} 
                            allowedLinks={allowedLinks} 
                            user={user} 
                            role={role} 
                        />
                    </div>
                </div>
            )}
        </>
    );
}
