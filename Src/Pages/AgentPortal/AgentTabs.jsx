import { NavLink } from 'react-router-dom';

const AGENT_TABS = [
    { name: 'Upload AWB', path: '/Agent/Upload' },
    { name: 'Orders', path: '/Agent/Orders' }
];

export function AgentTabs() {

    return (
        <div className="flex justify-between items-center bg-gray-100 p-1 rounded-lg w-full mb-6 overflow-x-auto">
            <div className="flex gap-1">
                {AGENT_TABS.map(tab => (
                <NavLink
                    key={tab.path}
                    to={tab.path}
                    className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            (isActive || (window.location.pathname === tab.path))
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`
                    }
                >
                    {({ isActive }) => (
                        <>
                            {tab.name}
                        </>
                    )}
                    </NavLink>
                ))}
            </div>
        </div>
    );
}
