import React from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  PlusCircle, 
  Printer, 
  Sliders, 
  ShieldCheck, 
  PackagePlus, 
  PanelLeftClose, 
  PanelLeftOpen 
} from 'lucide-react';
import { ActiveTab } from './BottomNavBar';

interface SidebarNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  expenseCount: number;
  isAdmin?: boolean;
  pendingApprovalCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onTabChange,
  expenseCount,
  isAdmin = false,
  pendingApprovalCount = 0,
  isCollapsed,
  onToggleCollapse,
}) => {
  const baseTabs = [
    ...(isAdmin
      ? [
          {
            id: 'admin' as ActiveTab,
            label: 'Panel Admin',
            sublabel: 'Edit & Approve',
            icon: ShieldCheck,
            badge: pendingApprovalCount,
            isAdminTab: true,
          },
          {
            id: 'rekap_dinas' as ActiveTab,
            label: 'Rekapan Se Dinas',
            sublabel: 'Rekap Se-Kabupaten',
            icon: FileSpreadsheet,
            isAdminTab: true,
          },
        ]
      : []),
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      sublabel: 'Rekap TW',
      icon: LayoutDashboard,
    },
    ...(!isAdmin
      ? [
          {
            id: 'list' as ActiveTab,
            label: 'Data Belanja',
            sublabel: 'Tabel & Kartu',
            icon: FileSpreadsheet,
            badge: expenseCount,
          },
        ]
      : []),
    {
      id: 'form' as ActiveTab,
      label: 'Input Belanja',
      sublabel: 'Formulir SPJ',
      icon: PlusCircle,
      highlight: true,
    },
    {
      id: 'cetak_laporan' as ActiveTab,
      label: 'Cetak Laporan',
      sublabel: 'Rekon, Stock & Ekstra',
      icon: Printer,
    },
    {
      id: 'barang_ekstra' as ActiveTab,
      label: 'Barang Ekstra',
      sublabel: 'Inventaris Non-Rutin',
      icon: PackagePlus,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Pagu & Info',
      sublabel: 'Profil Sekolah',
      icon: Sliders,
    },
  ];

  return (
    <aside
      aria-label="Navigasi Samping"
      className={`fixed top-0 left-0 bottom-0 z-40 bg-slate-900 text-white border-r border-slate-800 shadow-2xl transition-all duration-300 flex flex-col print:hidden ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Sidebar Header / Logo & Collapse Toggle */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-white shrink-0 shadow-md">
              B
            </div>
            <div className="truncate">
              <span className="text-xs font-black tracking-wider uppercase block text-white truncate">
                BOSP Sekolah
              </span>
              <span className="text-[10px] text-emerald-400 block truncate">
                Sistem Pengelolaan
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Tampilkan Sidebar (Unhide)' : 'Sembunyikan Sidebar (Hide)'}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer mx-auto sm:mx-0 shadow-xs"
          aria-label="Toggle Sidebar"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-emerald-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-emerald-400" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {baseTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if ('isAdminTab' in tab && tab.isAdminTab) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                title={tab.label}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all relative group cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                    : 'bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 border border-amber-600/30'
                }`}
              >
                <div className="relative shrink-0">
                  <Icon className="w-5 h-5" />
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[10px] font-extrabold px-1 rounded-full min-w-4 text-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="text-left truncate">
                    <span className="text-xs font-black block leading-tight truncate">{tab.label}</span>
                    <span className="text-[10px] opacity-80 leading-none block truncate mt-0.5">{tab.sublabel}</span>
                  </div>
                )}
              </button>
            );
          }

          if (tab.highlight) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                title={tab.label}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all relative group cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/30'
                    : 'bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-600/30'
                }`}
              >
                <div className="relative shrink-0">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                {!isCollapsed && (
                  <div className="text-left truncate">
                    <span className="text-xs font-bold block leading-tight truncate">{tab.label}</span>
                    <span className="text-[10px] opacity-80 leading-none block truncate mt-0.5">{tab.sublabel}</span>
                  </div>
                )}
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all relative group cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-emerald-400 font-bold border-l-4 border-emerald-500 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="relative shrink-0">
                <Icon className="w-5 h-5" />
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white text-[10px] font-bold px-1 rounded-full min-w-4 text-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <div className="text-left truncate">
                  <span className="text-xs font-semibold block leading-tight truncate">{tab.label}</span>
                  <span className="text-[10px] text-slate-500 leading-none block truncate mt-0.5">{tab.sublabel}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Sidebar Footer info */}
      {!isCollapsed && (
        <div className="p-3 m-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-400">
          <div className="font-bold text-slate-200">BOSP v2.6</div>
          <div className="text-[10px] text-slate-400">Minahasa Tenggara</div>
        </div>
      )}
    </aside>
  );
};
