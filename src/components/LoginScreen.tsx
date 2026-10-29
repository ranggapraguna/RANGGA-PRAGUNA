import React, { useState, useEffect, useRef } from 'react';
import { 
  LogIn, 
  Lock, 
  User, 
  Shield, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Code, 
  Copy, 
  CheckCircle2, 
  Loader2, 
  FileSpreadsheet,
  Building2,
  Upload,
  HelpCircle,
  Search,
  X,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { UserRole, UserProfile, UserAccount } from '../types/auth';
import { SchoolInfo } from '../types';
import { authenticateUptSchool } from '../utils/auth';
import { 
  LOGIN_YEARS,
  UptSchoolAccount, 
  loadUptSchools, 
  saveUptSchools, 
  parseSchoolSpreadsheetCsv,
  mergeSheetSchoolsWithLocal,
  normalizeUptKey,
  filterUptSchools
} from '../data/schoolData';
import { 
  loginWithGoogleAppsScript, 
  fetchUptListFromGoogleAppsScript,
  getGasAuthUrl, 
  GAS_CODE_TEMPLATE 
} from '../utils/gasAuth';

interface LoginScreenProps {
  accounts: UserAccount[];
  schoolInfo: SchoolInfo;
  onLoginSuccess: (user: UserProfile, schoolAccount?: UptSchoolAccount, loginYear?: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  schoolInfo,
  onLoginSuccess,
}) => {
  const [gasUrl] = useState<string>(getGasAuthUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCodeGuide, setShowCodeGuide] = useState(false);
  const [showSchoolCredentialsGuide, setShowSchoolCredentialsGuide] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [sheetConnected, setSheetConnected] = useState<boolean>(false);
  const [sheetPopulatedUsers, setSheetPopulatedUsers] = useState<Set<string>>(new Set());

  // Tahun Login (2025, 2026, 2027)
  const [selectedYear, setSelectedYear] = useState<string>(() =>
    LOGIN_YEARS.includes(String(schoolInfo.tahunAnggaran) as any)
      ? String(schoolInfo.tahunAnggaran)
      : LOGIN_YEARS[0]
  );

  // Data Sekolah (UPT) from uploaded spreadsheet & Google Spreadsheet Kolom F
  const [uptSchools, setUptSchools] = useState<UptSchoolAccount[]>(loadUptSchools);
  const [uptSearchQuery, setUptSearchQuery] = useState<string>('');
  const [showUptSuggestions, setShowUptSuggestions] = useState<boolean>(false);
  const [selectedUpt, setSelectedUpt] = useState<string>(() => {
    const initial = loadUptSchools();
    const matchCurrent = initial.find(
      (s) => normalizeUptKey(s.upt) === normalizeUptKey(schoolInfo.namaSekolah)
    );
    return matchCurrent ? matchCurrent.upt : initial[0]?.upt || '';
  });
  const [uploadNotice, setUploadNotice] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uptDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (uptDropdownRef.current && !uptDropdownRef.current.contains(e.target as Node)) {
        setShowUptSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isGasError, setIsGasError] = useState(false);

  // Load /assets/aistudio/DATA_SEKOLAH_164c298e and merge any UPT from Google Spreadsheet Kolom F
  useEffect(() => {
    let isMounted = true;

    const initSchools = async () => {
      let baseSchools = loadUptSchools();
      const hasCustom = localStorage.getItem('bosp_upt_schools_spreadsheet_v1');
      if (!hasCustom) {
        try {
          const res = await fetch('/assets/aistudio/DATA_SEKOLAH_164c298e');
          if (res.ok) {
            const csvText = await res.text();
            if (csvText && csvText.trim()) {
              const parsed = parseSchoolSpreadsheetCsv(csvText);
              if (parsed.length > 0) {
                baseSchools = parsed;
                if (isMounted) setUptSchools(parsed);
              }
            }
          }
        } catch {
          // fallback to DEFAULT_UPT_SCHOOLS
        }
      }

      // Fetch live UPT list from connected Google Apps Script (Kolom F: NAMA UPT)
      const sheetRows = await fetchUptListFromGoogleAppsScript(gasUrl);
      if (isMounted && sheetRows.length > 0) {
        setSheetConnected(true);
        const populatedSet = new Set<string>();
        sheetRows.forEach((r) => {
          if (r.username && r.username.trim() && r.namaUpt) {
            populatedSet.add(normalizeUptKey(r.namaUpt));
          }
        });
        setSheetPopulatedUsers(populatedSet);

        const merged = mergeSheetSchoolsWithLocal(sheetRows, baseSchools);
        setUptSchools(merged);
        setSelectedUpt((prevUpt) => {
          const match = merged.find(
            (s) => normalizeUptKey(s.upt) === normalizeUptKey(prevUpt || schoolInfo.namaSekolah)
          );
          return match ? match.upt : merged[0]?.upt || prevUpt;
        });
      }
    };

    initSchools();
    return () => {
      isMounted = false;
    };
  }, [gasUrl, schoolInfo.namaSekolah]);

  const filteredUptSchools = filterUptSchools(uptSchools, uptSearchQuery);

  const handleUptChange = (newUpt: string) => {
    setSelectedUpt(newUpt);
    setLoginError('');
    setShowUptSuggestions(false);
  };

  const handleUptSearchChange = (query: string) => {
    setUptSearchQuery(query);
    setShowUptSuggestions(true);
    setLoginError('');
    const matches = filterUptSchools(uptSchools, query);
    if (matches.length > 0 && !matches.some((m) => m.upt === selectedUpt)) {
      setSelectedUpt(matches[0].upt);
    }
  };

  const handleUploadSchoolCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const parsed = parseSchoolSpreadsheetCsv(content);
      if (parsed.length > 0) {
        setUptSchools(parsed);
        saveUptSchools(parsed);
        setSelectedUpt(parsed[0].upt);
        setUptSearchQuery('');
        setLoginError('');
        setUploadNotice(`Berhasil memuat ${parsed.length} UPT Sekolah dari file "${file.name}".`);
        setTimeout(() => setUploadNotice(''), 5000);
      } else {
        setLoginError('Format file spreadsheet tidak valid atau tidak ditemukan kolom UPT / Username.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GAS_CODE_TEMPLATE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsGasError(false);

    if (!selectedUpt.trim()) {
      setLoginError('Silakan pilih UPT / Satuan Pendidikan terlebih dahulu.');
      return;
    }

    const cleanUser = loginUsername.trim();
    if (!cleanUser || !loginPassword) {
      setLoginError('Username dan kata sandi wajib diisi sesuai UPT sekolah.');
      return;
    }

    const matchedLocalSchool = uptSchools.find(
      (s) => normalizeUptKey(s.upt) === normalizeUptKey(selectedUpt)
    );

    // 1. Primary Authentication via Connected Google Apps Script Web App (Kolom A-G)
    setIsSubmitting(true);
    try {
      const gasResult = await loginWithGoogleAppsScript(
        cleanUser,
        loginPassword,
        gasUrl,
        selectedUpt
      );

      if (gasResult.success && gasResult.user) {
        setIsSubmitting(false);
        const finalRole: UserRole =
          gasResult.user.role === 'Admin' || matchedLocalSchool?.role === 'Admin'
            ? 'Admin'
            : 'Operator BOSP';
        onLoginSuccess(
          {
            ...gasResult.user,
            schoolName: matchedLocalSchool?.upt || selectedUpt,
            role: finalRole,
          },
          matchedLocalSchool,
          selectedYear
        );
        return;
      }

      // If Google Spreadsheet explicitly reports a UPT mismatch, stop and show it
      if (gasResult.error && gasResult.error.includes('terdaftar untuk UPT')) {
        setLoginError(gasResult.error);
        setIsSubmitting(false);
        return;
      }

      // 2. Fallback to local UPT Spreadsheet credentials (from DATA_SEKOLAH CSV) if matching selectedUpt
      const uptResult = authenticateUptSchool(selectedUpt, cleanUser, loginPassword, uptSchools);
      if (uptResult.success && uptResult.user) {
        setIsSubmitting(false);
        onLoginSuccess(
          {
            ...uptResult.user,
            role: uptResult.user.role,
          },
          uptResult.schoolAccount,
          selectedYear
        );
        return;
      }

      if (gasResult.isGasScriptError) {
        setIsGasError(true);
        setLoginError(
          gasResult.error || 'Terjadi kesalahan pada Google Apps Script.'
        );
        setIsSubmitting(false);
        return;
      }

      setLoginError(
        gasResult.error ||
          'Username, Password, atau Pilihan UPT tidak cocok di Google Spreadsheet.'
      );
    } catch {
      // Offline fallback to local UPT spreadsheet data
      const uptResult = authenticateUptSchool(selectedUpt, cleanUser, loginPassword, uptSchools);
      if (uptResult.success && uptResult.user) {
        onLoginSuccess(
          {
            ...uptResult.user,
            role: uptResult.user.role,
          },
          uptResult.schoolAccount,
          selectedYear
        );
        return;
      }
      setLoginError(
        uptResult.error ||
          'Username atau kata sandi tidak sesuai dengan UPT sekolah di Spreadsheet.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSchoolObj = uptSchools.find((s) => s.upt === selectedUpt);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-emerald-900/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-sm sm:text-base tracking-tight">
                  PEMERINTAH KABUPATEN MINAHASA TENGGARA
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  TA {selectedYear}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Sistem Penginputan Belanja & Persediaan Sekolah (UPT) BOSP Per Triwulan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Autentikasi UPT Spreadsheet</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Login Card Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 max-w-lg w-full overflow-hidden">
          {/* Card Top Title Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 text-white text-center relative">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Portal Masuk UPT Sekolah BOSP
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
              Pilih UPT Satuan Pendidikan dan masukkan Username serta Kata Sandi sesuai Data Sekolah pada Spreadsheet.
            </p>
          </div>

          {/* Connected Spreadsheet Info Strip */}
          <div className="bg-emerald-50/90 border-b border-emerald-200 px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-950 truncate" title={gasUrl}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-bold shrink-0">
                {sheetConnected ? 'Terhubung Google Sheet:' : 'Database UPT:'}
              </span>
              <span className="font-mono text-[11px] text-emerald-800 truncate">
                {uptSchools.length} Data UPT (AKfycbxn2Boq...UV__w)
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSchoolCredentialsGuide(!showSchoolCredentialsGuide)}
                className="text-emerald-800 font-bold hover:underline flex items-center gap-1 text-[11px]"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showSchoolCredentialsGuide ? 'Tutup Data UPT' : 'Data UPT'}</span>
              </button>
              <span className="text-emerald-300">|</span>
              <button
                type="button"
                onClick={() => setShowCodeGuide(!showCodeGuide)}
                className="text-emerald-700 font-bold hover:underline flex items-center gap-1 text-[11px]"
              >
                <Code className="w-3.5 h-3.5" />
                <span>{showCodeGuide ? 'Tutup Script' : 'Script Baru (Kolom A-G)'}</span>
              </button>
            </div>
          </div>

          {/* Collapsible UPT Spreadsheet Reference Drawer */}
          {showSchoolCredentialsGuide && (
            <div className="bg-slate-900 text-slate-100 p-4 border-b border-slate-800 text-xs space-y-2.5 animate-fadeIn max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  Daftar Akun UPT Sekolah (Spreadsheet Data Sekolah):
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 shadow-xs shrink-0"
                >
                  <Upload className="w-3 h-3" />
                  <span>Impor CSV Sekolah</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Klik salah satu baris UPT di bawah ini untuk memilih UPT secara cepat, atau unggah file CSV Spreadsheet Data Sekolah terbaru.
              </p>
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="py-1.5 px-2">UPT Sekolah (Kolom F)</th>
                      <th className="py-1.5 px-2">Username (Kolom C)</th>
                      <th className="py-1.5 px-2">Password (Kolom D)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    {uptSchools.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => {
                          setSelectedUpt(s.upt);
                          setLoginUsername(s.username);
                          setLoginPassword(s.password);
                          setLoginError('');
                        }}
                        className="hover:bg-emerald-950/60 cursor-pointer transition-colors"
                        title="Klik untuk mengisi UPT & kredensial ini"
                      >
                        <td className="py-1.5 px-2 font-semibold text-white">{s.upt}</td>
                        <td className="py-1.5 px-2 font-mono text-emerald-300">{s.username}</td>
                        <td className="py-1.5 px-2 font-mono text-amber-300">{s.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Collapsible Apps Script Code Drawer */}
          {showCodeGuide && (
            <div className="bg-slate-900 text-slate-100 p-4 border-b border-slate-800 text-xs space-y-2.5 animate-fadeIn max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <FileSpreadsheet className="w-4 h-4" />
                  Script Baru Google Spreadsheet (Kolom A s/d G):
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 shadow-xs"
                >
                  {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Tersalin!' : 'Salin Script Baru'}</span>
                </button>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-300 space-y-1">
                <p className="font-bold text-amber-300">Susunan Kolom Google Spreadsheet (Sheet &quot;Users&quot;):</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 font-mono text-[10px]">
                  <span>Kolom A: ID</span>
                  <span>Kolom B: Nama</span>
                  <span>Kolom C: Username</span>
                  <span>Kolom D: Password</span>
                  <span>Kolom E: Role</span>
                  <span className="text-emerald-400 font-bold">Kolom F: NAMA UPT</span>
                  <span>Kolom G: Waktu_Dibuat</span>
                </div>
              </div>
              <pre className="bg-slate-950 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto text-emerald-300 border border-slate-800">
                {GAS_CODE_TEMPLATE}
              </pre>
            </div>
          )}

          {/* Single Login Header Bar (Menu Buat Akun Removed as requested) */}
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
            <div className="flex-1 py-3.5 text-center flex items-center justify-center gap-2 border-b-2 border-emerald-600 text-emerald-800 bg-white shadow-xs">
              <LogIn className="w-4 h-4" />
              <span>Menu Masuk (Login UPT Sekolah)</span>
            </div>
          </div>

          {/* Card Body - LOGIN FORM */}
          <div className="p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleUploadSchoolCsv}
              className="hidden"
            />

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {uploadNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{uploadNotice}</span>
                </div>
              )}

              {loginError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-xs text-rose-900" role="alert">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>

                  {isGasError && (
                    <div className="pt-2 border-t border-rose-200/80 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCodeGuide(true)}
                        className="text-[11px] font-bold text-emerald-800 underline flex items-center gap-1"
                      >
                        <Code className="w-3 h-3" />
                        <span>Lihat Solusi Script</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* PILIHAN TAHUN LOGIN / TAHUN ANGGARAN (2025, 2026, 2027) */}
              <div>
                <label htmlFor="login-year-select" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tahun Login / Tahun Anggaran <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="login-year-select"
                    aria-label="Pilih Tahun Login"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-8 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-75 transition-all"
                  >
                    {LOGIN_YEARS.map((year) => (
                      <option key={year} value={year}>
                        Tahun Anggaran {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PILIHAN UPT SEKOLAH & SEARCH DIJADIKAN 1 TOMBOL / DROPDOWN */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-upt-button" className="block text-xs font-bold text-slate-700">
                    Pilih UPT / Satuan Pendidikan (Kolom F) <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 hover:underline"
                    title="Unggah file CSV Data Sekolah untuk memperbarui daftar UPT"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload CSV Sekolah</span>
                  </button>
                </div>

                {/* Unified UPT Search & Select 1 Button Component */}
                <div className="relative" ref={uptDropdownRef}>
                  <button
                    id="login-upt-button"
                    type="button"
                    onClick={() => setShowUptSuggestions(!showUptSuggestions)}
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 text-xs text-slate-900 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-75 transition-all text-left shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className={`truncate font-bold ${!selectedUpt ? 'text-slate-400 font-normal' : 'text-slate-900'}`}>
                        {selectedUpt || '-- Pilih UPT Sekolah --'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                      <Search className="w-3.5 h-3.5 text-emerald-600" />
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  {/* Dropdown Popup with built-in search */}
                  {showUptSuggestions && (
                    <div className="absolute z-40 left-0 right-0 mt-1.5 bg-white border border-emerald-300 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
                      <div className="p-2.5 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={uptSearchQuery}
                            onChange={(e) => setUptSearchQuery(e.target.value)}
                            placeholder="Ketik untuk mencari UPT / sekolah..."
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            autoFocus
                          />
                          {uptSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setUptSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {filteredUptSchools.length > 0 ? (
                          filteredUptSchools.map((school) => (
                            <button
                              key={school.id}
                              type="button"
                              onClick={() => {
                                handleUptChange(school.upt);
                                setShowUptSuggestions(false);
                                setUptSearchQuery('');
                              }}
                              className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-emerald-50 transition-colors ${
                                selectedUpt === school.upt
                                  ? 'bg-emerald-50 font-bold text-emerald-900'
                                  : 'text-slate-700'
                              }`}
                            >
                              <div className="truncate">
                                <span className="block truncate font-semibold">{school.upt}</span>
                                <span className="text-[10px] text-slate-400">{school.kecamatan}</span>
                              </div>
                              {selectedUpt === school.upt && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs text-slate-500 text-center">
                            Tidak ada UPT yang cocok dengan &quot;{uptSearchQuery}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {activeSchoolObj && (
                  <p className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                    <span>Kecamatan: <strong>{activeSchoolObj.kecamatan}</strong></span>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      {filteredUptSchools.length} UPT Tersedia
                    </span>
                  </p>
                )}
              </div>

              {/* USERNAME (Kolom C) */}
              <div>
                <label htmlFor="login-username-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Username (Kolom C Spreadsheet) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-username-input"
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder={activeSchoolObj ? `Contoh: ${activeSchoolObj.username}` : 'Masukkan username sekolah'}
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-75 transition-all"
                    autoFocus
                  />
                </div>
              </div>

              {/* PASSWORD (Kolom D) */}
              <div>
                <label htmlFor="login-password-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password / Kata Sandi (Kolom D Spreadsheet) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password-input"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan kata sandi sekolah"
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-75 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showLoginPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-700/20 transition-all active:scale-95 disabled:opacity-70 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi Kredensial UPT di Spreadsheet...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>
                      {selectedUpt
                        ? `Masuk ke ${selectedUpt}`
                        : 'Masuk ke Sistem BOSP'}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 py-4 px-4 text-center border-t border-slate-900 bg-slate-950/80 text-xs text-slate-500">
        <p>&copy; 2026 Dinas Pendidikan Kabupaten Minahasa Tenggara &bull; Sistem Persediaan & Belanja BOSP</p>
      </footer>
    </div>
  );
};
