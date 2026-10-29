/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  SchoolExpense, 
  SchoolInfo, 
  Triwulan, 
  ExpenseStatus,
  BarangEkstraItem
} from './types';
import { UserProfile, UserAccount, UserRole } from './types/auth';
import { filterExpensesByYear, filterExpensesForUser, getExpenseYear } from './utils/budgetCalculations';
import { 
  loadSchoolExpenses, 
  saveSchoolExpenses, 
  clearAllSchoolExpenses,
  loadSchoolInfo, 
  saveSchoolInfo,
  loadBarangEkstraItems,
  saveBarangEkstraItems,
  parseAndNormalizeBarangEkstraCsv
} from './utils/storage';
import { 
  loadStoredAccounts, 
  loadCurrentSession, 
  saveCurrentSession,
  isAdminUser
} from './utils/auth';
import { INITIAL_SCHOOL_INFO } from './data/initialData';
import { UptSchoolAccount, loadUptSchools, normalizeUptKey } from './data/schoolData';
import { AppHeader } from './components/AppHeader';
import { SidebarNav } from './components/SidebarNav';
import { ActiveTab } from './components/BottomNavBar';
import { DashboardView } from './components/DashboardView';
import { ExpenseListView } from './components/ExpenseListView';
import { ExpenseFormView } from './components/ExpenseFormView';
import { ReceiptPrintView } from './components/ReceiptPrintView';
import { SchoolSettingsView } from './components/SchoolSettingsView';
import { ExpenseDetailModal } from './components/ExpenseDetailModal';
import { AuthModal } from './components/AuthModal';
import { LoginScreen } from './components/LoginScreen';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { AdminPanelView } from './components/AdminPanelView';
import { DinasRekapView } from './components/DinasRekapView';
import { CetakLaporanView } from './components/CetakLaporanView';
import { BarangEkstraView } from './components/BarangEkstraView';
import { CheckCircle2 } from 'lucide-react';

