import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Printer, ClipboardList, PackagePlus, RefreshCw, Building, Search, X, ChevronDown, FileText, FileSpreadsheet } from 'lucide-react';
import { SchoolExpense, SchoolInfo, BarangEkstraItem } from '../types';
import { UserProfile } from '../types/auth';
import { loadUptSchools, normalizeUptKey } from '../data/schoolData';
import { ReceiptPrintView, ReklasSubView } from './ReceiptPrintView';

interface CetakLaporanViewProps {
  initialExpense: SchoolExpense | null;
  allExpenses: SchoolExpense[];
  schoolInfo: SchoolInfo;
  onBack: () => void;
  defaultVariant?: 'rekon' | 'stock_opname' | 'barang_ekstra' | 'reklas_barang_ekstra' | 'kib_barang_ekstra';
  isAdmin?: boolean;
  currentUser?: UserProfile | null;
  barangEkstraItems?: BarangEkstraItem[];
}

const REKLAS_SUB_OPTIONS: { id: ReklasSubView; label: string }[] = [
  { id: 'ba_reklas', label: '1. BA Reklas Barang Ekstra' },
  { id: 'lampiran_1', label: '2. Lampiran 1' },
  { id: 'lampiran_2', label: '3. Lampiran 2' },
];

export const CetakLaporanView: React.FC<CetakLaporanViewProps> = ({
  initialExpense,
  allExpenses,
  schoolInfo,
  onBack,
  defaultVariant = 'rekon',
  isAdmin = false,
  currentUser = null,
  barangEkstraItems = [],
}) => {
  const [currentVariant, setCurrentVariant] = useState<'rekon' | 'stock_opname' | 'barang_ekstra' | 'reklas_barang_ekstra' | 'kib_barang_ekstra'>(defaultVariant);
  const [reklasSubView, setReklasSubView] = useState<ReklasSubView>('ba_reklas');
  const [isReklasMenuOpen, setIsReklasMenuOpen] = useState<boolean>(false);
  const reklasMenuRef = useRef<HTMLDivElement>(null);

  // UPT Filter State (Only for Admin users)
  const [selectedUpt, setSelectedUpt] = useState<string>(() => {
    if (initialExpense?.schoolName) return initialExpense.schoolName;
    if (!isAdmin && currentUser?.schoolName) return currentUser.schoolName;
    return 'Semua';
  });

  const [isUptModalOpen, setIsUptModalOpen] = useState<boolean>(false);
  const [uptSearchInput, setUptSearchInput] = useState<string>('');
  const uptContainerRef = useRef<HTMLDivElement>(null);
  const uptSearchFieldRef = useRef<HTMLInputElement>(null);

  // Master catalog of all UPTs in Kabupaten Minahasa Tenggara
  const masterSchools = useMemo(() => {
    return loadUptSchools();
  }, []);

  // Collect all available UPT names (from master catalog, expenses, and barang ekstra, including DINAS PENDIDIKAN)
  const availableUpts = useMemo(() => {
    const setUpt = new Set<string>(['DINAS PENDIDIKAN']);
    masterSchools.forEach((s) => {
      if (s.upt) setUpt.add(s.upt);
    });
    allExpenses.forEach((e) => {
      if (e.schoolName) setUpt.add(e.schoolName);
    });
    barangEkstraItems.forEach((b) => {
      if (b.schoolName) setUpt.add(b.schoolName);
    });
    return Array.from(setUpt).sort((a, b) => {
      if (a === 'DINAS PENDIDIKAN') return -1;
      if (b === 'DINAS PENDIDIKAN') return 1;
      return a.localeCompare(b);
    });
  }, [masterSchools, allExpenses, barangEkstraItems]);

  // Filtered UPT list for search modal
  const filteredUptOptions = useMemo(() => {
    if (!uptSearchInput.trim()) return availableUpts;
    const q = uptSearchInput.trim().toLowerCase();
    const normQ = normalizeUptKey(uptSearchInput).toLowerCase();
    return availableUpts.filter((u) => {
      const uLower = u.toLowerCase();
      const normULower = normalizeUptKey(u).toLowerCase();
      return uLower.includes(q) || normULower.includes(q) || (normQ && normULower.includes(normQ));
    });
  }, [availableUpts, uptSearchInput]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (uptContainerRef.current && !uptContainerRef.current.contains(event.target as Node)) {
        setIsUptModalOpen(false);
      }
      if (reklasMenuRef.current && !reklasMenuRef.current.contains(event.target as Node)) {
        setIsReklasMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeReklasOption = REKLAS_SUB_OPTIONS.find((o) => o.id === reklasSubView) || REKLAS_SUB_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Cetak Laporan Sub-Menu Selector Buttons & Admin UPT Filter */}
      <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-600" />
              <span>Pusat Cetak Laporan Resmi BOSP</span>
            </h2>
            <p className="text-xs text-slate-500">
              Pilih jenis Berita Acara resmi yang ingin ditampilkan dan dicetak.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-end">
            {/* UPT Filter with Search (KHUSUS PENGGUNA ADMIN) */}
            {isAdmin && (
              <div ref={uptContainerRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsUptModalOpen((prev) => !prev);
                    setTimeout(() => uptSearchFieldRef.current?.focus(), 80);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    selectedUpt !== 'Semua'
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                  }`}
                  title="Filter UPT Sekolah untuk Berita Acara"
                >
                  <Building className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-[150px] sm:max-w-[200px]">
                    {selectedUpt === 'Semua' ? 'Semua UPT' : selectedUpt}
                  </span>
                  <Search className="w-3 h-3 text-emerald-600 shrink-0" />
                </button>

                {isUptModalOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3 text-xs space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Pilih UPT Sekolah</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {filteredUptOptions.length} UPT
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        ref={uptSearchFieldRef}
                        value={uptSearchInput}
                        onChange={(e) => setUptSearchInput(e.target.value)}
                        placeholder="Ketik nama UPT sekolah..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      {uptSearchInput && (
                        <button
                          type="button"
                          onClick={() => setUptSearchInput('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUpt('Semua');
                          setIsUptModalOpen(false);
                          setUptSearchInput('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                          selectedUpt === 'Semua'
                            ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        Semua UPT (Kabupaten)
                      </button>
                      {filteredUptOptions.map((upt) => (
                        <button
                          key={upt}
                          type="button"
                          onClick={() => {
                            setSelectedUpt(upt);
                            setIsUptModalOpen(false);
                            setUptSearchInput('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer truncate ${
                            selectedUpt === upt
                              ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title={upt}
                        >
                          {upt}
                        </button>
                      ))}
                      {filteredUptOptions.length === 0 && (
                        <div className="py-4 text-center text-slate-400 text-xs italic">
                          UPT tidak ditemukan
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4 Report Selector Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setCurrentVariant('rekon');
                  setIsReklasMenuOpen(false);
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentVariant === 'rekon'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>1. Berita Acara Rekon Persediaan</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentVariant('stock_opname');
                  setIsReklasMenuOpen(false);
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentVariant === 'stock_opname'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>2. Berita Acara Stock Opname</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentVariant('barang_ekstra');
                  setIsReklasMenuOpen(false);
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentVariant === 'barang_ekstra'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>3. Berita Acara Barang Ekstra</span>
              </button>

              {/* Tombol 4: Berita Acara Reklas Barang Ekstra dengan 3 Pilihan Dropdown */}
              <div ref={reklasMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentVariant('reklas_barang_ekstra');
                    setIsReklasMenuOpen((prev) => !prev);
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentVariant === 'reklas_barang_ekstra'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>4. Berita Acara Reklas Barang Ekstra</span>
                  {currentVariant === 'reklas_barang_ekstra' && (
                    <span className="ml-0.5 px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-extrabold">
                      {activeReklasOption.label}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      isReklasMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isReklasMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 text-xs space-y-1 animate-fadeIn">
                    <div className="px-2.5 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Pilih Dokumen Reklas Barang Ekstra
                    </div>
                    {REKLAS_SUB_OPTIONS.map((opt) => {
                      const isActive =
                        currentVariant === 'reklas_barang_ekstra' && reklasSubView === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setCurrentVariant('reklas_barang_ekstra');
                            setReklasSubView(opt.id);
                            setIsReklasMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold transition-all cursor-pointer text-left ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'hover:bg-emerald-50 text-slate-700 hover:text-emerald-800'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span>{opt.label}</span>
                          </span>
                          {isActive && (
                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                              Aktif
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tombol 5: KIB Barang Ekstra */}
              <button
                type="button"
                onClick={() => {
                  setCurrentVariant('kib_barang_ekstra');
                  setIsReklasMenuOpen(false);
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentVariant === 'kib_barang_ekstra'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>5. KIB Barang Ekstra</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sub-pilihan langsung ketika Berita Acara Reklas Barang Ekstra aktif */}
        {currentVariant === 'reklas_barang_ekstra' && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pilihan Dokumen Berita Acara Reklas Barang Ekstra:</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {REKLAS_SUB_OPTIONS.map((opt) => {
                const active = reklasSubView === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReklasSubView(opt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-emerald-50/60 hover:bg-emerald-100/70 text-emerald-900 border-emerald-200'
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Render ReceiptPrintView with respective variant and selected UPT */}
      <ReceiptPrintView
        key={`${currentVariant}-${selectedUpt}`}
        variant={currentVariant}
        reklasSubView={reklasSubView}
        onReklasSubViewChange={setReklasSubView}
        initialExpense={initialExpense}
        allExpenses={allExpenses}
        schoolInfo={schoolInfo}
        onBack={onBack}
        isAdmin={isAdmin}
        currentUser={currentUser}
        barangEkstraItems={barangEkstraItems}
        selectedUpt={selectedUpt}
        onUptChange={setSelectedUpt}
      />
    </div>
  );
};
