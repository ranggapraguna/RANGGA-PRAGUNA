import React, { useState } from 'react';
import { 
  Save, 
  X, 
  Calculator, 
  Sparkles, 
  Check, 
  Calendar,
  FileText,
  Plus,
  Trash2,
  Printer
} from 'lucide-react';
import { 
  SchoolExpense, 
  Triwulan, 
  BOSSource, 
  KomponenBOS, 
  KodeRekening, 
  REKENING_PERSEDIAAN_OPTIONS,
  JenisSaldoAwal,
  TaxType, 
  PaymentMethod, 
  SchoolInfo,
  RincianRekeningItem
} from '../types';
import { 
  formatRupiah, 
  generateNextReceiptNumber
} from '../utils/budgetCalculations';

interface ExpenseFormViewProps {
  existingExpense?: SchoolExpense | null;
  defaultQuarter?: Triwulan;
  schoolInfo: SchoolInfo;
  allExpenses: SchoolExpense[];
  onSave: (expense: SchoolExpense) => void;
  onCancel: () => void;
}

const DEFAULT_KOMPONEN: KomponenBOS = '5. Administrasi Kegiatan Sekolah & ATK';

const REKENING_OPTIONS: readonly KodeRekening[] = REKENING_PERSEDIAAN_OPTIONS;

