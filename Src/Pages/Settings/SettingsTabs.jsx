import { NavLink } from 'react-router-dom';
import { UserRound, Settings, Users, Zap } from 'lucide-react';
import { useTranslation } from '@/Hooks/UseTranslation';
import { useAuthStore } from '@/Hooks/UseAuth';

const Tabs = [
    { Name: 'My Account', Path: '/Settings/Account', Icon: UserRound, Roles: ['Founder', 'Manager', 'Developer', 'Staff', 'Agent'] },
    { Name: 'General', Path: '/Settings/General', Icon: Settings, Roles: ['Founder', 'Manager', 'Developer'] },
    { Name: 'User Management', Path: '/Settings/Users', Icon: Users, Roles: ['Founder', 'Manager', 'Developer'] },
    { Name: 'API Connection', Path: '/Settings/APIConnection', Icon: Zap, Roles: ['Founder', 'Manager', 'Developer'] },
];
export function SettingsTabs({ ReloadDocument = false }) {
    const { t: Translate } = useTranslation();
    const Role = useAuthStore().user?.role || 'Staff';
    return <nav aria-label="Settings" className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-fit max-w-full">
        {Tabs.filter(Tab => Tab.Roles.includes(Role)).map(Tab => <NavLink key={Tab.Path} to={Tab.Path}
            reloadDocument={ReloadDocument}
            className={({ isActive }) => `flex min-w-0 items-center gap-2 px-3 sm:px-4 py-2 min-h-11 rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'}`}>
            <Tab.Icon aria-hidden="true" className="w-4 h-4 shrink-0" />{Translate('SettingsNavigation.' + Tab.Path.split('/').at(-1))}
        </NavLink>)}
    </nav>;
}
