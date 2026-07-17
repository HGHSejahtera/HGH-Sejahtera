import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Save, Building2, CreditCard, Package, Settings as SettingsIcon, Users, UserRound, Zap, Lock, Unlock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { ImageDropzone } from '@/components/ui/image-dropzone';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { toast } from 'sonner';

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

const MALAYSIA_STATES = [
    "Johor",
    "Kedah",
    "Kelantan",
    "Melaka",
    "Negeri Sembilan",
    "Pahang",
    "Perak",
    "Perlis",
    "Pulau Pinang",
    "Sabah",
    "Sarawak",
    "Selangor",
    "Terengganu",
    "W.P. Kuala Lumpur",
    "W.P. Labuan",
    "W.P. Putrajaya"
];

function parseAddressStr(str) {
    if (!str) {
        return {
            addressLine1: '',
            addressLine2: '',
            addressLine3: '',
            country: 'Malaysia',
            state: 'Selangor',
            city: '',
            postcode: ''
        };
    }
    const lines = str.includes('\n') ? str.split('\n').map(l => l.trim()).filter(Boolean) : str.split(',').map(l => l.trim()).filter(Boolean);
    
    let country = 'Malaysia';
    let state = 'Selangor';
    let postcode = '';
    let city = '';
    let line1 = lines[0] || '';
    let line2 = lines[1] || '';
    let line3 = lines.length > 4 ? lines[2] : '';
    
    const lastLine = lines[lines.length - 1];
    if (lastLine && (lastLine.toLowerCase() === 'malaysia' || lastLine.toLowerCase() === 'united states' || lastLine.toLowerCase() === 'singapore')) {
        country = lastLine;
    }
    
    lines.forEach(l => {
        const foundState = MALAYSIA_STATES.find(s => l.toLowerCase().includes(s.toLowerCase()));
        if (foundState) state = foundState;
    });
    
    lines.forEach(l => {
        const match = l.match(/\b\d{5}\b/);
        if (match) {
            postcode = match[0];
            city = l.replace(/\b\d{5}\b/, '').replace(/,/g, '').trim();
        }
    });

    return {
        addressLine1: line1,
        addressLine2: line2,
        addressLine3: line3,
        country: country || 'Malaysia',
        state: state || 'Selangor',
        city: city,
        postcode: postcode
    };
}

