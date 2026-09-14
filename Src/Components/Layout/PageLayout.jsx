import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SidebarProvider } from './SidebarContext';
import { SettingsLayout } from '../../Pages/Settings/SettingsLayout';

export function PageLayout() {
    const location = useLocation();
    const isPOS = location.pathname.toLowerCase().includes('/pos');
    const IsSettings = /^\/Settings(?:\/|$)/.test(location.pathname);

    if (IsSettings) return <SettingsLayout><Outlet /></SettingsLayout>;

    return (
        <SidebarProvider>
            <div className="fixed inset-0 flex bg-background overflow-hidden print:static print:inset-auto print:overflow-visible print:h-auto print:block print:bg-white">
                <div className="print:hidden">
                    <Sidebar />
                </div>
                <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 print:h-auto print:overflow-visible print:block">
                    <div className="print:hidden">
                        <Header />
                    </div>
                    <main className={`flex-1 ${isPOS ? 'p-0 overflow-hidden flex flex-col' : 'overflow-y-auto p-4 md:p-6'} print:p-0 print:m-0 print:overflow-visible print:h-auto print:block`}>
                        <Outlet />
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}
