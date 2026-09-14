import Test from 'node:test';
import Assert from 'node:assert/strict';
import {readFile as ReadFile} from 'node:fs/promises';
import {runInNewContext as Run} from 'node:vm';
import {transformWithOxc as Transform} from 'vite';
const Source=(await ReadFile(new URL('../Src/Pages/Settings/SettingsTabs.jsx',import.meta.url),'utf8')).replace(/^import .*;\r?$/gm,'').replace('export function SettingsTabs','function SettingsTabs');
const {code:Code}=await Transform(Source,'SettingsTabs.jsx',{jsx:{runtime:'classic',pragma:'Element'}});
function Links(Role,Standalone=false){const Result=[];const Context={useTranslation:()=>({t:Key=>Key}),useAuthStore:()=>({user:{role:Role}}),UserRound:'Icon',Settings:'Icon',Users:'Icon',Zap:'Icon',NavLink:'Link',Element:(Type,Props,...Children)=>{if(Type==='Link')Result.push(Props);return {Type,Props,Children}}};Run(Code,Context);Context.SettingsTabs({ReloadDocument:Standalone});return Result;}
Test('all management roles retain all four Settings destinations',()=>{for(const Role of ['Founder','Manager','Developer'])Assert.deepEqual(Array.from(Links(Role),Link=>Link.to),['/Settings/Account','/Settings/General','/Settings/Users','/Settings/APIConnection']);});
Test('app tabs switch without reload; isolated page retains document navigation',()=>{const AppLinks=Links('Manager');Assert.equal(AppLinks.find(Link=>Link.to.endsWith('APIConnection')).reloadDocument,false);Assert.equal(AppLinks.find(Link=>Link.to.endsWith('General')).reloadDocument,false);Assert.ok(Links('Manager',true).every(Link=>Link.reloadDocument));});
Test('staff and agents retain only their permitted account tab',()=>{for(const Role of ['Staff','Agent'])Assert.deepEqual(Array.from(Links(Role),Link=>Link.to),['/Settings/Account']);});

const SidebarSource=(await ReadFile(new URL('../Src/Components/Layout/Sidebar.jsx',import.meta.url),'utf8')).replace(/^import .*;\r?$/gm,'').replace('export function Sidebar','function Sidebar');
const {code:SidebarCode}=await Transform(SidebarSource,'Sidebar.jsx',{jsx:{runtime:'classic',pragma:'Element'}});
Test('sidebar preserves role menus and full navigation from isolated API page',()=>{
    for(const Role of ['Manager','Agent']){const Targets=[];const Context={Tooltip:{Provider:'Provider',Root:'Tooltip',Trigger:'Trigger',Portal:'Portal',Content:'Content',Arrow:'Arrow'},React:{Fragment:'Fragment'},useRef:()=>({current:null}),useAuthStore:()=>({user:{role:Role}}),useSidebar:()=>({}),useTranslation:()=>({t:Key=>Key}),cn:(...Values)=>Values.filter(Boolean).join(' '),NavLink:'NavLink',Sheet:'Sheet',SheetContent:'SheetContent',SheetTitle:'Title',SheetDescription:'Description'};
    for(const Icon of ['LayoutDashboard','Settings','ChevronLeft','UserRound','Package','Users','ScanLine','List','LogOut'])Context[Icon]='Icon';
    Context.Element=(Type,Props,...Children)=>{if(Type==='NavLink')Targets.push(Props);return typeof Type==='function'?Type({...Props,children:Children}):{Type,Props,Children};};
    Run(SidebarCode,Context);Context.Sidebar({ReloadDocument:true});const Paths=[...new Set(Targets.map(Link=>Link.to))];
    Assert.deepEqual(Paths,Role==='Agent'?['/Agent','/Settings']:['/Dashboard','/POS','/Orders','/Inventory','/Agent-Management','/Settings']);Assert.ok(Targets.every(Link=>Link.reloadDocument===true));
    }
});

const HeaderSource=(await ReadFile(new URL('../Src/Components/Layout/Header.jsx',import.meta.url),'utf8')).replace(/import[\s\S]*?;\r?\n/g,'').replace('export function Header','function Header');
const {code:HeaderCode}=await Transform(HeaderSource,'Header.jsx',{jsx:{runtime:'classic',pragma:'Element'}});
Test('shared header only offers manual lock to PIN users and retains language choices',()=>{
    for(const HasPIN of [false,true]) {
        const Elements=[]; let Locks=0;const Context={useSidebar:()=>({}),useLocation:()=>({pathname:'/Dashboard'}),useTranslation:()=>({t:Key=>Key,language:'en'}),useSecretMode:()=>({}),useAuthStore:()=>({user:{hasPin:HasPIN},lockApp:()=>Locks++}),Tooltip:{Provider:'Provider',Root:'Root',Trigger:'Trigger',Portal:'Portal',Content:'Content',Arrow:'Arrow'}};
        for(const Name of ['Menu','Lock','Button','DropdownMenu','DropdownMenuContent','DropdownMenuItem','DropdownMenuSeparator','DropdownMenuTrigger'])Context[Name]=Name;
        Context.Element=(Type,Props,...Children)=>{const Value={Type,Props,Children};Elements.push(Value);return Value;};Run(HeaderCode,Context);Context.Header();
        const LockButton=Elements.find(Item=>Item.Props?.['aria-label']==='Lock');Assert.equal(Boolean(LockButton),HasPIN);if(LockButton){LockButton.Props.onClick();Assert.equal(Locks,1);}
        Assert.ok(Elements.some(Item=>Item.Props?.['aria-label']==='Language'));
        Assert.ok(Elements.some(Item=>Item.Children.includes('English')));Assert.ok(Elements.some(Item=>Item.Children.includes('Bahasa Melayu')));
        Assert.ok(!Elements.some(Item=>Item.Children.includes('HGH Centre')||Item.Children.includes('Back')));
    }
});
