import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Save, Upload, Building2, CreditCard, Package, Settings as SettingsIcon, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SETTINGS_TABS = [
    { name: 'General', path: '/settings/general', icon: SettingsIcon },
    { name: 'User Management', path: '/settings/users', icon: Users },
];

function SettingsTabs() {
    return (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
            {SETTINGS_TABS.map(tab => (
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
    const [settings, setSettings] = useState({
        companyName: '',
        supportEmail: '',
        costPerParcel: '5.50',
        settlementCycle: '7'
    });

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">System Settings</h1>
                </div>
                <Button className="h-10">
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
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
                            <Label htmlFor="settlementCycle">Agent Settlement Cycle (Days)</Label>
                            <Input 
                                id="settlementCycle" name="settlementCycle" type="number"
                                value={settings.settlementCycle} onChange={handleChange} 
                            />
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
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center bg-gray-50 flex-1 min-h-[250px]">
                                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                <span className="text-sm font-medium text-gray-600">Upload DuitNow QR (PNG, JPG)</span>
                                <Button variant="outline" size="sm" className="mt-4">Choose File</Button>
                            </div>
                        </div>
                    </div>
                </div>

                </div>
            </div>
        </div>
    );
}
