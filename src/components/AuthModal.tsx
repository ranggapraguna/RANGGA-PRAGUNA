import React, { useState, useEffect } from 'react';
import { 
  X, 
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
  Search
} from 'lucide-react';
import { UserRole, UserProfile, UserAccount } from '../types/auth';
import { authenticateUptSchool } from '../utils/auth';
import { 
  UptSchoolAccount, 
  loadUptSchools,
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

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  accounts: UserAccount[];
  schoolName: string;
  schoolYear?: string;
  onLoginSuccess: (user: UserProfile, schoolAccount?: UptSchoolAccount, loginYear?: string) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  schoolName,
  schoolYear = '2026',
  onLoginSuccess,
  onClose,
}) => {
  const [gasUrl] = useState<string>(getGasAuthUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCodeGuide, setShowCodeGuide] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [sheetPopulatedUsers, setSheetPopulatedUsers] = useState<Set<string>>(new Set());

  const [uptSchools, setUptSchools] = useState<UptSchoolAccount[]>(loadUptSchools);
  const [uptSearchQuery, setUptSearchQuery] = useState<string>('');
  const [selectedUpt, setSelectedUpt] = useState<string>(schoolName);
  const [selectedYear] = useState<string>(schoolYear);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isGasError, setIsGasError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const currentList = loadUptSchools();
      setUptSchools(currentList);
      const matched = currentList.find(
        (s) => normalizeUptKey(s.upt) === normalizeUptKey(schoolName)
      );
      setSelectedUpt(matched ? matched.upt : currentList[0]?.upt || '');
      setUptSearchQuery('');
      setLoginError('');
      setIsGasError(false);
      setShowCodeGuide(false);

      fetchUptListFromGoogleAppsScript(gasUrl).then((sheetRows) => {
        if (sheetRows.length > 0) {
          const populatedSet = new Set<string>();
          sheetRows.forEach((r) => {
            if (r.username && r.username.trim() && r.namaUpt) {
              populatedSet.add(normalizeUptKey(r.namaUpt));
            }
          });
          setSheetPopulatedUsers(populatedSet);

          const merged = mergeSheetSchoolsWithLocal(sheetRows, currentList);
          setUptSchools(merged);
          const mergedMatch = merged.find(
            (s) => normalizeUptKey(s.upt) === normalizeUptKey(schoolName)
          );
          if (mergedMatch) {
            setSelectedUpt(mergedMatch.upt);
          }
        }
      });
    }
  }, [isOpen, schoolName, gasUrl]);

  if (!isOpen) return null;

  const filteredUptSchools = filterUptSchools(uptSchools, uptSearchQuery);

  const handleUptSearchChange = (query: string) => {
    setUptSearchQuery(query);
    setLoginError('');
    const matches = filterUptSchools(uptSchools, query);
    if (matches.length > 0 && !matches.some((m) => m.upt === selectedUpt)) {
      setSelectedUpt(matches[0].upt);
    }
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
        onClose();
        return;
      }

      if (gasResult.error && gasResult.error.includes('terdaftar untuk UPT')) {
        setLoginError(gasResult.error);
        setIsSubmitting(false);
        return;
      }

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
        onClose();
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
          'Autentikasi gagal. Silakan periksa kembali UPT, username, dan kata sandi.'
      );
    } catch (err: any) {
      const uptResult = authenticateUptSchool(selectedUpt, cleanUser, loginPassword, uptSchools);
      if (uptResult.success && uptResult.user) {
        onLoginSuccess(
          {
            ...uptResult.user,
            role: uptResult.user.role,
          },
          uptResult.schoolAccount
        );
        onClose();
        return;
      }
      setLoginError(uptResult.error || `Koneksi gagal: ${err.message || 'Periksa jaringan'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-sm font-bold">
                Masuk Pengguna UPT BOSP
              </h2>
              <p className="text-[11px] text-slate-300">
                {selectedUpt || schoolName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="Tutup jendela login"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GAS Connection Status Bar */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-emerald-900 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-semibold shrink-0">Data UPT:</span>
            <span className="text-[11px] font-mono text-emerald-700 truncate">
              {uptSchools.length} Sekolah Spreadsheet
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowCodeGuide(!showCodeGuide)}
            className="text-emerald-700 font-bold hover:underline shrink-0 text-[11px] flex items-center gap-1"
          >
            <Code className="w-3 h-3" />
            <span>{showCodeGuide ? 'Tutup' : 'Script Baru (Kolom A-G)'}</span>
          </button>
        </div>

        {/* Collapsible Apps Script Code Drawer */}
        {showCodeGuide && (
          <div className="bg-slate-900 text-slate-100 p-3 border-b border-slate-800 text-xs space-y-2 animate-fadeIn max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Script Baru Google Spreadsheet (Kolom A-G):
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold flex items-center gap-1 shadow-xs"
              >
                {copiedCode ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>
            <pre className="bg-slate-950 p-2 rounded text-[10px] font-mono overflow-x-auto text-emerald-300 border border-slate-800">
              {GAS_CODE_TEMPLATE}
            </pre>
          </div>
        )}

        {/* Single Login Header Tab (Menu Buat Akun Removed) */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <div className="flex-1 py-3 text-center flex items-center justify-center gap-1.5 border-b-2 border-emerald-600 text-emerald-800 bg-white shadow-xs">
            <LogIn className="w-4 h-4" />
            <span>Menu Masuk (Login UPT Sekolah)</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6">
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-xs text-rose-800" role="alert">
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

            <div className="space-y-2">
              <label htmlFor="modal-upt-select" className="block text-xs font-semibold text-slate-700">
                Pilih UPT / Satuan Pendidikan (Kolom F) <span className="text-rose-500">*</span>
              </label>

              {/* Kolom Search UPT */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="modal-upt-search"
                  type="text"
                  aria-label="Cari UPT Sekolah"
                  value={uptSearchQuery}
                  onChange={(e) => handleUptSearchChange(e.target.value)}
                  placeholder="Cari nama UPT / Sekolah..."
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                />
                {uptSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setUptSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Bersihkan pencarian UPT"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="relative">
                <Building2 className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  id="modal-upt-select"
                  value={selectedUpt}
                  onChange={(e) => {
                    setSelectedUpt(e.target.value);
                    setLoginError('');
                  }}
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                >
                  <option value="">-- Pilih UPT Sekolah --</option>
                  {filteredUptSchools.map((s) => (
                    <option key={s.id} value={s.upt}>
                      {s.upt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username Sekolah (Kolom C)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Username sesuai spreadsheet"
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kata Sandi (Kolom D)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showLoginPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Kredensial UPT...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk ke {selectedUpt || 'Sistem BOSP'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
