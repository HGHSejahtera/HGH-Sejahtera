import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Save, Building2, CreditCard, Package, Settings as SettingsIcon, Users, UserRound, Zap, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
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
        duitNowQRImage: settingsData.DuitNowQRImage || '',
        orderIngestionPipeline: settingsData.OrderIngestionPipeline || 'Manual'
    });

    const [secretPhrase, setSecretPhrase] = useState('');
    const [isPipelineUnlocked, setIsPipelineUnlocked] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    const handleVerifySecret = async () => {
        if (!secretPhrase) return;
        setIsVerifying(true);
        try {
            const { data, error } = await supabase.rpc('verify_pipeline_secret', {
                p_secret: secretPhrase
            });
            if (error) throw error;
            if (data === true) {
                setIsPipelineUnlocked(true);
                setSecretPhrase('');
                alert('Pipeline Settings Unlocked!');
            } else {
                alert('Invalid secret phrase.');
            }
        } catch (err) {
            alert('Verification failed: ' + err.message);
        } finally {
            setIsVerifying(false);
        }
    };

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
            DuitNowQRImage: settings.duitNowQRImage,
            OrderIngestionPipeline: settings.orderIngestionPipeline
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
                {/* General Info */}
                <div className="bg-white rounded-xl shadow-sm border p-6 order-1 flex flex-col">
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
                <div className="bg-white rounded-xl shadow-sm border p-6 order-3 flex flex-col">
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
                        </div>
                    </div>
                </div>

                {/* Payment Gateway */}
                <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col order-2">
                    <div className="flex items-center mb-4 text-lg font-semibold border-b pb-2">
                        <CreditCard className="w-5 h-5 mr-2 text-indigo-600" />
                        Payment Configuration
                    </div>
                    <div className="flex flex-col">
                        <div className="flex flex-col">
                            <Label>DuitNow QR Code</Label>
                            <div>
                                <ImageDropzone 
                                    value={settings.duitNowQRImage} 
                                    onChange={(val) => setSettings({ ...settings, duitNowQRImage: val })} 
                                    className="h-48"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Integration Settings */}
                <div className="bg-white rounded-xl shadow-sm border p-6 order-4 flex flex-col">
                    <div className="flex items-center mb-4 text-lg font-semibold border-b pb-2">
                        <Zap className="w-5 h-5 mr-2 text-indigo-600" />
                        Integration: Order Ingestion Pipeline
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Pipeline Mode</Label>
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                    <input 
                                        type="radio" 
                                        name="orderIngestionPipeline" 
                                        value="Manual" 
                                        checked={settings.orderIngestionPipeline === 'Manual'}
                                        onChange={handleChange}
                                        disabled={!isPipelineUnlocked}
                                        className="w-4 h-4 text-indigo-600"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium">Manual (PDF AWB)</div>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${isPipelineUnlocked ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60 cursor-not-allowed bg-gray-100'}`}>
                                    <input 
                                        type="radio" 
                                        name="orderIngestionPipeline" 
                                        value="Auto" 
                                        checked={settings.orderIngestionPipeline === 'Auto'}
                                        onChange={handleChange}
                                        disabled={!isPipelineUnlocked}
                                        className="w-4 h-4 text-indigo-600"
                                    />
                                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                        <div className="font-medium">Auto (Official TikTok API)</div>
                                        <span className="text-[10px] w-fit bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">COMING SOON</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="secretPhrase" className="flex items-center gap-2">
                                {isPipelineUnlocked ? <Unlock className="w-4 h-4 text-green-600"/> : <Lock className="w-4 h-4 text-red-500"/>}
                                Secret Phrase
                            </Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="secretPhrase" 
                                    type="password" 
                                    placeholder={isPipelineUnlocked ? "Unlocked!" : ""}
                                    value={secretPhrase} 
                                    onChange={(e) => setSecretPhrase(e.target.value)} 
                                    disabled={isPipelineUnlocked || isVerifying}
                                />
                                {!isPipelineUnlocked && (
                                    <Button variant="secondary" onClick={handleVerifySecret} disabled={!secretPhrase || isVerifying}>
                                        {isVerifying ? 'Verifying...' : 'Unlock'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
