import { Sidebar } from '@/Components/Layout/Sidebar';
import { SidebarProvider } from '@/Components/Layout/SidebarContext';
import { SettingsHeader } from './SettingsHeader';

export function SettingsLayout({ ReloadDocument = false, ShowSidebar = true, children }) {
    return <SidebarProvider>
        <div className="fixed inset-0 flex bg-background text-foreground overflow-hidden">
            {ShowSidebar && <Sidebar ReloadDocument={ReloadDocument} />}
            <div className="flex-1 min-w-0 flex flex-col h-full">
                <SettingsHeader ShowMenu={ShowSidebar} />
                <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
            </div>
        </div>
    </SidebarProvider>;
}