function SettingsForm({ settingsData }) {
    const updateSettingsMutation = useUpdateSettings();

    const [settings, setSettings] = useState({
        companyName: settingsData.CompanyName || '',
        companyAddress: settingsData.CompanyAddress || '',
        companySSM: settingsData.CompanySSM || '',
        supportEmail: settingsData.SupportEmail || '',
        companyPhone: settingsData.CompanyPhone || '',
        costPerParcel: settingsData.CostPerParcel || '0.80',
        settlementCycle: settingsData.SettlementCycle || 'monthly',
        defaultPlatformFee: settingsData.DefaultPlatformFee || '25',
        duitNowQRImage: settingsData.DuitNowQRImage || '',
        orderIngestionPipeline: settingsData.OrderIngestionPipeline || 'Manual'
    });

    const [addressFields, setAddressFields] = useState(() => parseAddressStr(settingsData.CompanyAddress));

    const [secretPhrase, setSecretPhrase] = useState('');
    const [isPipelineUnlocked, setIsPipelineUnlocked] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');

    const handleAddressChange = (field, value) => {
        const nextFields = { ...addressFields, [field]: value };
        setAddressFields(nextFields);
        
        const lines = [];
        if (nextFields.addressLine1) lines.push(nextFields.addressLine1);
        if (nextFields.addressLine2) lines.push(nextFields.addressLine2);
        if (nextFields.addressLine3) lines.push(nextFields.addressLine3);
        const cityLine = [nextFields.postcode, nextFields.city].filter(Boolean).join(' ');
        if (cityLine || nextFields.state) lines.push([cityLine, nextFields.state].filter(Boolean).join(', '));
        if (nextFields.country) lines.push(nextFields.country);
        
        setSettings(prev => ({ ...prev, companyAddress: lines.join('\n') }));
    };

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
                toast.success('Pipeline Settings Unlocked!');
            } else {
                toast.error('Invalid secret phrase');
            }
        } catch (err) {
            toast.error('Verification failed: ' + (err.message || 'Unknown error'));
        } finally {
            setIsVerifying(false);
        }
    };

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSave = () => {
        setSaveStatus('loading');
        updateSettingsMutation.mutate({
            CompanyName: settings.companyName,
            CompanyAddress: settings.companyAddress,
            CompanySSM: settings.companySSM,
            SupportEmail: settings.supportEmail,
            CompanyPhone: settings.companyPhone,
            CostPerParcel: settings.costPerParcel,
            SettlementCycle: settings.settlementCycle,
            DefaultPlatformFee: settings.defaultPlatformFee,
            DuitNowQRImage: settings.duitNowQRImage,
            OrderIngestionPipeline: settings.orderIngestionPipeline
        }, {
            onSuccess: () => {
                setSaveStatus('success');
                toast.success('Settings saved successfully');
                setTimeout(() => setSaveStatus('idle'), 3000);
            },
            onError: (error) => {
                console.error('Failed to save settings:', error);
                setSaveStatus('error');
                toast.error('Failed to save settings: ' + (error.message || 'Unknown error'));
                setTimeout(() => setSaveStatus('idle'), 4000);
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">System Settings</h1>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" 
                        onClick={handleSave}
                        disabled={updateSettingsMutation.isPending || saveStatus === 'loading'}
                    >
                        {updateSettingsMutation.isPending || saveStatus === 'loading' ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        {updateSettingsMutation.isPending || saveStatus === 'loading' ? 'Saving...' : 'Save Settings'}
                    </Button>
                </div>
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
                        <div className="space-y-4 md:col-span-2 bg-gray-50/60 p-4 rounded-lg border border-gray-200">
                            <Label className="font-semibold text-gray-900 text-sm block">Company Address</Label>
                            
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label htmlFor="addressLine1" className="text-xs text-gray-600">Address Line 1:</Label>
                                    <Input 
                                        id="addressLine1" 
                                        value={addressFields.addressLine1} 
                                        onChange={(e) => handleAddressChange('addressLine1', e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="addressLine2" className="text-xs text-gray-600">Address Line 2:</Label>
                                    <Input 
                                        id="addressLine2" 
                                        value={addressFields.addressLine2} 
                                        onChange={(e) => handleAddressChange('addressLine2', e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="addressLine3" className="text-xs text-gray-600">Address Line 3:</Label>
                                    <Input 
                                        id="addressLine3" 
                                        value={addressFields.addressLine3} 
                                        onChange={(e) => handleAddressChange('addressLine3', e.target.value)} 
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-600">Country:</Label>
                                        <Select value={addressFields.country} onValueChange={(val) => handleAddressChange('country', val)}>
                                            <SelectTrigger className="w-full bg-white h-10 text-sm font-normal">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Malaysia">Malaysia</SelectItem>
                                                <SelectItem value="Singapore">Singapore</SelectItem>
                                                <SelectItem value="Brunei">Brunei</SelectItem>
                                                <SelectItem value="Indonesia">Indonesia</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-600">State:</Label>
                                        <Select value={addressFields.state} onValueChange={(val) => handleAddressChange('state', val)}>
                                            <SelectTrigger className="w-full bg-white h-10 text-sm font-normal">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60">
                                                {MALAYSIA_STATES.map(s => (
                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="city" className="text-xs text-gray-600">City:</Label>
                                        <Input 
                                            id="city" 
                                            value={addressFields.city} 
                                            onChange={(e) => handleAddressChange('city', e.target.value)} 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="postcode" className="text-xs text-gray-600">ZIP Code:</Label>
                                        <Input 
                                            id="postcode" 
                                            value={addressFields.postcode} 
                                            onChange={(e) => handleAddressChange('postcode', e.target.value)} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="companyPhone">Company Phone</Label>
                            <Input 
                                id="companyPhone" name="companyPhone" 
                                value={settings.companyPhone} onChange={handleChange} 
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
