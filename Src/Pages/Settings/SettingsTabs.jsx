import { NavLink } from 'react-router-dom';
import { UserRound, Settings, Users, Zap } from 'lucide-react';
import { useAuthStore } from '@/Hooks/UseAuth';

const Tabs = [
    { Name: 'My Account', Path: '/Settings/Account', Icon: UserRound, Roles: ['Founder', 'Manager', 'Developer', 'Staff', 'Agent'] },
    { Name: 'General', Path: '/Settings/General', Icon: Settings, Roles: ['Founder', 'Manager', 'Developer'] },
    { Name: 'User Management', Path: '/Settings/Users', Icon: Users, Roles: ['Founder', 'Manager', 'Developer'] },
    { Name: 'API Connection', Path: '/Settings/APIConnection', Icon: Zap, Roles: ['Founder', 'Manager', 'Developer'] },
];
export function SettingsTabs({ ReloadDocument = false }) {
    const Role = useAuthStore().user?.role || 'Staff';
    return <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit max-w-full mb-6 overflow-x-auto">
        {Tabs.filter(Tab => Tab.Roles.includes(Role)).map(Tab => <NavLink key={Tab.Path} to={Tab.Path}
            reloadDocument={ReloadDocument}
            className={({ isActive }) => `flex shrink-0 whitespace-nowrap items-center gap-2 px-4 py-2 min-h-11 rounded-md text-sm font-medium transition-all ${isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Tab.Icon className="w-4 h-4" />{Tab.Name}
        </NavLink>)}
    </div>;
}