export default function App() {
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(loadSchoolInfo);
  const [expenses, setExpenses] = useState<SchoolExpense[]>(loadSchoolExpenses);
  const [barangEkstraItems, setBarangEkstraItems] = useState<BarangEkstraItem[]>(loadBarangEkstraItems);

  useEffect(() => {
    const initBarangEkstra = async () => {
      const current = loadBarangEkstraItems();
      if (current.length === 0) {
        try {
          const res = await fetch('/assets/aistudio/BARANG_EKSTRA_1931b918');
          if (res.ok) {
            const text = await res.text();
            if (text && text.trim()) {
              const parsed = parseAndNormalizeBarangEkstraCsv(text);
              if (parsed.length > 0) {
                saveBarangEkstraItems(parsed);
                setBarangEkstraItems(parsed);
              }
            }
          }
        } catch (err) {
          console.error('Failed to auto-load barang ekstra file', err);
        }
      } else {
        let hasMigration = false;
        const migrated = current.map((item) => {
          if (
            item.schoolName === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
            item.schoolName === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
            (item.schoolName?.trim().toUpperCase().startsWith('DINAS PENDIDIKAN') &&
              item.schoolName !== 'DINAS PENDIDIKAN')
          ) {
            hasMigration = true;
            return { ...item, schoolName: 'DINAS PENDIDIKAN' };
          }
          return item;
        });
        if (hasMigration) {
          saveBarangEkstraItems(migrated);
          setBarangEkstraItems(migrated);
        }
      }
    };
    initBarangEkstra();
  }, []);

  const handleSaveBarangEkstra = (item: BarangEkstraItem) => {
    setBarangEkstraItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing && existing.status === 'Disetujui Kepala Sekolah') {
        showToast('Barang yang sudah di-approve tidak dapat diubah.', 'info');
        return prev;
      }
      const updated = existing
        ? prev.map((i) => (i.id === item.id ? item : i))
        : [item, ...prev];
      saveBarangEkstraItems(updated);
      return updated;
    });
    showToast('Data Barang Ekstra berhasil disimpan.');
  };

  const handleDeleteBarangEkstra = (id: string) => {
    setBarangEkstraItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target && target.status === 'Disetujui Kepala Sekolah') {
        showToast('Barang yang sudah di-approve tidak dapat dihapus.', 'info');
        return prev;
      }
      const updated = prev.filter((i) => i.id !== id);
      saveBarangEkstraItems(updated);
      return updated;
    });
    showToast('Data Barang Ekstra berhasil dihapus.', 'info');
  };

  const handleUpdateBarangEkstraStatus = (id: string, status: BarangEkstraItem['status']) => {
    setBarangEkstraItems((prev) => {
      const updated = prev.map((i) => (i.id === id ? { ...i, status } : i));
      saveBarangEkstraItems(updated);
      return updated;
    });
    showToast(
      status === 'Disetujui Kepala Sekolah'
        ? 'Barang Ekstra berhasil di-Approve.'
        : 'Status Barang Ekstra diubah menjadi Menunggu (Batal Approve).'
    );
  };

  // Authentication State
  const [accounts] = useState<UserAccount[]>(loadStoredAccounts);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(loadCurrentSession);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  
  // Google Sheets Modal State
  const [googleSheetsModalOpen, setGoogleSheetsModalOpen] = useState(false);

  // Navigation & Filtering State
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const initialUser = loadCurrentSession();
    return isAdminUser(initialUser) ? 'admin' : 'dashboard';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeQuarterFilter, setActiveQuarterFilter] = useState<string[]>([
    'TW1',
    'TW2',
    'TW3',
    'TW4',
  ]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const isAdmin = isAdminUser(currentUser);
  // Filter per Tahun Anggaran aktif
  const yearFilteredExpenses = filterExpensesByYear(expenses, schoolInfo.tahunAnggaran);
  // Hak akses: Admin melihat semua inputan, Operator BOS HANYA melihat inputan sekolah masing-masing
  const activeYearExpenses = filterExpensesForUser(yearFilteredExpenses, currentUser, schoolInfo.namaSekolah);
  const pendingApprovalCount = activeYearExpenses.filter((e) => e.status !== 'Disetujui Kepala Sekolah').length;

  // Modals & Selected items
  const [selectedExpenseForDetail, setSelectedExpenseForDetail] = useState<SchoolExpense | null>(null);
  const [editingExpense, setEditingExpense] = useState<SchoolExpense | null>(null);
  const [expenseForReceipt, setExpenseForReceipt] = useState<SchoolExpense | null>(null);
  const [formDefaultQuarter, setFormDefaultQuarter] = useState<Triwulan>('TW1');

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Automatically scroll to top when changing active tab
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Auth Handlers
  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleLoginSuccess = (user: UserProfile, schoolAccount?: UptSchoolAccount, loginYear?: string) => {
    setCurrentUser(user);
    saveCurrentSession(user);
    setSelectedExpenseForDetail(null);
    setEditingExpense(null);
    setExpenseForReceipt(null);

    const matchedSchool =
      schoolAccount ||
      loadUptSchools().find(
        (s) => s.upt.toLowerCase() === (user.schoolName || '').toLowerCase()
      );

    const resolvedYear = loginYear ? Number(loginYear) || schoolInfo.tahunAnggaran : schoolInfo.tahunAnggaran;
    if (matchedSchool) {
      const updatedInfo: SchoolInfo = {
        ...schoolInfo,
        tahunAnggaran: resolvedYear,
        namaSekolah: matchedSchool.upt,
        npsn: matchedSchool.npsn || schoolInfo.npsn,
        kecamatan: matchedSchool.kecamatan || schoolInfo.kecamatan,
        alamat: matchedSchool.kecamatan ? `Kec. ${matchedSchool.kecamatan}` : schoolInfo.alamat,
        kepalaSekolah: matchedSchool.kepalaSekolah || schoolInfo.kepalaSekolah,
        nipKepalaSekolah: matchedSchool.nipKepalaSekolah || schoolInfo.nipKepalaSekolah,
        bendahara: matchedSchool.bendahara || schoolInfo.bendahara,
        nipBendahara: matchedSchool.nipBendahara || schoolInfo.nipBendahara,
        bendaharaBarang: matchedSchool.pengurusBarang || schoolInfo.bendaharaBarang,
        nipBendaharaBarang: matchedSchool.nipPengurusBarang || schoolInfo.nipBendaharaBarang,
      };
      setSchoolInfo(updatedInfo);
      saveSchoolInfo(updatedInfo);
    } else if (loginYear) {
      const updatedInfo: SchoolInfo = {
        ...schoolInfo,
        tahunAnggaran: resolvedYear,
      };
      setSchoolInfo(updatedInfo);
      saveSchoolInfo(updatedInfo);
    }

    if (isAdminUser(user)) {
      setActiveTab('admin');
      showToast(`Selamat datang Admin ${user.name} (${user.schoolName})!`);
    } else {
      setActiveTab('dashboard');
      showToast(`Selamat datang kembali, ${user.name} - ${user.schoolName}!`);
    }
  };

  const handleSwitchRole = (newRole: UserRole) => {
    if (!currentUser) return;
    const updatedUser: UserProfile = {
      ...currentUser,
      role: newRole,
    };
    setCurrentUser(updatedUser);
    saveCurrentSession(updatedUser);
    if (newRole === 'Admin') {
      setActiveTab('admin');
      showToast('Mode Tampilan Khusus Admin diaktifkan (Hak Akses Edit & Approve).');
    } else {
      if (activeTab === 'admin') {
        setActiveTab('dashboard');
      }
      showToast('Mode Operator BOSP diaktifkan.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    saveCurrentSession(null);
    setActiveTab('dashboard');
    showToast('Anda telah keluar dari sistem.', 'info');
  };

  // Sync state to LocalStorage
  const updateExpenses = (newExpenses: SchoolExpense[]) => {
    setExpenses(newExpenses);
    saveSchoolExpenses(newExpenses);
  };

  const updateSchoolInfo = (newInfo: SchoolInfo) => {
    setSchoolInfo(newInfo);
    saveSchoolInfo(newInfo);
    showToast('Profil sekolah dan pagu anggaran berhasil disimpan.');
  };

  // Handlers for expense CRUD
  const handleSaveExpense = (rawSavedExpense: SchoolExpense) => {
    const savedExpense: SchoolExpense = {
      ...rawSavedExpense,
      tahunAnggaran: rawSavedExpense.tahunAnggaran || schoolInfo.tahunAnggaran,
      schoolName: rawSavedExpense.schoolName || schoolInfo.namaSekolah,
      npsn: rawSavedExpense.npsn || schoolInfo.npsn,
    };
    const existing = expenses.find((e) => e.id === savedExpense.id);
    if (existing && !isAdmin && existing.status === 'Disetujui Kepala Sekolah') {
      showToast(
        'Inputan yang sudah di-Approve oleh Admin tidak dapat diubah oleh Operator BOS.',
        'info'
      );
      return;
    }

    const isEditing = Boolean(existing);
    let updated: SchoolExpense[];

    if (isEditing) {
      updated = expenses.map((e) => (e.id === savedExpense.id ? savedExpense : e));
      showToast('Data inputan belanja berhasil diperbarui.');
    } else {
      updated = [savedExpense, ...expenses];
      showToast(`Transaksi baru (${savedExpense.triwulan}) berhasil dicatat.`);
    }

    updateExpenses(updated);
    setEditingExpense(null);
    setActiveTab(isAdmin ? 'admin' : 'list');
  };

  const handleDeleteExpense = (id: string, sourceIds?: string[]) => {
    // Akun Operator BOS dan Admin dapat menghapus inputan belanja (termasuk laporan gabungan TW)
    const idsToDelete = new Set(sourceIds && sourceIds.length > 0 ? sourceIds : [id]);
    const updated = expenses.filter((e) => !idsToDelete.has(e.id));
    updateExpenses(updated);
    showToast('Data inputan belanja berhasil dihapus.', 'info');
  };

  const handleUpdateStatus = (id: string, newStatus: ExpenseStatus, sourceIds?: string[]) => {
    const idsToUpdate = new Set(sourceIds && sourceIds.length > 0 ? sourceIds : [id]);
    const updated = expenses.map((e) => (idsToUpdate.has(e.id) ? { ...e, status: newStatus } : e));
    updateExpenses(updated);
    if (
      selectedExpenseForDetail &&
      (selectedExpenseForDetail.id === id || idsToUpdate.has(selectedExpenseForDetail.id))
    ) {
      setSelectedExpenseForDetail({ ...selectedExpenseForDetail, status: newStatus });
    }
    showToast(`Status SPJ berhasil diubah menjadi "${newStatus}".`);
  };

  const handleApproveExpense = (id: string, sourceIds?: string[]) => {
    const idsToApprove = new Set(sourceIds && sourceIds.length > 0 ? sourceIds : [id]);
    const target = expenses.find((e) => idsToApprove.has(e.id));
    const updated = expenses.map((e) =>
      idsToApprove.has(e.id) ? { ...e, status: 'Disetujui Kepala Sekolah' as ExpenseStatus } : e
    );
    updateExpenses(updated);
    if (
      selectedExpenseForDetail &&
      (selectedExpenseForDetail.id === id || idsToApprove.has(selectedExpenseForDetail.id))
    ) {
      setSelectedExpenseForDetail({
        ...selectedExpenseForDetail,
        status: 'Disetujui Kepala Sekolah',
      });
    }
    showToast(`Inputan belanja ${target?.noBukti || ''} berhasil di-Approve oleh Admin!`);
  };

  const handleBulkApproveExpenses = (ids: string[]) => {
    const idSet = new Set(ids);
    const updated = expenses.map((e) =>
      idSet.has(e.id) ? { ...e, status: 'Disetujui Kepala Sekolah' as ExpenseStatus } : e
    );
    updateExpenses(updated);
    showToast(`Berhasil menyetujui (Approve) ${ids.length} inputan belanja sekolah!`);
  };

  const handleClearAllExpenses = () => {
    clearAllSchoolExpenses();
    setExpenses([]);
    setSelectedExpenseForDetail(null);
    setEditingExpense(null);
    setExpenseForReceipt(null);
    showToast('Semua data inputan belanja yang sudah ada berhasil dihapus.');
  };

  const handleResetDemoData = () => {
    handleClearAllExpenses();
    setSchoolInfo(INITIAL_SCHOOL_INFO);
    saveSchoolInfo(INITIAL_SCHOOL_INFO);
  };

  // Navigation helpers
  const handleOpenNewExpense = (tw?: Triwulan) => {
    setEditingExpense(null);
    const validQuarters = activeQuarterFilter.filter((q): q is Triwulan =>
      ['TW1', 'TW2', 'TW3', 'TW4'].includes(q)
    );
    if (tw) {
      setFormDefaultQuarter(tw);
    } else if (
      validQuarters.length > 0 &&
      validQuarters.length < 4 &&
      !activeQuarterFilter.includes('Semua')
    ) {
      setFormDefaultQuarter(validQuarters[0]);
    } else {
      setFormDefaultQuarter('TW1');
    }
    setActiveTab('form');
  };

  const handleEditExpense = (exp: SchoolExpense) => {
    const actualExp =
      exp.sourceExpenseIds && exp.sourceExpenseIds.length > 0
        ? expenses.find((e) => exp.sourceExpenseIds!.includes(e.id)) || exp
        : exp;
    if (!isAdmin && actualExp.status === 'Disetujui Kepala Sekolah') {
      showToast(
        'Inputan yang sudah di-Approve oleh Admin tidak dapat diedit oleh Operator BOS.',
        'info'
      );
      return;
    }
    setEditingExpense(actualExp);
    setActiveTab('form');
  };

  const handlePrintReceipt = (exp: SchoolExpense) => {
    setExpenseForReceipt(exp);
    setActiveTab('receipt');
  };

  const handleImportExpenses = (importedList: SchoolExpense[]) => {
    // Merge: update existing by ID, prepend new ones
    const existingMap = new Map(expenses.map(e => [e.id, e]));
    importedList.forEach(item => {
      existingMap.set(item.id, {
        ...item,
        tahunAnggaran: item.tahunAnggaran || getExpenseYear(item) || schoolInfo.tahunAnggaran,
      });
    });
    const merged = Array.from(existingMap.values()).sort(
      (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
    );
    updateExpenses(merged);
    showToast(`Berhasil mengimpor ${importedList.length} transaksi dari Google Sheets.`);
  };

  // GATEKEEPER: Jika belum login, tidak bisa masuk ke halaman web / dashboard / data belanja
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950">
        {toastMessage && (
          <div 
            className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-fadeIn text-xs sm:text-sm font-medium"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
        )}
        <LoginScreen
          accounts={accounts}
          schoolInfo={schoolInfo}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans antialiased transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
      {/* Toast Notification Floating Banner */}
      {toastMessage && (
        <div 
          className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-fadeIn text-xs sm:text-sm font-medium"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* App Header (with School Name, Google Sheets Live Sync, Quarter selector, Search, and User Auth) */}
      <AppHeader
        schoolInfo={schoolInfo}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        activeQuarterFilter={activeQuarterFilter}
        onQuarterFilterChange={(tw) => {
          setActiveQuarterFilter(tw);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setActiveTab('settings')}
        onOpenGoogleSheets={() => setGoogleSheetsModalOpen(true)}
        onNewExpense={() => handleOpenNewExpense()}
        onOpenAdminPanel={() => setActiveTab('admin')}
        onSwitchRole={handleSwitchRole}
      />

      {/* Main Container */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 sm:pb-12 ${selectedExpenseForDetail ? 'print:hidden' : ''}`}>
        {activeTab === 'admin' && isAdmin && currentUser && (
          <AdminPanelView
            schoolInfo={schoolInfo}
            currentUser={currentUser}
            expenses={activeYearExpenses}
            barangEkstraItems={barangEkstraItems}
            onApproveExpense={handleApproveExpense}
            onBulkApproveExpenses={handleBulkApproveExpenses}
            onUpdateStatus={handleUpdateStatus}
            onEditExpense={handleEditExpense}
            onDeleteExpense={handleDeleteExpense}
            onSelectExpense={(exp) => setSelectedExpenseForDetail(exp)}
            onPrintReceipt={handlePrintReceipt}
            onOpenGoogleSheets={() => setGoogleSheetsModalOpen(true)}
            onClearAllExpenses={handleClearAllExpenses}
            onSaveBarangEkstra={handleSaveBarangEkstra}
            onDeleteBarangEkstra={handleDeleteBarangEkstra}
            onUpdateBarangEkstraStatus={handleUpdateBarangEkstraStatus}
          />
        )}

        {activeTab === 'rekap_dinas' && isAdmin && currentUser && (
          <DinasRekapView
            schoolInfo={schoolInfo}
            currentUser={currentUser}
            expenses={activeYearExpenses}
            onSelectExpense={(exp) => setSelectedExpenseForDetail(exp)}
            onPrintReceipt={handlePrintReceipt}
            onOpenGoogleSheets={() => setGoogleSheetsModalOpen(true)}
          />
        )}

        {(activeTab === 'dashboard' || (activeTab === 'admin' && !isAdmin)) && (
          <DashboardView
            schoolInfo={schoolInfo}
            expenses={activeYearExpenses}
            onSelectQuarter={(tw) => {
              setActiveQuarterFilter([tw]);
              setActiveTab('list');
            }}
            onNewExpenseWithQuarter={(tw) => handleOpenNewExpense(tw)}
            onViewExpenseDetail={(exp) => setSelectedExpenseForDetail(exp)}
            onNavigateToList={() => setActiveTab('list')}
          />
        )}

        {activeTab === 'list' && (
          <ExpenseListView
            expenses={activeYearExpenses}
            activeQuarterFilter={activeQuarterFilter}
            onQuarterFilterChange={setActiveQuarterFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onNewExpense={() => handleOpenNewExpense()}
            onSelectExpense={(exp) => setSelectedExpenseForDetail(exp)}
            onEditExpense={handleEditExpense}
            onDeleteExpense={handleDeleteExpense}
            onPrintReceipt={handlePrintReceipt}
            onOpenGoogleSheets={() => setGoogleSheetsModalOpen(true)}
            isAdmin={isAdmin}
            onApproveExpense={handleApproveExpense}
            onClearAllExpenses={handleClearAllExpenses}
          />
        )}

        {activeTab === 'form' && (
          <ExpenseFormView
            existingExpense={editingExpense}
            defaultQuarter={formDefaultQuarter}
            schoolInfo={schoolInfo}
            allExpenses={activeYearExpenses}
            onSave={handleSaveExpense}
            onCancel={() => {
              setEditingExpense(null);
              setActiveTab(isAdmin ? 'admin' : 'list');
            }}
          />
        )}

        {activeTab === 'cetak_laporan' && (
          <CetakLaporanView
            initialExpense={expenseForReceipt}
            allExpenses={activeYearExpenses}
            schoolInfo={schoolInfo}
            isAdmin={isAdmin}
            currentUser={currentUser}
            barangEkstraItems={barangEkstraItems}
            onBack={() => setActiveTab(isAdmin ? 'admin' : 'dashboard')}
          />
        )}

        {activeTab === 'barang_ekstra' && (
          <BarangEkstraView
            items={barangEkstraItems.filter(i => {
              const targetUpt = (currentUser?.schoolName || schoolInfo.namaSekolah || '').trim().toLowerCase();
              const itemUpt = (i.schoolName || '').trim().toLowerCase();
              if (!targetUpt) return true;
              return itemUpt === targetUpt || normalizeUptKey(i.schoolName || '') === normalizeUptKey(currentUser?.schoolName || schoolInfo.namaSekolah || '');
            })}
            schoolInfo={schoolInfo}
            isAdmin={isAdmin}
            onSaveItem={handleSaveBarangEkstra}
            onDeleteItem={handleDeleteBarangEkstra}
            onUpdateStatus={handleUpdateBarangEkstraStatus}
          />
        )}

        {(activeTab === 'receipt' || activeTab === 'stock_opname') && (
          <ReceiptPrintView
            key={activeTab}
            variant={activeTab === 'stock_opname' ? 'stock_opname' : 'rekon'}
            initialExpense={expenseForReceipt}
            allExpenses={activeYearExpenses}
            schoolInfo={schoolInfo}
            onBack={() => setActiveTab(isAdmin ? 'admin' : 'dashboard')}
          />
        )}

        {activeTab === 'settings' && (
          <SchoolSettingsView
            schoolInfo={schoolInfo}
            allExpenses={activeYearExpenses}
            onSave={updateSchoolInfo}
            onResetDemoData={handleResetDemoData}
            onClose={() => setActiveTab(isAdmin ? 'admin' : 'dashboard')}
          />
        )}
      </main>

      {/* Left Collapsible Sidebar Navigation */}
      <SidebarNav
        activeTab={activeTab === 'admin' && !isAdmin ? 'dashboard' : activeTab}
        onTabChange={(tab) => {
          if (tab === 'form' && activeTab !== 'form') {
            setEditingExpense(null);
          }
          if (tab === 'receipt' || tab === 'stock_opname') {
            setExpenseForReceipt(null);
          }
          setActiveTab(tab);
        }}
        expenseCount={activeYearExpenses.length}
        isAdmin={isAdmin}
        pendingApprovalCount={pendingApprovalCount}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Detail Modal */}
      {selectedExpenseForDetail && (
        <ExpenseDetailModal
          expense={selectedExpenseForDetail}
          onClose={() => setSelectedExpenseForDetail(null)}
          onEdit={(exp) => {
            setSelectedExpenseForDetail(null);
            handleEditExpense(exp);
          }}
          onDelete={(id) => {
            handleDeleteExpense(id);
            setSelectedExpenseForDetail(null);
          }}
          onPrint={(exp) => {
            setSelectedExpenseForDetail(null);
            handlePrintReceipt(exp);
          }}
          onUpdateStatus={handleUpdateStatus}
          isAdmin={isAdmin}
        />
      )}

      {/* Auth Modal (Menu Login UPT Sekolah) */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        accounts={accounts}
        schoolName={schoolInfo.namaSekolah}
        schoolYear={String(schoolInfo.tahunAnggaran)}
        onLoginSuccess={handleLoginSuccess}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Google Sheets & Drive Modal */}
      <GoogleSheetsModal
        isOpen={googleSheetsModalOpen}
        onClose={() => setGoogleSheetsModalOpen(false)}
        schoolInfo={schoolInfo}
        expenses={activeYearExpenses}
        onImportExpenses={handleImportExpenses}
        onSyncSuccessNotification={(msg) => showToast(msg, 'success')}
      />
    </div>
  );
}
