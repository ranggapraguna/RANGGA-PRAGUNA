import React, { useState } from 'react';
import { 
  Building2, 
  Save, 
  X, 
  RotateCcw, 
  Download, 
  Check, 
  ShieldCheck
} from 'lucide-react';
import { SchoolInfo, SchoolExpense } from '../types';
import { exportExpensesToCSV } from '../utils/storage';

interface SchoolSettingsViewProps {
  schoolInfo: SchoolInfo;
  allExpenses: SchoolExpense[];
  onSave: (info: SchoolInfo) => void;
  onResetDemoData: () => void;
  onClose: () => void;
}

export const SchoolSettingsView: React.FC<SchoolSettingsViewProps> = ({
  schoolInfo,
  allExpenses,
  onSave,
  onResetDemoData,
  onClose,
}) => {
  const [formData, setFormData] = useState<SchoolInfo>({
    ...schoolInfo,
    bendaharaBarang: schoolInfo.bendaharaBarang ?? '',
    nipBendaharaBarang: schoolInfo.nipBendaharaBarang ?? '',
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Pengaturan Profil Sekolah & Pejabat Pengelola
              </h2>
              <p className="text-xs text-slate-300">
                Identitas satuan pendidikan, pejabat penandatangan kuitansi SPJ, dan Bendahara Pengurus Barang
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
            aria-label="Tutup pengaturan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Section 1: Data Lembaga Sekolah */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-600" />
              1. Identitas Lembaga & Sekolah
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Satuan Pendidikan</label>
                <input
                  type="text"
                  value={formData.namaSekolah}
                  onChange={(e) => setFormData({ ...formData, namaSekolah: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">NPSN</label>
                <input
                  type="text"
                  value={formData.npsn}
                  onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
                <input
                  type="text"
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kecamatan</label>
                <input
                  type="text"
                  value={formData.kecamatan}
                  onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kabupaten / Kota</label>
                <input
                  type="text"
                  value={formData.kabupaten}
                  onChange={(e) => setFormData({ ...formData, kabupaten: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Pejabat Penandatangan SPJ & Bendahara Pengurus Barang */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              2. Pejabat Pengelola Dana BOSP & Pengurus Barang
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Kepala Sekolah */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">Kepala Satuan Pendidikan</span>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Nama Lengkap & Gelar:</label>
                  <input
                    type="text"
                    value={formData.kepalaSekolah}
                    onChange={(e) => setFormData({ ...formData, kepalaSekolah: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">NIP Kepala Sekolah:</label>
                  <input
                    type="text"
                    value={formData.nipKepalaSekolah}
                    onChange={(e) => setFormData({ ...formData, nipKepalaSekolah: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Bendahara Sekolah */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">Bendahara Dana BOSP</span>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Nama Lengkap & Gelar:</label>
                  <input
                    type="text"
                    value={formData.bendahara}
                    onChange={(e) => setFormData({ ...formData, bendahara: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">NIP Bendahara:</label>
                  <input
                    type="text"
                    value={formData.nipBendahara}
                    onChange={(e) => setFormData({ ...formData, nipBendahara: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Bendahara Pengurus Barang */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">Bendahara Pengurus Barang</span>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Nama Lengkap & Gelar:</label>
                  <input
                    type="text"
                    value={formData.bendaharaBarang || ''}
                    onChange={(e) => setFormData({ ...formData, bendaharaBarang: e.target.value })}
                    placeholder="Nama Pengurus Barang"
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">NIP Bendahara Pengurus Barang:</label>
                  <input
                    type="text"
                    value={formData.nipBendaharaBarang || ''}
                    onChange={(e) => setFormData({ ...formData, nipBendaharaBarang: e.target.value })}
                    placeholder="NIP Pengurus Barang"
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Data Management & Export */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4 text-emerald-600" />
              3. Manajemen Data & Ekspor
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportExpensesToCSV(allExpenses)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Unduh Seluruh Data (CSV / Excel)</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-all ml-auto cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Bersihkan Semua Laporan Belanja</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 transition-all"
          >
            Tutup
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition-all active:scale-95"
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'Tersimpan!' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </form>

      {/* Modal Konfirmasi Bersihkan Semua Data */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-900">
                  Bersihkan Semua Laporan Belanja?
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini akan mengosongkan seluruh data transaksi belanja di aplikasi.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
              Apakah Anda yakin ingin menghapus seluruh data belanja? Data yang sudah dihapus tidak dapat dipulihkan kembali.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmResetOpen(false);
                  onResetDemoData();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ya, Bersihkan Semua</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
