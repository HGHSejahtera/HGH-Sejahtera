import { NavLink } from 'react-router-dom';
import { useRef } from 'react';
import { Tooltip } from 'radix-ui';
import { LayoutDashboard, Settings, ChevronLeft, UserRound, Package, Users, ScanLine, List, LogOut } from 'lucide-react';
import { cn } from '@/Lib/Utils';
import { useAuthStore } from '@/Hooks/UseAuth';
import { useSidebar } from './SidebarContext';
import { useTranslation } from '@/Hooks/UseTranslation';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/Components/UI/Sheet';

function SidebarHint({ Label, children }) {
    if (!Label) return children;
    return <Tooltip.Root><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content side="right" sideOffset={10} collisionPadding={8} className="z-[100] rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg select-none">{Label}<Tooltip.Arrow className="fill-gray-900"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root>;
}

function SidebarContent({ Collapsed, Toggle, CloseMobile, Links, User, Role, ReloadDocument, Mobile = false }) {
    return <aside aria-label="Sidebar" className={cn('flex flex-col h-full bg-white border-r border-gray-200', Collapsed ? 'w-[72px]' : 'w-64')}>
        <div className={cn('h-16 shrink-0 px-3 flex items-center gap-2 border-b border-gray-100', Collapsed ? 'justify-center' : 'justify-between')}>
            {!Collapsed && <div className="min-w-0 flex items-center gap-2.5"><span className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">H</span><span className="font-sans text-lg md:text-xl font-bold text-gray-900 tracking-tight">HGH Centre</span></div>}
            {!Mobile && <SidebarHint Label={Collapsed ? 'Expand' : 'Collapse'}><button type="button" onClick={Toggle} aria-label={Collapsed ? 'Expand' : 'Collapse'} aria-expanded={!Collapsed} className={cn('size-10 shrink-0 inline-flex items-center justify-center rounded-xl cursor-pointer focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2', Collapsed ? 'bg-primary text-primary-foreground font-bold hover:bg-primary/90' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900')}>{Collapsed ? <span aria-hidden="true">H</span> : <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={1.5}/>}</button></SidebarHint>}
        </div>
        <nav aria-label="Main menu" className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
            {Links.map(Link => <SidebarHint key={Link.Path} Label={Collapsed ? Link.Name : undefined}><NavLink to={Link.Path} reloadDocument={ReloadDocument} onClick={CloseMobile} aria-label={Link.Name}
                className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2', Collapsed && 'justify-center px-0')}>
                <Link.Icon aria-hidden="true" className="size-5 shrink-0"/><span className={Collapsed ? 'sr-only' : 'min-w-0 break-words'}>{Link.Name}</span>
            </NavLink></SidebarHint>)}
        </nav>
        <div className={cn('border-t border-gray-100 p-3 flex gap-2',Collapsed ? 'flex-col items-center' : 'items-center')}>
            {!Collapsed && <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-gray-900 break-words">{User?.name || User?.nickname || 'User'}</p><p className="text-xs text-gray-500 mt-0.5">{Role}</p></div>}
            <SidebarHint Label="Log Out"><button type="button" onClick={()=>useAuthStore.getState().logout()} aria-label="Log Out" className="size-11 shrink-0 inline-flex items-center justify-center rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"><LogOut aria-hidden="true" className="size-5"/></button></SidebarHint>
        </div>
    </aside>;
}
export function Sidebar({ ReloadDocument = false } = {}) {
    const ReturnFocus = useRef(null);
    const {user: User}=useAuthStore();const {isCollapsed: Collapsed,isMobileOpen: MobileOpen,toggleSidebar: Toggle,closeMobile: CloseMobile}=useSidebar();const {t: Translate}=useTranslation();const Role=User?.role||'Staff';
    const Links=[
        {Name:Translate('sidebar.dashboard'),Icon:LayoutDashboard,Path:'/Dashboard',Roles:['Founder','Manager','Developer','Staff']},
        {Name:'POS',Icon:ScanLine,Path:'/POS',Roles:['Founder','Manager','Developer','Staff']},
        {Name:'Orders',Icon:List,Path:'/Orders',Roles:['Founder','Manager','Developer']},
        {Name:Translate('sidebar.inventory'),Icon:Package,Path:'/Inventory',Roles:['Founder','Manager','Developer']},
        {Name:Translate('sidebar.agents'),Icon:Users,Path:'/Agent-Management',Roles:['Founder','Manager','Developer']},
        {Name:'Agent',Icon:UserRound,Path:'/Agent',Roles:['Agent']},
        {Name:Translate('sidebar.settings'),Icon:Settings,Path:'/Settings',Roles:['Founder','Manager','Developer','Staff','Agent']},
    ].filter(Link=>Link.Roles.includes(Role));
    const Props={Toggle,CloseMobile,Links,User,Role,ReloadDocument};
    return <Tooltip.Provider delayDuration={250}><div className="hidden md:block shrink-0 h-full"><SidebarContent {...Props} Collapsed={Collapsed}/></div>
        <Sheet open={MobileOpen} onOpenChange={Open=>{if(!Open)CloseMobile();}}>
            <SheetContent side="left" className="!w-64 !max-w-[calc(100vw-32px)] p-0 gap-0 !animate-none !transition-none md:hidden"
                onOpenAutoFocus={Event => { Event.preventDefault(); ReturnFocus.current = document.activeElement; Event.target.querySelector('a[aria-current="page"], a')?.focus(); }}
                onCloseAutoFocus={Event => { Event.preventDefault(); if (ReturnFocus.current?.isConnected) ReturnFocus.current.focus(); }}>
                <SheetTitle className="sr-only">Main menu</SheetTitle><SheetDescription className="sr-only">Navigate HGH pages.</SheetDescription>
                <SidebarContent {...Props} Collapsed={false} Mobile/>
            </SheetContent>
        </Sheet>
    </Tooltip.Provider>;
}