export const ExpenseFormView: React.FC<ExpenseFormViewProps> = ({
  existingExpense,
  defaultQuarter = 'TW1',
  schoolInfo,
  allExpenses,
  onSave,
  onCancel,
}) => {
  const [triwulan, setTriwulan] = useState<Triwulan>(existingExpense?.triwulan || defaultQuarter);
  const [sumberDana, setSumberDana] = useState<BOSSource>(existingExpense?.sumberDana || 'BOS Reguler');
  const [tanggal, setTanggal] = useState<string>(
    existingExpense?.tanggal || `${schoolInfo.tahunAnggaran}${new Date().toISOString().slice(4, 10)}`
  );
  const [noBukti, setNoBukti] = useState<string>(
    existingExpense?.noBukti || generateNextReceiptNumber(allExpenses, defaultQuarter, schoolInfo.tahunAnggaran)
  );
  const [kodeRekening, setKodeRekening] = useState<KodeRekening>(
    existingExpense?.kodeRekening && REKENING_OPTIONS.includes(existingExpense.kodeRekening)
      ? existingExpense.kodeRekening
      : 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor'
  );

  // State untuk Menu 4: 2 Combo Box Saldo Awal (Masuk & Keluar), Centang HIBAH, Nilai Masuk & Keluar Belanja
  const [saldoAwalMasuk, setSaldoAwalMasuk] = useState<JenisSaldoAwal>(
    existingExpense?.saldoAwalMasuk || existingExpense?.saldoAwal || 'Bukan Saldo Awal'
  );
  const [saldoAwalKeluar, setSaldoAwalKeluar] = useState<JenisSaldoAwal>(
    existingExpense?.saldoAwalKeluar || 'Bukan Saldo Awal'
  );
  const [isHibah, setIsHibah] = useState<boolean>(existingExpense?.isHibah || false);

  const [belanjaMasuk, setBelanjaMasuk] = useState<number>(0);
  const [belanjaKeluar, setBelanjaKeluar] = useState<number>(0);

  const normalizeRincianItem = (it: RincianRekeningItem): RincianRekeningItem => {
    const masukType: JenisSaldoAwal = it.saldoAwalMasuk || it.saldoAwal || 'Bukan Saldo Awal';
    const keluarType: JenisSaldoAwal = it.saldoAwalKeluar || 'Bukan Saldo Awal';
    const hibah = Boolean(it.isHibah);

    const nilaiSaldoAwal =
      it.nilaiSaldoAwal !== undefined
        ? it.nilaiSaldoAwal
        : !hibah && masukType === 'Saldo Awal'
        ? it.nilaiMasuk || 0
        : 0;
    const nilaiBelanjaLra =
      it.nilaiBelanjaLra !== undefined
        ? it.nilaiBelanjaLra
        : !hibah && masukType === 'Bukan Saldo Awal'
        ? it.nilaiMasuk || 0
        : 0;
    const pengeluaranSaldoAwal =
      it.pengeluaranSaldoAwal !== undefined
        ? it.pengeluaranSaldoAwal
        : !hibah && keluarType === 'Saldo Awal'
        ? it.nilaiKeluar || 0
        : 0;
    const pengeluaranBelanja =
      it.pengeluaranBelanja !== undefined
        ? it.pengeluaranBelanja
        : !hibah && keluarType === 'Bukan Saldo Awal'
        ? it.nilaiKeluar || 0
        : 0;
    const hibahMasuk =
      it.hibahMasuk !== undefined ? it.hibahMasuk : hibah ? it.nilaiMasuk || 0 : 0;
    const hibahKeluar =
      it.hibahKeluar !== undefined ? it.hibahKeluar : hibah ? it.nilaiKeluar || 0 : 0;

    const totalMasukItem = nilaiSaldoAwal + nilaiBelanjaLra + hibahMasuk;
    const totalKeluarItem = pengeluaranSaldoAwal + pengeluaranBelanja + hibahKeluar;

    return {
      ...it,
      saldoAwal: masukType,
      saldoAwalMasuk: masukType,
      saldoAwalKeluar: keluarType,
      isHibah: hibah,
      nilaiSaldoAwal,
      nilaiBelanjaLra,
      pengeluaranSaldoAwal,
      pengeluaranBelanja,
      hibahMasuk,
      hibahKeluar,
      nilaiMasuk: totalMasukItem,
      nilaiKeluar: totalKeluarItem,
      sisaNilai: totalMasukItem - totalKeluarItem,
    };
  };

  const mergeRincianItemIntoList = (
    list: RincianRekeningItem[],
    incomingRaw: RincianRekeningItem
  ): RincianRekeningItem[] => {
    const incoming = normalizeRincianItem(incomingRaw);
    const existingIndex = list.findIndex((item) => item.kodeRekening === incoming.kodeRekening);

    if (existingIndex === -1) {
      return [...list, incoming];
    }

    return list.map((item, idx) => {
      if (idx !== existingIndex) return item;

      const nilaiSaldoAwal = (item.nilaiSaldoAwal || 0) + (incoming.nilaiSaldoAwal || 0);
      const nilaiBelanjaLra = (item.nilaiBelanjaLra || 0) + (incoming.nilaiBelanjaLra || 0);
      const pengeluaranSaldoAwal =
        (item.pengeluaranSaldoAwal || 0) + (incoming.pengeluaranSaldoAwal || 0);
      const pengeluaranBelanja =
        (item.pengeluaranBelanja || 0) + (incoming.pengeluaranBelanja || 0);
      const hibahMasuk = (item.hibahMasuk || 0) + (incoming.hibahMasuk || 0);
      const hibahKeluar = (item.hibahKeluar || 0) + (incoming.hibahKeluar || 0);

      const totalMasukItem = nilaiSaldoAwal + nilaiBelanjaLra + hibahMasuk;
      const totalKeluarItem = pengeluaranSaldoAwal + pengeluaranBelanja + hibahKeluar;

      return {
        ...item,
        saldoAwal: incoming.saldoAwalMasuk || item.saldoAwal,
        saldoAwalMasuk: incoming.saldoAwalMasuk || item.saldoAwalMasuk,
        saldoAwalKeluar: incoming.saldoAwalKeluar || item.saldoAwalKeluar,
        isHibah: incoming.isHibah ?? item.isHibah,
        nilaiSaldoAwal,
        nilaiBelanjaLra,
        pengeluaranSaldoAwal,
        pengeluaranBelanja,
        hibahMasuk,
        hibahKeluar,
        nilaiMasuk: totalMasukItem,
        nilaiKeluar: totalKeluarItem,
        sisaNilai: totalMasukItem - totalKeluarItem,
      };
    });
  };

  const [rincianItems, setRincianItems] = useState<RincianRekeningItem[]>(
    existingExpense?.rincianItems && existingExpense.rincianItems.length > 0
      ? existingExpense.rincianItems.reduce<RincianRekeningItem[]>(
          (acc, it) => mergeRincianItemIntoList(acc, it),
          []
        )
      : existingExpense
      ? [
          normalizeRincianItem({
            id: `item-${Date.now()}`,
            kodeRekening: existingExpense.kodeRekening,
            saldoAwal: existingExpense.saldoAwal || 'Bukan Saldo Awal',
            saldoAwalMasuk: existingExpense.saldoAwalMasuk || existingExpense.saldoAwal || 'Bukan Saldo Awal',
            saldoAwalKeluar: existingExpense.saldoAwalKeluar || 'Bukan Saldo Awal',
            isHibah: existingExpense.isHibah || false,
            nilaiSaldoAwal: existingExpense.nilaiSaldoAwal,
            nilaiBelanjaLra: existingExpense.nilaiBelanjaLra,
            pengeluaranSaldoAwal: existingExpense.pengeluaranSaldoAwal,
            pengeluaranBelanja: existingExpense.pengeluaranBelanja,
            hibahMasuk: existingExpense.hibahMasuk,
            hibahKeluar: existingExpense.hibahKeluar,
            nilaiMasuk: existingExpense.nilaiMasuk ?? existingExpense.subtotal ?? 0,
            nilaiKeluar: existingExpense.nilaiKeluar ?? existingExpense.totalBersih ?? 0,
            sisaNilai: existingExpense.sisaNilai ?? 0,
          }),
        ]
      : []
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Totals for each column in the table
  const totalSaldoAwal = rincianItems.reduce((sum, item) => sum + (item.nilaiSaldoAwal || 0), 0);
  const totalBelanjaLra = rincianItems.reduce((sum, item) => sum + (item.nilaiBelanjaLra || 0), 0);
  const totalPengeluaranSaldoAwal = rincianItems.reduce(
    (sum, item) => sum + (item.pengeluaranSaldoAwal || 0),
    0
  );
  const totalPengeluaranBelanja = rincianItems.reduce(
    (sum, item) => sum + (item.pengeluaranBelanja || 0),
    0
  );
  const totalHibahMasuk = rincianItems.reduce((sum, item) => sum + (item.hibahMasuk || 0), 0);
  const totalHibahKeluar = rincianItems.reduce((sum, item) => sum + (item.hibahKeluar || 0), 0);
  const totalSisa =
    totalSaldoAwal +
    totalBelanjaLra +
    totalHibahMasuk -
    (totalPengeluaranSaldoAwal + totalPengeluaranBelanja + totalHibahKeluar);

  // Auto-generate receipt number internally if quarter changes
  const handleQuarterChange = (newQ: Triwulan) => {
    setTriwulan(newQ);
    if (!existingExpense) {
      setNoBukti(generateNextReceiptNumber(allExpenses, newQ, schoolInfo.tahunAnggaran));
    }
  };

  const buildNewRincianItem = (): RincianRekeningItem => {
    const masukNominal = belanjaMasuk || 0;
    const keluarNominal = belanjaKeluar || 0;

    const nilaiSaldoAwal = !isHibah && saldoAwalMasuk === 'Saldo Awal' ? masukNominal : 0;
    const nilaiBelanjaLra = !isHibah && saldoAwalMasuk === 'Bukan Saldo Awal' ? masukNominal : 0;
    const pengeluaranSaldoAwal = !isHibah && saldoAwalKeluar === 'Saldo Awal' ? keluarNominal : 0;
    const pengeluaranBelanja =
      !isHibah && saldoAwalKeluar === 'Bukan Saldo Awal' ? keluarNominal : 0;
    const hibahMasuk = isHibah ? masukNominal : 0;
    const hibahKeluar = isHibah ? keluarNominal : 0;

    const totalMasukItem = nilaiSaldoAwal + nilaiBelanjaLra + hibahMasuk;
    const totalKeluarItem = pengeluaranSaldoAwal + pengeluaranBelanja + hibahKeluar;

    return {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kodeRekening,
      saldoAwal: saldoAwalMasuk,
      saldoAwalMasuk,
      saldoAwalKeluar,
      isHibah,
      nilaiSaldoAwal,
      nilaiBelanjaLra,
      pengeluaranSaldoAwal,
      pengeluaranBelanja,
      hibahMasuk,
      hibahKeluar,
      nilaiMasuk: totalMasukItem,
      nilaiKeluar: totalKeluarItem,
      sisaNilai: totalMasukItem - totalKeluarItem,
    };
  };

  // Handler Tombol Tambah di Menu Nomor 4
  const handleAddRincianItem = () => {
    if (belanjaMasuk <= 0 && belanjaKeluar <= 0) {
      setErrors((prev) => ({
        ...prev,
        nilaiBelanja: 'Masukkan nominal Belanja Masuk atau Belanja Keluar terlebih dahulu',
      }));
      return;
    }

    const newItem = buildNewRincianItem();

    setRincianItems((prev) => mergeRincianItemIntoList(prev, newItem));
    setBelanjaMasuk(0);
    setBelanjaKeluar(0);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.nilaiBelanja;
      return next;
    });
  };

  const handleRemoveRincianItem = (id: string) => {
    setRincianItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Sample presets for quick testing with Rekening Belanja Persediaan
  const handleApplyPreset = (presetType: 'atk' | 'kertas' | 'listrik' | 'mamin') => {
    let selectedRekening: KodeRekening = 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor';
    let masuk = 0;
    let keluar = 0;
    let jenisMasuk: JenisSaldoAwal = 'Bukan Saldo Awal';
    let jenisKeluar: JenisSaldoAwal = 'Bukan Saldo Awal';
    let hibah = false;

    if (presetType === 'atk') {
      selectedRekening = 'Alat/Bahan untuk Kegiatan Kantor- Alat Tulis Kantor';
      masuk = 1000000;
      keluar = 660000;
      jenisMasuk = 'Bukan Saldo Awal';
      jenisKeluar = 'Bukan Saldo Awal';
    } else if (presetType === 'kertas') {
      selectedRekening = 'Alat/Bahan untuk Kegiatan Kantor- Kertas dan Cover';
      masuk = 2000000;
      keluar = 1500000;
      jenisMasuk = 'Saldo Awal';
      jenisKeluar = 'Saldo Awal';
    } else if (presetType === 'listrik') {
      selectedRekening = 'Alat/Bahan untuk Kegiatan Kantor- Alat Listrik';
      masuk = 1500000;
      keluar = 1250000;
      jenisMasuk = 'Bukan Saldo Awal';
      jenisKeluar = 'Bukan Saldo Awal';
    } else if (presetType === 'mamin') {
      selectedRekening = 'Makanan dan Minuman Rapat';
      masuk = 4000000;
      keluar = 3400000;
      jenisMasuk = 'Bukan Saldo Awal';
      jenisKeluar = 'Bukan Saldo Awal';
      hibah = false;
    }

    setKodeRekening(selectedRekening);
    setSaldoAwalMasuk(jenisMasuk);
    setSaldoAwalKeluar(jenisKeluar);
    setIsHibah(hibah);
    setBelanjaMasuk(masuk);
    setBelanjaKeluar(keluar);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!tanggal) newErrors.tanggal = 'Tanggal transaksi wajib diisi';

    // Jika ada input nominal yang belum diklik Tambah, otomatis gabungkan ke daftar
    let finalItems = [...rincianItems];
    if (belanjaMasuk > 0 || belanjaKeluar > 0) {
      finalItems = mergeRincianItemIntoList(finalItems, buildNewRincianItem());
      setRincianItems(finalItems);
      setBelanjaMasuk(0);
      setBelanjaKeluar(0);
    }

    if (finalItems.length === 0) {
      newErrors.nilaiBelanja =
        'Silakan isi Belanja Masuk / Belanja Keluar lalu klik tombol Tambah terlebih dahulu';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const finalSaldoAwal = finalItems.reduce((sum, item) => sum + (item.nilaiSaldoAwal || 0), 0);
    const finalBelanjaLra = finalItems.reduce((sum, item) => sum + (item.nilaiBelanjaLra || 0), 0);
    const finalPengeluaranSaldoAwal = finalItems.reduce(
      (sum, item) => sum + (item.pengeluaranSaldoAwal || 0),
      0
    );
    const finalPengeluaranBelanja = finalItems.reduce(
      (sum, item) => sum + (item.pengeluaranBelanja || 0),
      0
    );
    const finalHibahMasuk = finalItems.reduce((sum, item) => sum + (item.hibahMasuk || 0), 0);
    const finalHibahKeluar = finalItems.reduce((sum, item) => sum + (item.hibahKeluar || 0), 0);

    const finalMasuk = finalSaldoAwal + finalBelanjaLra + finalHibahMasuk;
    const finalKeluar = finalPengeluaranSaldoAwal + finalPengeluaranBelanja + finalHibahKeluar;
    const finalSisa = finalMasuk - finalKeluar;

    const primaryRekening = finalItems[0]?.kodeRekening || kodeRekening;
    const primarySaldoAwal = finalItems[0]?.saldoAwalMasuk || saldoAwalMasuk;
    const summaryUraian = finalItems
      .map((i) => `${i.kodeRekening}${i.isHibah ? ' (HIBAH)' : ` (${i.saldoAwalMasuk || i.saldoAwal})`}`)
      .join(', ');
    const nominalUtama = finalKeluar > 0 ? finalKeluar : finalMasuk;

    const newExpense: SchoolExpense = {
      id: existingExpense ? existingExpense.id : `exp-${Date.now()}`,
      tahunAnggaran: existingExpense?.tahunAnggaran || schoolInfo.tahunAnggaran,
      schoolName: existingExpense?.schoolName || schoolInfo.namaSekolah,
      npsn: existingExpense?.npsn || schoolInfo.npsn,
      noBukti:
        noBukti.trim() || generateNextReceiptNumber(allExpenses, triwulan, schoolInfo.tahunAnggaran),
      tanggal,
      triwulan,
      sumberDana,
      komponen: existingExpense?.komponen || DEFAULT_KOMPONEN,
      kodeRekening: primaryRekening,
      saldoAwal: primarySaldoAwal,
      saldoAwalMasuk: finalItems[0]?.saldoAwalMasuk || saldoAwalMasuk,
      saldoAwalKeluar: finalItems[0]?.saldoAwalKeluar || saldoAwalKeluar,
      isHibah: finalItems[0]?.isHibah || isHibah,
      uraian: existingExpense?.uraian || summaryUraian,
      penerimaToko: existingExpense?.penerimaToko || '-',
      npwpPenerima: existingExpense?.npwpPenerima,
      metodePembayaran: (existingExpense?.metodePembayaran || 'Kas Tunai Bendahara') as PaymentMethod,
      volume: 1,
      satuan: 'Paket',
      hargaSatuan: nominalUtama,
      subtotal: nominalUtama,
      nilaiSaldoAwal: finalSaldoAwal,
      nilaiBelanjaLra: finalBelanjaLra,
      pengeluaranSaldoAwal: finalPengeluaranSaldoAwal,
      pengeluaranBelanja: finalPengeluaranBelanja,
      hibahMasuk: finalHibahMasuk,
      hibahKeluar: finalHibahKeluar,
      nilaiMasuk: finalMasuk,
      nilaiKeluar: finalKeluar,
      sisaNilai: finalSisa,
      rincianItems: finalItems,
      tipePajak: (existingExpense?.tipePajak || 'Tanpa Pajak') as TaxType,
      nilaiPajak: 0,
      totalBersih: nominalUtama,
      status: existingExpense?.status || 'Menunggu Verifikasi',
      buktiFotoUrl: existingExpense?.buktiFotoUrl,
      catatan: existingExpense?.catatan,
      createdAt: existingExpense ? existingExpense.createdAt : new Date().toISOString(),
    };

    onSave(newExpense);
  };

  const formatCellNominal = (val?: number) => {
    if (!val || val === 0) return '';
    return formatRupiah(val);
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Form Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 sm:p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {existingExpense ? 'EDIT DATA BELANJA' : 'FORM INPUT BELANJA BARU'}
              </span>
              <span className="text-xs text-slate-400 font-mono">AppSheet View</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold mt-1 text-white">
              {existingExpense ? 'Ubah Data Transaksi Belanja' : 'Penginputan Belanja Persediaan'}
            </h2>
            <p className="text-xs text-slate-300">
              {schoolInfo.namaSekolah} • Tahun Anggaran {schoolInfo.tahunAnggaran}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-all"
            aria-label="Tutup form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Sample Presets bar for fast testing */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 p-3 sm:px-6 flex items-center justify-between gap-2 overflow-x-auto">
          <span className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Contoh Cepat Persediaan:
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleApplyPreset('atk')}
              className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
            >
              Alat Tulis Kantor (ATK)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('kertas')}
              className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
            >
              Kertas & Cover (Saldo Awal)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('listrik')}
              className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
            >
              Alat Listrik
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('mamin')}
              className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 font-medium rounded border border-emerald-200 transition-all shadow-xs"
            >
              Makanan & Minuman Rapat
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* Section 1: Triwulan & Sumber Dana (Tanpa No Bukti Kuitansi) */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              1. Periode Triwulan & Sumber Dana
            </h3>

            {/* Triwulan Radio Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pilih Triwulan Belanja <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['TW1', 'TW2', 'TW3', 'TW4'] as Triwulan[]).map((q) => {
                  const isSelected = triwulan === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleQuarterChange(q)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-extrabold ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>
                          {q}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {q === 'TW1' && 'Jan - Mar'}
                        {q === 'TW2' && 'Apr - Jun'}
                        {q === 'TW3' && 'Jul - Sep'}
                        {q === 'TW4' && 'Okt - Des'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sumber Dana & Tanggal Transaksi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sumber Dana <span className="text-rose-500">*</span>
                </label>
                <select
                  value={sumberDana}
                  onChange={(e) => setSumberDana(e.target.value as BOSSource)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="BOS Reguler">BOS Reguler</option>
                  <option value="BOS Kinerja">BOS Kinerja</option>
                  <option value="BOS Daerah (BOSDA)">BOS Daerah (BOSDA)</option>
                  <option value="BOP PAUD/Kesetaraan">BOP PAUD/Kesetaraan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Transaksi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className={`w-full bg-slate-50 border rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    errors.tanggal ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                  }`}
                />
                {errors.tanggal && <p className="text-[10px] text-rose-600 mt-0.5">{errors.tanggal}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Kode Rekening Belanja Persediaan */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              2. Kode Rekening Belanja
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kode Rekening Belanja Persediaan ({REKENING_OPTIONS.length} Rekening) <span className="text-rose-500">*</span>
              </label>
              <select
                value={kodeRekening}
                onChange={(e) => setKodeRekening(e.target.value as KodeRekening)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {REKENING_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 4: Nilai Masuk & Keluar Belanja */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-600" />
                4. Nilai Masuk & Keluar Belanja
              </h3>

              {/* Centang Box untuk HIBAH */}
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/80 cursor-pointer select-none hover:bg-amber-100/70 transition-colors">
                <input
                  type="checkbox"
                  checked={isHibah}
                  onChange={(e) => setIsHibah(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-extrabold text-amber-950 tracking-wide">
                  HIBAH
                </span>
              </label>
            </div>

            {/* 2 Pasang Input: (Combo Box Saldo Awal Masuk + Belanja Masuk) & (Combo Box Saldo Awal Keluar + Belanja Keluar) + Tombol Tambah */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              {/* Kelompok Belanja Masuk */}
              <div className="md:col-span-5 space-y-2.5 p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                    Belanja Masuk
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {isHibah
                      ? 'Masuk ke Kolom HIBAH (MASUK)'
                      : saldoAwalMasuk === 'Saldo Awal'
                      ? 'Masuk ke Kolom SALDO AWAL'
                      : 'Masuk ke Kolom BELANJA LRA'}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Kategori Saldo Awal (Belanja Masuk)
                  </label>
                  <select
                    value={saldoAwalMasuk}
                    onChange={(e) => setSaldoAwalMasuk(e.target.value as JenisSaldoAwal)}
                    disabled={isHibah}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  >
                    <option value="Saldo Awal">Saldo Awal</option>
                    <option value="Bukan Saldo Awal">Bukan Saldo Awal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nominal Belanja Masuk (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={belanjaMasuk || ''}
                    onChange={(e) => setBelanjaMasuk(parseFloat(e.target.value) || 0)}
                    placeholder="Masukkan nominal uang masuk"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Kelompok Belanja Keluar */}
              <div className="md:col-span-5 space-y-2.5 p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">
                    Belanja Keluar
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {isHibah
                      ? 'Masuk ke Kolom HIBAH (KELUAR)'
                      : saldoAwalKeluar === 'Saldo Awal'
                      ? 'Masuk ke PENGELUARAN (SALDO AWAL)'
                      : 'Masuk ke PENGELUARAN (BELANJA)'}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Kategori Saldo Awal (Belanja Keluar)
                  </label>
                  <select
                    value={saldoAwalKeluar}
                    onChange={(e) => setSaldoAwalKeluar(e.target.value as JenisSaldoAwal)}
                    disabled={isHibah}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  >
                    <option value="Saldo Awal">Saldo Awal</option>
                    <option value="Bukan Saldo Awal">Bukan Saldo Awal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nominal Belanja Keluar (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={belanjaKeluar || ''}
                    onChange={(e) => setBelanjaKeluar(parseFloat(e.target.value) || 0)}
                    placeholder="Masukkan nominal uang keluar"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Tombol Tambah */}
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleAddRincianItem}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>

            {errors.nilaiBelanja && (
              <p className="text-[11px] text-rose-600 font-medium">{errors.nilaiBelanja}</p>
            )}

            {/* Tabel Model Persediaan Sesuai Gambar Referensi */}
            <div className="mt-4 overflow-x-auto bg-white border border-slate-800 shadow-xs">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-white text-slate-900 font-serif text-[11px] font-bold uppercase tracking-tight">
                    <th
                      rowSpan={2}
                      className="border border-slate-800 py-3 px-3 text-center align-middle min-w-[240px]"
                    >
                      JENIS PERSEDIAAN
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-slate-800 py-3 px-2 text-center align-middle min-w-[120px] leading-tight"
                    >
                      SALDO AWAL
                      <br />
                      PER 1 JANUARI
                      <br />
                      2026
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-slate-800 py-3 px-2 text-center align-middle min-w-[110px]"
                    >
                      BELANJA LRA
                    </th>
                    <th
                      colSpan={2}
                      className="border border-slate-800 py-1.5 px-2 text-center align-middle"
                    >
                      PENGELUARAN
                    </th>
                    <th
                      colSpan={2}
                      className="border border-slate-800 py-1.5 px-2 text-center align-middle"
                    >
                      HIBAH
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-slate-800 py-3 px-2 text-center align-middle min-w-[100px] leading-tight"
                    >
                      SALDO
                      <br />
                      AKHIR
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-slate-800 py-3 px-2 text-center align-middle w-10"
                    >
                      AKSI
                    </th>
                  </tr>
                  <tr className="bg-white text-slate-900 font-serif text-[11px] font-bold uppercase tracking-tight">
                    <th className="border border-slate-800 py-2 px-2 text-center align-middle min-w-[95px] leading-tight">
                      SALDO
                      <br />
                      AWAL
                    </th>
                    <th className="border border-slate-800 py-2 px-2 text-center align-middle min-w-[110px]">
                      BELANJA
                    </th>
                    <th className="border border-slate-800 py-2 px-2 text-center align-middle min-w-[85px]">
                      MASUK
                    </th>
                    <th className="border border-slate-800 py-2 px-2 text-center align-middle min-w-[85px]">
                      KELUAR
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white text-slate-900">
                  {rincianItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="border border-slate-800 py-6 px-4 text-center text-slate-400 italic"
                      >
                        Belum ada rincian persediaan. Pilih Kode Rekening, atur kategori Saldo Awal / HIBAH, isi nominal Belanja Masuk atau Keluar, lalu klik tombol <strong>Tambah</strong>.
                      </td>
                    </tr>
                  ) : (
                    rincianItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="border border-slate-800 py-2 px-2.5 text-left font-normal text-slate-900">
                          {item.kodeRekening}
                        </td>
                        <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                          {formatCellNominal(item.nilaiSaldoAwal)}
                        </td>
                        <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                          {formatCellNominal(item.nilaiBelanjaLra)}
                        </td>
                        <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                          {formatCellNominal(item.pengeluaranSaldoAwal)}
                        </td>
                        <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                          {formatCellNominal(item.pengeluaranBelanja)}
                        </td>
                        <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                          {formatCellNominal(item.hibahMasuk)}
                        </td>
                        <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                          {formatCellNominal(item.hibahKeluar)}
                        </td>
                        <td className="border border-slate-800 py-2 px-2.5 text-right font-semibold whitespace-nowrap">
                          {item.sisaNilai && item.sisaNilai !== 0
                            ? formatRupiah(item.sisaNilai)
                            : '-'}
                        </td>
                        <td className="border border-slate-800 py-2 px-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRincianItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {rincianItems.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-900">
                      <td className="border border-slate-800 py-2 px-2.5 text-left uppercase text-[11px]">
                        JUMLAH TOTAL
                      </td>
                      <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                        {totalSaldoAwal > 0 ? formatRupiah(totalSaldoAwal) : '-'}
                      </td>
                      <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                        {totalBelanjaLra > 0 ? formatRupiah(totalBelanjaLra) : '-'}
                      </td>
                      <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                        {totalPengeluaranSaldoAwal > 0
                          ? formatRupiah(totalPengeluaranSaldoAwal)
                          : '-'}
                      </td>
                      <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                        {totalPengeluaranBelanja > 0
                          ? formatRupiah(totalPengeluaranBelanja)
                          : '-'}
                      </td>
                      <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                        {totalHibahMasuk > 0 ? formatRupiah(totalHibahMasuk) : '-'}
                      </td>
                      <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                        {totalHibahKeluar > 0 ? formatRupiah(totalHibahKeluar) : '-'}
                      </td>
                      <td className="border border-slate-800 py-2 px-2.5 text-right whitespace-nowrap">
                        {totalSisa !== 0 ? formatRupiah(totalSisa) : '-'}
                      </td>
                      <td className="border border-slate-800"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Tombol Cetak di Bawah Tabel */}
            <div className="mt-3 flex items-center justify-end print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak</span>
              </button>
            </div>
          </div>
        </div>

        {/* Form Footer Buttons */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 transition-all"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{existingExpense ? 'Simpan Perubahan' : 'Simpan Belanja (Save)'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
