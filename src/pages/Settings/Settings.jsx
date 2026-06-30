import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Save, Building2, CreditCard, Package, Settings as SettingsIcon, Users, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { ImageDropzone } from '@/components/ui/image-dropzone';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

const SETTINGS_TABS = [
    { name: 'My Account', path: '/Settings/Account', icon: UserRound, roles: ['Founder', 'Manager', 'Developer', 'Staff', 'Agent'] },
    { name: 'General', path: '/Settings/General', icon: SettingsIcon, roles: ['Founder', 'Manager', 'Developer'] },
    { name: 'User Management', path: '/Settings/Users', icon: Users, roles: ['Founder', 'Manager', 'Developer'] },
];

export function SettingsTabs() {
    const { user } = useAuthStore();
    const role = user?.role || 'Staff';
    const allowedTabs = SETTINGS_TABS.filter(tab => tab.roles.includes(role));

    return (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6 overflow-x-auto">
            {allowedTabs.map(tab => (
                <NavLink
                    key={tab.path}
                    to={tab.path}
                    className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            isActive
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`
                    }
                >
                    <tab.icon className="w-4 h-4" />
                    {tab.name}
                </NavLink>
            ))}
        </div>
    );
}

export function Settings() {
    const { data: settingsData, isLoading } = useSettings();

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!settingsData) return null;

    return <SettingsForm settingsData={settingsData} />;
}

function SettingsForm({ settingsData }) {
    const updateSettingsMutation = useUpdateSettings();

    const [settings, setSettings] = useState({
        companyName: settingsData.CompanyName || '',
        companyAddress: settingsData.CompanyAddress || '',
        companySSM: settingsData.CompanySSM || '',
        supportEmail: settingsData.SupportEmail || '',
        costPerParcel: settingsData.CostPerParcel || '0.80',
        settlementCycle: settingsData.SettlementCycle || 'monthly',
        defaultPlatformFee: settingsData.DefaultPlatformFee || '25',
        duitNowQRImage: settingsData.DuitNowQRImage || ''
    });

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSave = () => {
        updateSettingsMutation.mutate({
            CompanyName: settings.companyName,
            CompanyAddress: settings.companyAddress,
            CompanySSM: settings.companySSM,
            SupportEmail: settings.supportEmail,
            CostPerParcel: settings.costPerParcel,
            SettlementCycle: settings.settlementCycle,
            DefaultPlatformFee: settings.defaultPlatformFee,
            DuitNowQRImage: settings.duitNowQRImage
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">System Settings</h1>
                </div>
                <Button 
                    className="h-10" 
                    onClick={handleSave}
                    disabled={updateSettingsMutation.isPending}
                >
                    {updateSettingsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>

            <SettingsTabs />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                {/* General Info */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center mb-4 text-lg font-semibold border-b pb-2">
                        <Building2 className="w-5 h-5 mr-2 text-indigo-600" />
                        Company Details
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name</Label>
                            <Input 
                                id="companyName" name="companyName" 
                                value={settings.companyName} onChange={handleChange} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="companySSM">Company SSM</Label>
                            <Input 
                                id="companySSM" name="companySSM" 
                                value={settings.companySSM} onChange={handleChange} 
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="companyAddress">Company Address</Label>
                            <Input 
                                id="companyAddress" name="companyAddress" 
                                value={settings.companyAddress} onChange={handleChange} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="supportEmail">Support Email</Label>
                            <Input 
                                id="supportEmail" name="supportEmail" type="email"
                                value={settings.supportEmail} onChange={handleChange} 
                            />
                        </div>
                    </div>
                </div>

                {/* Operations & Finance */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center mb-4 text-lg font-semibold border-b pb-2">
                        <Package className="w-5 h-5 mr-2 text-indigo-600" />
                        Operations & Finance
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="costPerParcel">Standard Cost per Parcel (RM)</Label>
                            <Input 
                                id="costPerParcel" name="costPerParcel" type="number" step="0.10"
                                value={settings.costPerParcel} onChange={handleChange} 
                            />
                            <p className="text-xs text-gray-500">Used for automated fulfillment cost calculations.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="settlementCycle">Agent Settlement Cycle</Label>
                            <Input 
                                id="settlementCycle" name="settlementCycle" 
                                value={settings.settlementCycle} onChange={handleChange} 
                                placeholder="e.g. monthly, weekly"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="defaultPlatformFee">Default Platform Fee (%)</Label>
                            <Input 
                                id="defaultPlatformFee" name="defaultPlatformFee" type="number" step="0.1"
                                value={settings.defaultPlatformFee} onChange={handleChange} 
                            />
                            <p className="text-xs text-gray-500">Default fallback for channel percentage fees.</p>
                        </div>
                    </div>
                </div>

                </div>

                <div className="h-full flex flex-col">
                {/* Payment Gateway */}
                <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col flex-1">
                    <div className="flex items-center mb-4 text-lg font-semibold border-b pb-2">
                        <CreditCard className="w-5 h-5 mr-2 text-indigo-600" />
                        Payment Configuration
                    </div>
                    <div className="flex flex-col flex-1">
                        <div className="flex flex-col flex-1">
                            <Label>DuitNow QR Code</Label>
                            <p className="text-xs text-gray-500 mb-4">This QR code will be displayed to agents during manual checkout and on invoices.</p>
                            <div className="flex-1">
                                <ImageDropzone 
                                    value={settings.duitNowQRImage} 
                                    onChange={(val) => setSettings({ ...settings, duitNowQRImage: val })} 
                                    className="h-64"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                </div>
            </div>
        </div>
    );
}
