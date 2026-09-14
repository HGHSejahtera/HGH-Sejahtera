import { SettingsTabs } from './SettingsTabs';

export function SettingsPage({ Title, Description, Actions, ReloadDocument = false, children }) {
    return <div className="w-full min-w-0 max-w-5xl mx-auto p-4 md:p-6 pb-12 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">{Title}</h1>
                {Description && <p className="text-sm text-gray-500">{Description}</p>}
            </div>
            {Actions && <div className="flex flex-wrap gap-2">{Actions}</div>}
        </div>
        <SettingsTabs ReloadDocument={ReloadDocument} />
        {children}
    </div>;
}
