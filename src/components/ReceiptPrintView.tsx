import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Printer,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Layers,
  Building,
  Search,
  X,
  Calendar,
} from 'lucide-react';
import {
  SchoolExpense,
  SchoolInfo,
  Triwulan,
  REKENING_PERSEDIAAN_OPTIONS,
  BarangEkstraItem,
} from '../types';
import { UserProfile } from '../types/auth';
import { loadBarangEkstraItems } from '../utils/storage';
import { loadUptSchools, normalizeUptKey } from '../data/schoolData';

const ALL_QUARTERS: {
  id: Triwulan;
  label: string;
  period: string;
  startLabel: string;
  startLabelStockOpname: string;
  endMonthIndex: number; // 0-indexed month (2=Mar, 5=Jun, 8=Sep, 11=Dec)
  endMonthName: string;
}[] = [
  {
    id: 'TW1',
    label: 'Triwulan 1 (TW1)',
    period: '1 Jan - 31 Mar',
    startLabel: '1 JANUARI',
    startLabelStockOpname: '01 JANUARI',
    endMonthIndex: 2,
    endMonthName: 'MARET',
  },
  {
    id: 'TW2',
    label: 'Triwulan 2 (TW2)',
    period: '1 Apr - 30 Jun',
    startLabel: '1 APRIL',
    startLabelStockOpname: '01 APRIL',
    endMonthIndex: 5,
    endMonthName: 'JUNI',
  },
  {
    id: 'TW3',
    label: 'Triwulan 3 (TW3)',
    period: '1 Jul - 30 Sep',
    startLabel: '1 JULI',
    startLabelStockOpname: '01 JULI',
    endMonthIndex: 8,
    endMonthName: 'SEPTEMBER',
  },
  {
    id: 'TW4',
    label: 'Triwulan 4 (TW4)',
    period: '1 Okt - 31 Des',
    startLabel: '1 OKTOBER',
    startLabelStockOpname: '01 OKTOBER',
    endMonthIndex: 11,
    endMonthName: 'DESEMBER',
  },
];

const computeCutOffDate = (quarters: Triwulan[], tahun: number): string => {
  const sorted = ALL_QUARTERS.filter((q) => quarters.includes(q.id));
  if (sorted.length === 0) return `31 Desember ${tahun}`;
  const lastQuarter = sorted[sorted.length - 1];
  const lastDay = new Date(tahun, lastQuarter.endMonthIndex + 1, 0).getDate();
  const monthCapitalized =
    lastQuarter.endMonthName.charAt(0) +
    lastQuarter.endMonthName.slice(1).toLowerCase();
  return `${lastDay} ${monthCapitalized} ${tahun}`;
};

const buildPeriodeTahunAnggaran = (
  quarters: Triwulan[],
  tahunAnggaran: number,
  variant: 'rekon' | 'stock_opname' | 'barang_ekstra' | 'reklas_barang_ekstra' | 'kib_barang_ekstra' = 'rekon'
): string => {
  const sorted = ALL_QUARTERS.filter((q) => quarters.includes(q.id));
  if (sorted.length === 0) {
    return `TAHUN ANGGARAN ${tahunAnggaran}`;
  }
  const firstQuarter = sorted[0];
  const lastQuarter = sorted[sorted.length - 1];
  const lastDayOfEndMonth = new Date(
    tahunAnggaran,
    lastQuarter.endMonthIndex + 1,
    0
  ).getDate();

  if (variant === 'barang_ekstra' || variant === 'reklas_barang_ekstra' || variant === 'kib_barang_ekstra') {
    if (sorted.length === 1 || sorted.length === ALL_QUARTERS.length) {
      return `PER ${lastDayOfEndMonth} ${lastQuarter.endMonthName} ${tahunAnggaran}`;
    }
    return `PER ${firstQuarter.startLabel} - ${lastDayOfEndMonth} ${lastQuarter.endMonthName} ${tahunAnggaran}`;
  }

  if (variant === 'stock_opname') {
    return `PER ${firstQuarter.startLabelStockOpname} - ${lastDayOfEndMonth} ${lastQuarter.endMonthName} ${tahunAnggaran}`;
  }

  return `TAHUN ANGGARAN PER ${firstQuarter.startLabel} - ${lastDayOfEndMonth} ${lastQuarter.endMonthName} ${tahunAnggaran}`;
};

export type ReklasSubView = 'ba_reklas' | 'lampiran_1' | 'lampiran_2';

const REKLAS_SUB_VIEW_OPTIONS: { id: ReklasSubView; label: string }[] = [
  { id: 'ba_reklas', label: '1. BA Reklas Barang Ekstra' },
  { id: 'lampiran_1', label: '2. Lampiran 1' },
  { id: 'lampiran_2', label: '3. Lampiran 2' },
];

interface ReceiptPrintViewProps {
  variant?: 'rekon' | 'stock_opname' | 'barang_ekstra' | 'reklas_barang_ekstra' | 'kib_barang_ekstra';
  reklasSubView?: ReklasSubView;
  onReklasSubViewChange?: (sub: ReklasSubView) => void;
  initialExpense: SchoolExpense | null;
  allExpenses: SchoolExpense[];
  schoolInfo: SchoolInfo;
  onBack: () => void;
  isAdmin?: boolean;
  currentUser?: UserProfile | null;
  barangEkstraItems?: BarangEkstraItem[];
  selectedUpt?: string;
  onUptChange?: (upt: string) => void;
}

interface StockOpnameRowCustom {
  satuan?: string;
  fisikBarang?: number;
  kondisiBarang?: string;
}

const formatNominalRekonsiliasi = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const NAMA_HARI_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const NAMA_BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const angkaKeKataId = (n: number): string => {
  const satuan = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];
  if (n < 12) return satuan[n];
  if (n < 20) return `${angkaKeKataId(n - 10)} Belas`;
  if (n < 100) return `${angkaKeKataId(Math.floor(n / 10))} Puluh ${satuan[n % 10]}`.trim();
  if (n < 200) return `Seratus ${angkaKeKataId(n - 100)}`.trim();
  if (n < 1000) return `${angkaKeKataId(Math.floor(n / 100))} Ratus ${angkaKeKataId(n % 100)}`.trim();
  if (n < 2000) return `Seribu ${angkaKeKataId(n - 1000)}`.trim();
  if (n < 1000000) return `${angkaKeKataId(Math.floor(n / 1000))} Ribu ${angkaKeKataId(n % 1000)}`.trim();
  return String(n);
};

export const parseReportDateComponents = (dateStr: string) => {
  if (!dateStr || !dateStr.includes('-')) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(monthIdx) || isNaN(day)) return null;
  const dateObj = new Date(year, monthIdx, day);
  const dayName = NAMA_HARI_ID[dateObj.getDay()] || 'Senin';
  const monthName = NAMA_BULAN_ID[monthIdx] || 'Januari';
  const dayPad = String(day).padStart(2, '0');
  const yearWords = angkaKeKataId(year);
  return {
    year,
    monthIdx,
    day,
    dayName,
    monthName,
    dayPad,
    yearWords,
    dateObj,
  };
};

export const formatOpeningParagraph = (
  dateStr: string,
  variant: 'rekon' | 'stock_opname' | 'barang_ekstra' | 'reklas_barang_ekstra' | 'kib_barang_ekstra' = 'rekon',
  isStockOpname: boolean = false
): string => {
  const parsed = parseReportDateComponents(dateStr);
  if (!parsed) {
    return 'Pada hari ini, kami yang bertanda tangan di bawah ini :';
  }
  const { dayName, dayPad, monthName, yearWords } = parsed;

  if (variant === 'reklas_barang_ekstra') {
    return `Pada hari ini ${dayName} Tanggal ${angkaKeKataId(parsed.day)} Bulan ${monthName} Tahun ${yearWords}, kami yang bertanda tangan di bawah ini`;
  }
  if (variant === 'barang_ekstra') {
    return `Pada hari ini ${dayName} tanggal ${dayPad} bulan ${monthName} tahun ${yearWords.toLowerCase()}, kami yang bertanda tangan di bawah ini :`;
  }
  if (isStockOpname) {
    return `Pada hari ini ${dayName} tanggal ${dayPad} bulan ${monthName} Tahun ${yearWords}, kami yang bertanda tangan di bawah ini`;
  }
  return `Pada hari ini ${dayName} tanggal ${dayPad} bulan ${monthName} tahun ${yearWords}, kami yang bertanda tangan di bawah ini :`;
};

export const ReceiptPrintView: React.FC<ReceiptPrintViewProps> = ({
  variant = 'rekon',
  reklasSubView,
  onReklasSubViewChange,
  initialExpense,
  allExpenses,
  schoolInfo,
  onBack,
  isAdmin = false,
  currentUser = null,
  barangEkstraItems,
  selectedUpt,
  onUptChange,
}) => {
  const isStockOpname = variant === 'stock_opname';

  // Sub-view state for Berita Acara Reklas Barang Ekstra (1. BA Reklas Barang Ekstra, 2. Lampiran 1, 3. Lampiran 2)
  const [internalReklasSubView, setInternalReklasSubView] = useState<ReklasSubView>(
    reklasSubView || 'ba_reklas'
  );
  const activeReklasSubView = reklasSubView !== undefined ? reklasSubView : internalReklasSubView;
  const handleSelectReklasSubView = (sub: ReklasSubView) => {
    setInternalReklasSubView(sub);
    if (onReklasSubViewChange) {
      onReklasSubViewChange(sub);
    }
  };
  const [isReklasSubDropdownOpen, setIsReklasSubDropdownOpen] = useState(false);
  const reklasSubDropdownRef = useRef<HTMLDivElement>(null);

  // Internal UPT state synced with selectedUpt prop
  const [internalUpt, setInternalUpt] = useState<string>(() => {
    if (selectedUpt) return selectedUpt;
    if (initialExpense?.schoolName) return initialExpense.schoolName;
    if (!isAdmin && currentUser?.schoolName) return currentUser.schoolName;
    return 'Semua';
  });

  const activeUpt = selectedUpt !== undefined ? selectedUpt : internalUpt;

  const handleSelectUpt = (upt: string) => {
    setInternalUpt(upt);
    if (onUptChange) {
      onUptChange(upt);
    }
  };

  const [isReceiptUptModalOpen, setIsReceiptUptModalOpen] = useState(false);
  const [receiptUptSearchInput, setReceiptUptSearchInput] = useState('');
  const receiptUptRef = useRef<HTMLDivElement>(null);
  const receiptUptInputRef = useRef<HTMLInputElement>(null);

  const masterSchools = useMemo(() => loadUptSchools(), []);

  const receiptAvailableUpts = useMemo(() => {
    const setUpt = new Set<string>(['DINAS PENDIDIKAN']);
    masterSchools.forEach((s) => {
      if (s.upt) setUpt.add(s.upt);
    });
    allExpenses.forEach((e) => {
      if (e.schoolName) setUpt.add(e.schoolName);
    });
    const items = barangEkstraItems && barangEkstraItems.length > 0 ? barangEkstraItems : loadBarangEkstraItems();
    items.forEach((b) => {
      if (b.schoolName) setUpt.add(b.schoolName);
    });
    return Array.from(setUpt).sort((a, b) => {
      if (a === 'DINAS PENDIDIKAN') return -1;
      if (b === 'DINAS PENDIDIKAN') return 1;
      return a.localeCompare(b);
    });
  }, [masterSchools, allExpenses, barangEkstraItems]);

  const receiptFilteredUptOptions = useMemo(() => {
    if (!receiptUptSearchInput.trim()) return receiptAvailableUpts;
    const q = receiptUptSearchInput.trim().toLowerCase();
    const normQ = normalizeUptKey(receiptUptSearchInput).toLowerCase();
    return receiptAvailableUpts.filter((u) => {
      const uLower = u.toLowerCase();
      const normULower = normalizeUptKey(u).toLowerCase();
      return uLower.includes(q) || normULower.includes(q) || (normQ && normULower.includes(normQ));
    });
  }, [receiptAvailableUpts, receiptUptSearchInput]);

  // Close UPT and Reklas sub-view dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (receiptUptRef.current && !receiptUptRef.current.contains(event.target as Node)) {
        setIsReceiptUptModalOpen(false);
      }
      if (reklasSubDropdownRef.current && !reklasSubDropdownRef.current.contains(event.target as Node)) {
        setIsReklasSubDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Multi-select checkable TW state: defaults to initialExpense's mergedQuarters or triwulan if opened from a specific item, else all TWs
  const [selectedQuarters, setSelectedQuarters] = useState<Triwulan[]>(() =>
    initialExpense?.mergedQuarters && initialExpense.mergedQuarters.length > 0
      ? initialExpense.mergedQuarters
      : initialExpense?.triwulan
      ? [initialExpense.triwulan]
      : ['TW1', 'TW2', 'TW3', 'TW4']
  );
  const [isComboOpen, setIsComboOpen] = useState<boolean>(false);
  const comboRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerDatePicker = () => {
    if (dateInputRef.current) {
      try {
        if ('showPicker' in HTMLInputElement.prototype) {
          dateInputRef.current.showPicker();
        } else {
          dateInputRef.current.focus();
        }
      } catch {
        dateInputRef.current?.focus();
      }
    }
  };

  const [showOnlyFilledRows, setShowOnlyFilledRows] = useState<boolean>(false);

  // Per-row optional overrides for Stock Opname table (Satuan, Fisik Barang Hasil, Kondisi Barang)
  const [stockOpnameCustomRows, setStockOpnameCustomRows] = useState<
    Record<string, StockOpnameRowCustom>
  >({});

  const tahunAnggaranBerjalan =
    Number(schoolInfo.tahunAnggaran) || new Date().getFullYear();

  // Sync selectedQuarters if initialExpense prop changes
  useEffect(() => {
    if (initialExpense?.mergedQuarters && initialExpense.mergedQuarters.length > 0) {
      setSelectedQuarters(initialExpense.mergedQuarters);
    } else if (initialExpense?.triwulan) {
      setSelectedQuarters([initialExpense.triwulan]);
    }
  }, [initialExpense]);

  // Close combo box dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (comboRef.current && !comboRef.current.contains(target)) {
        setIsComboOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleQuarter = (tw: Triwulan) => {
    setSelectedQuarters((prev) => {
      const exists = prev.includes(tw);
      const next = exists ? prev.filter((q) => q !== tw) : [...prev, tw];
      return ALL_QUARTERS.map((q) => q.id).filter((id) => next.includes(id));
    });
  };

  const toggleAllQuarters = () => {
    setSelectedQuarters((prev) =>
      prev.length === ALL_QUARTERS.length
        ? []
        : ALL_QUARTERS.map((q) => q.id)
    );
  };

  // Combo box button display label
  const comboButtonLabel = useMemo(() => {
    if (selectedQuarters.length === 0) {
      return 'Pilih Filter Triwulan...';
    }
    if (selectedQuarters.length === 1) {
      const found = ALL_QUARTERS.find((q) => q.id === selectedQuarters[0]);
      return `Filter: ${found ? found.label : selectedQuarters[0]}`;
    }
    if (selectedQuarters.length === ALL_QUARTERS.length) {
      return 'Semua Triwulan (TW1 - TW4)';
    }
    return `Gabungan: ${selectedQuarters.join(', ')}`;
  }, [selectedQuarters]);

  // Values derived directly from Profil Sekolah (schoolInfo)
  const defaultPemda =
    schoolInfo.kabupaten &&
    schoolInfo.kabupaten.trim().toLowerCase() !== 'kota bandung' &&
    schoolInfo.kabupaten.trim().toLowerCase() !== 'pemerintah kota bandung'
      ? schoolInfo.kabupaten.toUpperCase().startsWith('PEMERINTAH')
        ? schoolInfo.kabupaten.toUpperCase()
        : schoolInfo.kabupaten.toUpperCase().startsWith('KABUPATEN') ||
          schoolInfo.kabupaten.toUpperCase().startsWith('KOTA')
        ? `PEMERINTAH ${schoolInfo.kabupaten.toUpperCase()}`
        : `PEMERINTAH KABUPATEN ${schoolInfo.kabupaten.toUpperCase()}`
      : 'PEMERINTAH KABUPATEN MINAHASA TENGGARA';

  const defaultNamaSekolah = initialExpense?.schoolName
    ? initialExpense.schoolName.toUpperCase()
    : schoolInfo.namaSekolah
    ? schoolInfo.namaSekolah.toUpperCase()
    : 'SMP NEGERI 2 TOULUAAN';

  // Pengurus Barang mengikuti data Bendahara Barang di Profil Sekolah
  const defaultNamaPengurusBarang =
    schoolInfo.bendaharaBarang?.trim() || 'PRISILIA DEBORA MANGKANG, S.Pd';
  const defaultNipPengurusBarang =
    schoolInfo.nipBendaharaBarang?.trim() || '199304302020122013';

  // Kepala Sekolah mengikuti data Kepala Sekolah di Profil Sekolah
  const defaultNamaKepalaSekolah =
    schoolInfo.kepalaSekolah?.trim() || 'MEYGEVER ONSU,S.Pd.,M.Pd';
  const defaultNipKepalaSekolah =
    schoolInfo.nipKepalaSekolah?.trim() || '199205132019031006';

  // Editable Berita Acara metadata state
  const [pemerintahDaerah, setPemerintahDaerah] = useState(defaultPemda);
  const [dinasHeader, setDinasHeader] = useState('DINAS PENDIDIKAN');
  const [namaSekolahHeader, setNamaSekolahHeader] = useState(defaultNamaSekolah);
  const [periodeTahunAnggaran, setPeriodeTahunAnggaran] = useState(() =>
    buildPeriodeTahunAnggaran(
      initialExpense?.mergedQuarters && initialExpense.mergedQuarters.length > 0
        ? initialExpense.mergedQuarters
        : initialExpense?.triwulan
        ? [initialExpense.triwulan]
        : ['TW1', 'TW2', 'TW3', 'TW4'],
      tahunAnggaranBerjalan,
      variant
    )
  );
  const [cutOffDate, setCutOffDate] = useState(() =>
    computeCutOffDate(
      initialExpense?.mergedQuarters && initialExpense.mergedQuarters.length > 0
        ? initialExpense.mergedQuarters
        : initialExpense?.triwulan
        ? [initialExpense.triwulan]
        : ['TW1', 'TW2', 'TW3', 'TW4'],
      tahunAnggaranBerjalan
    )
  );

  // Tanggal laporan Berita Acara yang dipilih pengguna (mempengaruhi Hari, Tanggal, dan Tahun)
  const defaultReportDate = `${tahunAnggaranBerjalan}-10-01`;
  const [selectedReportDate, setSelectedReportDate] =
    useState<string>(defaultReportDate);
  const reportDateInfo = useMemo(
    () => parseReportDateComponents(selectedReportDate),
    [selectedReportDate]
  );

  const [labelSaldoAwalHeader, setLabelSaldoAwalHeader] = useState(
    `SALDO AWAL PER 1 JANUARI ${tahunAnggaranBerjalan}`
  );
  const [kalimatPembuka, setKalimatPembuka] = useState(() =>
    formatOpeningParagraph(defaultReportDate, variant, isStockOpname)
  );

  const handleReportDateChange = (newDateStr: string) => {
    if (!newDateStr) return;
    setSelectedReportDate(newDateStr);
    const newKalimat = formatOpeningParagraph(
      newDateStr,
      variant,
      isStockOpname
    );
    setKalimatPembuka(newKalimat);
  };

  // Sinkronisasi kalimat pembuka bila variant atau jenis dokumen berganti
  useEffect(() => {
    if (selectedReportDate) {
      setKalimatPembuka(
        formatOpeningParagraph(selectedReportDate, variant, isStockOpname)
      );
    }
  }, [variant, isStockOpname]);
  const isReklas = variant === 'reklas_barang_ekstra';
  const defaultNamaPengurusReklas = 'YOSEP TOMPUNU, A.Ma.TE';
  const defaultNipPengurusReklas = '19800512 201411 1 002';
  const defaultNamaPejabatPenatausahaanReklas = 'MELANI N.E. ANGGORONGGANG, S.Th';
  const defaultNipPejabatPenatausahaanReklas = '19821104 200902 2 001';
  const defaultNamaPejabatFooterReklas = 'MELANI N.E. ANGGORONGGANG, S.Th,M.Pd.K';
  const defaultNamaKadisReklas = 'SARAH I. KINDANGEN, S.Pd, M.Pd';
  const defaultNipKadisReklas = '19830923 200902 2 004';

  const [namaPihak1, setNamaPihak1] = useState(
    isReklas ? defaultNamaPengurusReklas : defaultNamaPengurusBarang
  );
  const [nipPihak1, setNipPihak1] = useState(
    isReklas ? defaultNipPengurusReklas : defaultNipPengurusBarang
  );
  const [jabatanPihak1, setJabatanPihak1] = useState(
    isReklas
      ? 'Pengurus Barang'
      : variant === 'barang_ekstra'
      ? 'Pengurus Barang'
      : isStockOpname
      ? 'Pengurus Barang Pembantu'
      : 'Pengurus Barang'
  );

  const [namaPihak2, setNamaPihak2] = useState(
    isReklas ? defaultNamaPejabatPenatausahaanReklas : defaultNamaKepalaSekolah
  );
  const [nipPihak2, setNipPihak2] = useState(
    isReklas ? defaultNipPejabatPenatausahaanReklas : defaultNipKepalaSekolah
  );
  const [jabatanPihak2, setJabatanPihak2] = useState(
    isReklas ? 'Pejabat Penatausahaan Barang' : 'Kepala Sekolah'
  );

  const [namaPengurusPembantuFooter, setNamaPengurusPembantuFooter] = useState(
    isReklas ? defaultNamaPejabatFooterReklas : defaultNamaPengurusBarang
  );
  const [nipPengurusPembantuFooter, setNipPengurusPembantuFooter] = useState(
    isReklas ? defaultNipPejabatPenatausahaanReklas : defaultNipPengurusBarang
  );

  const [namaPengurusBarangFooter, setNamaPengurusBarangFooter] = useState(
    isReklas ? defaultNamaPengurusReklas : defaultNamaPengurusBarang
  );
  const [nipPengurusBarangFooter, setNipPengurusBarangFooter] = useState(
    isReklas ? '198005122014111002' : defaultNipPengurusBarang
  );

  const [namaKepsekFooter, setNamaKepsekFooter] = useState(
    isReklas ? defaultNamaKadisReklas : defaultNamaKepalaSekolah
  );
  const [nipKepsekFooter, setNipKepsekFooter] = useState(
    isReklas ? defaultNipKadisReklas : defaultNipKepalaSekolah
  );

  // Sinkronisasi penandatangan resmi bila membuka varian Reklas Barang Ekstra
  useEffect(() => {
    if (variant === 'reklas_barang_ekstra') {
      setNamaPihak1(defaultNamaPengurusReklas);
      setNipPihak1(defaultNipPengurusReklas);
      setJabatanPihak1('Pengurus Barang');
      setNamaPihak2(defaultNamaPejabatPenatausahaanReklas);
      setNipPihak2(defaultNipPejabatPenatausahaanReklas);
      setJabatanPihak2('Pejabat Penatausahaan Barang');
      setNamaPengurusBarangFooter(defaultNamaPengurusReklas);
      setNipPengurusBarangFooter('198005122014111002');
      setNamaPengurusPembantuFooter(defaultNamaPejabatFooterReklas);
      setNipPengurusPembantuFooter(defaultNipPejabatPenatausahaanReklas);
      setNamaKepsekFooter(defaultNamaKadisReklas);
      setNipKepsekFooter(defaultNipKadisReklas);
    }
  }, [variant]);

  // Sync automatically whenever selectedQuarters or tahunAnggaranBerjalan changes
  useEffect(() => {
    setPeriodeTahunAnggaran(
      buildPeriodeTahunAnggaran(
        selectedQuarters,
        tahunAnggaranBerjalan,
        variant
      )
    );
    setLabelSaldoAwalHeader(`SALDO AWAL PER 1 JANUARI ${tahunAnggaranBerjalan}`);
    setCutOffDate(computeCutOffDate(selectedQuarters, tahunAnggaranBerjalan));
  }, [selectedQuarters, tahunAnggaranBerjalan, variant]);

  // Sync automatically whenever activeUpt changes to set appropriate principal & inventory keeper
  useEffect(() => {
    if (variant === 'reklas_barang_ekstra') return;
    if (activeUpt && activeUpt !== 'Semua') {
      const targetSchool = masterSchools.find(
        (s) =>
          s.upt.toLowerCase() === activeUpt.toLowerCase() ||
          normalizeUptKey(s.upt) === normalizeUptKey(activeUpt)
      );
      if (targetSchool) {
        setNamaSekolahHeader(targetSchool.upt);
        if (targetSchool.pengurusBarang) {
          setNamaPihak1(targetSchool.pengurusBarang);
          setNamaPengurusPembantuFooter(targetSchool.pengurusBarang);
          setNamaPengurusBarangFooter(targetSchool.pengurusBarang);
        }
        if (targetSchool.nipPengurusBarang) {
          setNipPihak1(targetSchool.nipPengurusBarang);
          setNipPengurusPembantuFooter(targetSchool.nipPengurusBarang);
          setNipPengurusBarangFooter(targetSchool.nipPengurusBarang);
        }
        if (targetSchool.kepalaSekolah) {
          setNamaPihak2(targetSchool.kepalaSekolah);
          setNamaKepsekFooter(targetSchool.kepalaSekolah);
        }
        if (targetSchool.nipKepalaSekolah) {
          setNipPihak2(targetSchool.nipKepalaSekolah);
          setNipKepsekFooter(targetSchool.nipKepalaSekolah);
        }
      } else {
        setNamaSekolahHeader(activeUpt);
      }
    } else if (activeUpt === 'Semua') {
      setNamaSekolahHeader(defaultNamaSekolah);
      setNamaPihak1(defaultNamaPengurusBarang);
      setNipPihak1(defaultNipPengurusBarang);
      setNamaPihak2(defaultNamaKepalaSekolah);
      setNipPihak2(defaultNipKepalaSekolah);
      setNamaPengurusPembantuFooter(defaultNamaPengurusBarang);
      setNipPengurusPembantuFooter(defaultNipPengurusBarang);
      setNamaKepsekFooter(defaultNamaKepalaSekolah);
      setNipKepsekFooter(defaultNipKepalaSekolah);
    }
  }, [
    activeUpt,
    variant,
    masterSchools,
    defaultNamaSekolah,
    defaultNamaPengurusBarang,
    defaultNipPengurusBarang,
    defaultNamaKepalaSekolah,
    defaultNipKepalaSekolah,
  ]);

  // Filter expenses based on checked Triwulan (selectedQuarters) and active UPT school
  const filteredExpenses = useMemo(() => {
    if (selectedQuarters.length === 0) return [];
    return allExpenses.filter((e) => {
      if (!selectedQuarters.includes(e.triwulan)) return false;
      if (activeUpt && activeUpt !== 'Semua') {
        const itemUpt = (e.schoolName || schoolInfo.namaSekolah || '').trim();
        return (
          itemUpt.toLowerCase() === activeUpt.toLowerCase() ||
          normalizeUptKey(itemUpt) === normalizeUptKey(activeUpt)
        );
      }
      if (initialExpense?.schoolName && e.schoolName) {
        return e.schoolName.trim().toLowerCase() === initialExpense.schoolName.trim().toLowerCase();
      }
      return true;
    });
  }, [allExpenses, selectedQuarters, initialExpense, activeUpt, schoolInfo.namaSekolah]);

  // Filtered approved items for Berita Acara Barang Ekstra
  const rawBarangEkstra = barangEkstraItems && barangEkstraItems.length > 0 ? barangEkstraItems : loadBarangEkstraItems();

  const displayBarangEkstra = useMemo(() => {
    return rawBarangEkstra
      .map((item) => {
        if (
          item.schoolName === 'DINAS PENDIDIKAN KAB. MINAHASA TENGGARA' ||
          item.schoolName === 'DINAS PENDIDIKAN KABUPATEN MINAHASA TENGGARA' ||
          (item.schoolName && item.schoolName.toUpperCase().startsWith('DINAS PENDIDIKAN'))
        ) {
          return { ...item, schoolName: 'DINAS PENDIDIKAN' };
        }
        return item;
      })
      .filter((item) => {
        // 1. Wajib hanya barang ekstra yang sudah di-approve
        if (item.status !== 'Disetujui Kepala Sekolah') return false;

        // 2. Filter UPT terpilih
        const currentUptFilter = activeUpt || (initialExpense?.schoolName || (currentUser?.role === 'Operator BOSP' ? (currentUser.schoolName || schoolInfo.namaSekolah) : 'Semua'));
        if (currentUptFilter && currentUptFilter !== 'Semua') {
          const itemUpt = (item.schoolName || '').trim();
          return (
            itemUpt.toLowerCase() === currentUptFilter.toLowerCase() ||
          normalizeUptKey(itemUpt) === normalizeUptKey(currentUptFilter)
        );
      }
      return true;
    });
  }, [rawBarangEkstra, activeUpt, initialExpense, currentUser, schoolInfo.namaSekolah]);

  // Data untuk Lampiran 1 (Pembelian Barang Ekstrakomptabel pada Tahun Berjalan)
  const lampiran1BarangEkstra = useMemo(() => {
    const filteredYear = displayBarangEkstra.filter((item) => {
      const yr = Number(
        item.tahunAnggaran ||
          (item.tanggalPerolehan
            ? new Date(item.tanggalPerolehan).getFullYear()
            : tahunAnggaranBerjalan)
      );
      return yr === Number(tahunAnggaranBerjalan);
    });
    return filteredYear.length > 0 ? filteredYear : displayBarangEkstra;
  }, [displayBarangEkstra, tahunAnggaranBerjalan]);

  // Aggregate values per Kode Rekening across filteredExpenses
  const aggregatedMap = useMemo(() => {
    const map: Record<
      string,
      {
        nominalSaldoAwal: number;
        nominalBelanjaLra: number;
        nominalPengeluaranSaldoAwal: number;
        nominalPengeluaranBelanja: number;
        nominalHibahMasuk: number;
        nominalHibahKeluar: number;
        sisaNilai: number;
        satuanDefault: string;
        hasActivity: boolean;
      }
    > = {};

    // Initialize all 81 standard options with 0
    for (const rekening of REKENING_PERSEDIAAN_OPTIONS) {
      map[rekening] = {
        nominalSaldoAwal: 0,
        nominalBelanjaLra: 0,
        nominalPengeluaranSaldoAwal: 0,
        nominalPengeluaranBelanja: 0,
        nominalHibahMasuk: 0,
        nominalHibahKeluar: 0,
        sisaNilai: 0,
        satuanDefault: '',
        hasActivity: false,
      };
    }

    for (const expense of filteredExpenses) {
      const items =
        expense.rincianItems && expense.rincianItems.length > 0
          ? expense.rincianItems
          : [
              {
                id: expense.id,
                kodeRekening: expense.kodeRekening,
                saldoAwal: expense.saldoAwal || 'Bukan Saldo Awal',
                saldoAwalMasuk:
                  expense.saldoAwalMasuk ||
                  expense.saldoAwal ||
                  'Bukan Saldo Awal',
                saldoAwalKeluar: expense.saldoAwalKeluar || 'Bukan Saldo Awal',
                isHibah: Boolean(expense.isHibah),
                nilaiSaldoAwal: expense.nilaiSaldoAwal,
                nilaiBelanjaLra: expense.nilaiBelanjaLra,
                pengeluaranSaldoAwal: expense.pengeluaranSaldoAwal,
                pengeluaranBelanja: expense.pengeluaranBelanja,
                hibahMasuk: expense.hibahMasuk,
                hibahKeluar: expense.hibahKeluar,
                nilaiMasuk: expense.nilaiMasuk ?? expense.subtotal ?? 0,
                nilaiKeluar: expense.nilaiKeluar ?? 0,
                sisaNilai: expense.sisaNilai ?? 0,
              },
            ];

      for (const item of items) {
        const key = item.kodeRekening;
        if (!key) continue;

        const masukType =
          item.saldoAwalMasuk || item.saldoAwal || 'Bukan Saldo Awal';
        const keluarType = item.saldoAwalKeluar || 'Bukan Saldo Awal';
        const hibah = Boolean(item.isHibah);

        const nominalSaldoAwal =
          item.nilaiSaldoAwal !== undefined
            ? item.nilaiSaldoAwal
            : !hibah && masukType === 'Saldo Awal'
            ? item.nilaiMasuk
            : 0;
        const nominalBelanjaLra =
          item.nilaiBelanjaLra !== undefined
            ? item.nilaiBelanjaLra
            : !hibah && masukType === 'Bukan Saldo Awal'
            ? item.nilaiMasuk
            : 0;
        const nominalPengeluaranSaldoAwal =
          item.pengeluaranSaldoAwal !== undefined
            ? item.pengeluaranSaldoAwal
            : !hibah && keluarType === 'Saldo Awal'
            ? item.nilaiKeluar
            : 0;
        const nominalPengeluaranBelanja =
          item.pengeluaranBelanja !== undefined
            ? item.pengeluaranBelanja
            : !hibah && keluarType === 'Bukan Saldo Awal'
            ? item.nilaiKeluar
            : 0;
        const nominalHibahMasuk =
          item.hibahMasuk !== undefined
            ? item.hibahMasuk
            : hibah
            ? item.nilaiMasuk
            : 0;
        const nominalHibahKeluar =
          item.hibahKeluar !== undefined
            ? item.hibahKeluar
            : hibah
            ? item.nilaiKeluar
            : 0;

        if (!map[key]) {
          map[key] = {
            nominalSaldoAwal: 0,
            nominalBelanjaLra: 0,
            nominalPengeluaranSaldoAwal: 0,
            nominalPengeluaranBelanja: 0,
            nominalHibahMasuk: 0,
            nominalHibahKeluar: 0,
            sisaNilai: 0,
            satuanDefault: '',
            hasActivity: false,
          };
        }

        map[key].nominalSaldoAwal += nominalSaldoAwal;
        map[key].nominalBelanjaLra += nominalBelanjaLra;
        map[key].nominalPengeluaranSaldoAwal += nominalPengeluaranSaldoAwal;
        map[key].nominalPengeluaranBelanja += nominalPengeluaranBelanja;
        map[key].nominalHibahMasuk += nominalHibahMasuk;
        map[key].nominalHibahKeluar += nominalHibahKeluar;

        if (!map[key].satuanDefault && expense.satuan) {
          map[key].satuanDefault = expense.satuan;
        }

        const totalMasuk =
          map[key].nominalSaldoAwal +
          map[key].nominalBelanjaLra +
          map[key].nominalHibahMasuk;
        const totalKeluar =
          map[key].nominalPengeluaranSaldoAwal +
          map[key].nominalPengeluaranBelanja +
          map[key].nominalHibahKeluar;
        map[key].sisaNilai = totalMasuk - totalKeluar;
        if (totalMasuk > 0 || totalKeluar > 0 || map[key].sisaNilai !== 0) {
          map[key].hasActivity = true;
        }
      }
    }

    return map;
  }, [filteredExpenses]);

  const tableRows = useMemo(() => {
    const allKeys = Array.from(
      new Set([
        ...REKENING_PERSEDIAAN_OPTIONS,
        ...Object.keys(aggregatedMap),
      ])
    );

    const rows = allKeys.map((kodeRekening) => {
      const data = aggregatedMap[kodeRekening] || {
        nominalSaldoAwal: 0,
        nominalBelanjaLra: 0,
        nominalPengeluaranSaldoAwal: 0,
        nominalPengeluaranBelanja: 0,
        nominalHibahMasuk: 0,
        nominalHibahKeluar: 0,
        sisaNilai: 0,
        satuanDefault: '',
        hasActivity: false,
      };
      return {
        kodeRekening,
        ...data,
      };
    });

    if (showOnlyFilledRows) {
      return rows.filter(
        (r) =>
          r.nominalSaldoAwal > 0 ||
          r.nominalBelanjaLra > 0 ||
          r.nominalPengeluaranSaldoAwal > 0 ||
          r.nominalPengeluaranBelanja > 0 ||
          r.nominalHibahMasuk > 0 ||
          r.nominalHibahKeluar > 0 ||
          r.sisaNilai !== 0
      );
    }

    return rows;
  }, [aggregatedMap, showOnlyFilledRows]);

  const subTotals = useMemo(() => {
    return tableRows.reduce(
      (acc, r) => ({
        nominalSaldoAwal: acc.nominalSaldoAwal + r.nominalSaldoAwal,
        nominalBelanjaLra: acc.nominalBelanjaLra + r.nominalBelanjaLra,
        nominalPengeluaranSaldoAwal:
          acc.nominalPengeluaranSaldoAwal + r.nominalPengeluaranSaldoAwal,
        nominalPengeluaranBelanja:
          acc.nominalPengeluaranBelanja + r.nominalPengeluaranBelanja,
        nominalHibahMasuk: acc.nominalHibahMasuk + r.nominalHibahMasuk,
        nominalHibahKeluar: acc.nominalHibahKeluar + r.nominalHibahKeluar,
        sisaNilai: acc.sisaNilai + r.sisaNilai,
      }),
      {
        nominalSaldoAwal: 0,
        nominalBelanjaLra: 0,
        nominalPengeluaranSaldoAwal: 0,
        nominalPengeluaranBelanja: 0,
        nominalHibahMasuk: 0,
        nominalHibahKeluar: 0,
        sisaNilai: 0,
      }
    );
  }, [tableRows]);

  // Totals for Stock Opname Table
  const stockOpnameSubTotals = useMemo(() => {
    return tableRows.reduce(
      (acc, r) => {
        const custom = stockOpnameCustomRows[r.kodeRekening];
        const saldoKartu = r.sisaNilai;
        const fisikHasil =
          custom?.fisikBarang !== undefined ? custom.fisikBarang : r.sisaNilai;
        const selisih = fisikHasil - saldoKartu;
        return {
          saldoKartu: acc.saldoKartu + saldoKartu,
          fisikHasil: acc.fisikHasil + fisikHasil,
          selisih: acc.selisih + selisih,
        };
      },
      { saldoKartu: 0, fisikHasil: 0, selisih: 0 }
    );
  }, [tableRows, stockOpnameCustomRows]);

  const handleUpdateStockOpnameRow = (
    kodeRekening: string,
    patch: Partial<StockOpnameRowCustom>
  ) => {
    setStockOpnameCustomRows((prev) => ({
      ...prev,
      [kodeRekening]: {
        ...prev[kodeRekening],
        ...patch,
      },
    }));
  };

  const getDocumentFileName = () => {
    const rawUpt =
      activeUpt && activeUpt !== 'Semua' ? activeUpt : namaSekolahHeader || 'DINAS_PENDIDIKAN';
    const cleanUpt = rawUpt.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    const prefix =
      variant === 'kib_barang_ekstra'
        ? 'KIB_B_Barang_Ekstrakontabel'
        : variant === 'reklas_barang_ekstra'
        ? activeReklasSubView === 'lampiran_1'
          ? 'Lampiran_1_BA_Reklas_Barang_Ekstra'
          : activeReklasSubView === 'lampiran_2'
          ? 'Lampiran_2_BA_Reklas_Barang_Ekstra'
          : 'BA_Reklas_Barang_Ekstra'
        : variant === 'barang_ekstra'
        ? 'BA_Barang_Ekstrakomptabel'
        : isStockOpname
        ? 'BA_Stock_Opname_Persediaan'
        : 'BA_Rekonsiliasi_Persediaan';
    return `${prefix}_${cleanUpt}_${tahunAnggaranBerjalan}`;
  };

  const handlePrint = () => {
    const el = document.getElementById('printable-receipt');
    if (!el) {
      window.print();
      return;
    }

    // Jika dibuka di tab utama browser (bukan di dalam sandboxed iframe preview),
    // langsung buka dialog printer bawaan browser.
    if (window.self === window.top) {
      window.print();
      return;
    }

    // Jika berada di dalam sandboxed iframe (di mana window.print() diblokir oleh sandbox),
    // buka jendela cetak yang bebas dari sandbox agar Dialog Printer Browser langsung terbuka.
    const printWindow = window.open('', '_blank', 'width=1050,height=780');
    if (!printWindow) {
      window.print();
      return;
    }

    const isLandscape = variant === 'kib_barang_ekstra' || variant === 'rekon';
    const pageSize = isLandscape ? 'A4 landscape' : 'A4 portrait';
    const docTitle = getDocumentFileName();

    const headStyles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((node) => {
        if (node.tagName.toLowerCase() === 'link') {
          const linkEl = node as HTMLLinkElement;
          return `<link rel="stylesheet" href="${linkEl.href}" />`;
        }
        return node.outerHTML;
      })
      .join('\n');

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
  ${headStyles}
  <style>
    @page {
      size: ${pageSize};
      margin: 12mm;
    }
    html, body {
      background: #ffffff !important;
      color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: "Times New Roman", Times, Georgia, serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #printable-receipt {
      width: 100% !important;
      max-width: 100% !important;
      border: none !important;
      box-shadow: none !important;
      padding: 16px 24px !important;
      margin: 0 !important;
      box-sizing: border-box;
    }
    .overflow-x-auto {
      overflow: visible !important;
    }
    @media print {
      #printable-receipt {
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div id="printable-receipt" class="bg-white text-slate-950 font-serif">
    ${el.innerHTML}
  </div>
  <script>
    (function() {
      var hasPrinted = false;
      function openBrowserPrintDialog() {
        if (hasPrinted) return;
        hasPrinted = true;
        setTimeout(function() {
          window.focus();
          window.print();
        }, 150);
      }
      window.addEventListener('afterprint', function() {
        window.close();
      });
      if (document.readyState === 'complete') {
        openBrowserPrintDialog();
      } else {
        window.addEventListener('load', openBrowserPrintDialog);
        setTimeout(openBrowserPrintDialog, 500);
      }
    })();
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {variant === 'kib_barang_ekstra'
                  ? 'Kartu Inventaris Barang (KIB) B - Barang Ekstrakontabel'
                  : variant === 'reklas_barang_ekstra'
                  ? 'Berita Acara Reklas Barang Ekstra'
                  : variant === 'barang_ekstra'
                  ? 'Berita Acara Barang Ekstrakomptabel'
                  : isStockOpname
                  ? 'Berita Acara Stock Opname Fisik Persediaan Barang'
                  : 'Berita Acara Rekonsiliasi Persediaan'}
              </h2>
              <p className="text-xs text-slate-500">
                {variant === 'kib_barang_ekstra'
                  ? 'Format Cetak Resmi Kartu Inventaris Barang (KIB) B Barang Ekstrakontabel'
                  : variant === 'reklas_barang_ekstra'
                  ? 'Format Cetak Resmi Berita Acara Reklasifikasi Barang Ekstra Sekolah'
                  : variant === 'barang_ekstra'
                  ? 'Format Cetak Resmi Berita Acara Barang Ekstrakomptabel Sekolah'
                  : isStockOpname
                  ? 'Format Cetak Resmi Berita Acara Stock Opname Persediaan Sekolah'
                  : 'Format Cetak Resmi Rekonsiliasi Persediaan Sekolah'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Tombol Filter UPT dengan Search (Khusus Pengguna Admin) */}
            {isAdmin && (
              <div className="relative" ref={receiptUptRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptUptModalOpen((prev) => !prev);
                    setTimeout(() => receiptUptInputRef.current?.focus(), 80);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                    activeUpt !== 'Semua'
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                  }`}
                  title="Filter UPT Sekolah untuk Berita Acara"
                >
                  <Building className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-[140px] sm:max-w-[180px]">
                    {activeUpt === 'Semua' ? 'Semua UPT' : activeUpt}
                  </span>
                  <Search className="w-3 h-3 text-emerald-600 shrink-0" />
                </button>

                {isReceiptUptModalOpen && (
                  <div className="absolute left-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-3 text-xs space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Filter UPT Berita Acara</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {receiptFilteredUptOptions.length} UPT
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        ref={receiptUptInputRef}
                        value={receiptUptSearchInput}
                        onChange={(e) => setReceiptUptSearchInput(e.target.value)}
                        placeholder="Ketik nama UPT sekolah..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      {receiptUptSearchInput && (
                        <button
                          type="button"
                          onClick={() => setReceiptUptSearchInput('')}
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
                          handleSelectUpt('Semua');
                          setIsReceiptUptModalOpen(false);
                          setReceiptUptSearchInput('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                          activeUpt === 'Semua'
                            ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        Semua UPT (Kabupaten)
                      </button>
                      {receiptFilteredUptOptions.map((upt) => (
                        <button
                          key={upt}
                          type="button"
                          onClick={() => {
                            handleSelectUpt(upt);
                            setIsReceiptUptModalOpen(false);
                            setReceiptUptSearchInput('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-all cursor-pointer truncate ${
                            activeUpt === upt
                              ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                          title={upt}
                        >
                          {upt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Filter Sumber Data: Tombol Combo Box dengan Centang (Checkboxes) */}
            <div className="relative" ref={comboRef}>
              <button
                type="button"
                onClick={() => setIsComboOpen((prev) => !prev)}
                className="flex items-center justify-between gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[235px] transition-all cursor-pointer shadow-2xs"
                aria-haspopup="listbox"
                aria-expanded={isComboOpen}
                aria-label="Filter Triwulan Laporan Cetak"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{comboButtonLabel}</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${
                    isComboOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isComboOpen && (
                <div
                  className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-2 text-xs animate-fadeIn"
                  role="listbox"
                  aria-multiselectable="true"
                >
                  <div className="px-3 pb-1.5 mb-1 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                      Centang Filter Triwulan
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600">
                      {selectedQuarters.length}/4 dipilih
                    </span>
                  </div>

                  {/* Option: Pilih Semua TW */}
                  <label className="flex items-center justify-between px-3 py-2 hover:bg-emerald-50/60 cursor-pointer select-none transition-colors border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={
                          selectedQuarters.length === ALL_QUARTERS.length
                        }
                        onChange={toggleAllQuarters}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="font-bold text-slate-800">
                        Semua Triwulan (TW1 - TW4)
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {allExpenses.length} input
                    </span>
                  </label>

                  {/* Individual TW Checkboxes */}
                  <div className="py-1 divide-y divide-slate-50">
                    {ALL_QUARTERS.map((q) => {
                      const isChecked = selectedQuarters.includes(q.id);
                      const countInTw = allExpenses.filter(
                        (e) => e.triwulan === q.id
                      ).length;

                      return (
                        <label
                          key={q.id}
                          className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer select-none transition-colors ${
                            isChecked ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleQuarter(q.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <div
                                className={`font-semibold ${
                                  isChecked
                                    ? 'text-emerald-950'
                                    : 'text-slate-700'
                                }`}
                              >
                                {q.label}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Periode {q.period}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              countInTw > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {countInTw} input
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Helper Footer inside Dropdown */}
                  <div className="px-3 pt-2 mt-1 border-t border-slate-100 text-[11px] text-slate-500 leading-snug">
                    {selectedQuarters.length === 0 ? (
                      <span className="text-amber-600 font-medium">
                        Centang minimal 1 TW untuk menampilkan data laporan.
                      </span>
                    ) : selectedQuarters.length === 1 ? (
                      <span>
                        Menampilkan inputan khusus{' '}
                        <strong className="text-slate-800">
                          {selectedQuarters[0]}
                        </strong>
                        .
                      </span>
                    ) : (
                      <span>
                        Menggabungkan nilai per jenis rekening belanja dari{' '}
                        <strong className="text-emerald-700">
                          {selectedQuarters.join(' + ')}
                        </strong>
                        .
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tombol Pilihan 3 Dokumen khusus Berita Acara Reklas Barang Ekstra */}
            {variant === 'reklas_barang_ekstra' && (
              <div className="relative" ref={reklasSubDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsReklasSubDropdownOpen((prev) => !prev)}
                  className="flex items-center justify-between gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg px-3 py-1.5 text-xs text-emerald-950 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer shadow-2xs"
                >
                  <span>
                    {REKLAS_SUB_VIEW_OPTIONS.find((o) => o.id === activeReklasSubView)?.label ||
                      '1. BA Reklas Barang Ekstra'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-emerald-700 transition-transform ${
                      isReklasSubDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isReklasSubDropdownOpen && (
                  <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-40 p-1.5 text-xs space-y-1 animate-fadeIn">
                    <div className="px-2.5 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Pilih Tampilan Reklas
                    </div>
                    {REKLAS_SUB_VIEW_OPTIONS.map((opt) => {
                      const isSel = activeReklasSubView === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            handleSelectReklasSubView(opt.id);
                            setIsReklasSubDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-between ${
                            isSel
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'hover:bg-emerald-50 text-slate-700 hover:text-emerald-800'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSel && (
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
            )}

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyFilledRows}
                onChange={(e) => setShowOnlyFilledRows(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Hanya Baris Terisi</span>
            </label>

            {/* Pemilih Tanggal Kalender Langsung - Seluruh Box Dapat Diklik */}
            <div
              onClick={handleTriggerDatePicker}
              className="relative inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-sm hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer select-none active:scale-[0.99] group overflow-hidden"
              title="Klik di mana saja pada tombol ini untuk memilih tanggal kalender"
            >
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0 pointer-events-none group-hover:scale-105 transition-transform" />
              <span className="text-xs font-bold text-slate-800 pointer-events-none tracking-wide">
                {reportDateInfo
                  ? `${reportDateInfo.dayPad} ${reportDateInfo.monthName} ${reportDateInfo.year}`
                  : selectedReportDate}
              </span>
              {reportDateInfo && (
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 pointer-events-none">
                  {reportDateInfo.dayName}
                </span>
              )}
              {/* Input kalender yang melingkupi 100% seluruh badan tombol */}
              <input
                ref={dateInputRef}
                type="date"
                value={selectedReportDate}
                onChange={(e) => handleReportDateChange(e.target.value)}
                className="full-box-date-input absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="Pilih tanggal dalam bentuk kalender"
                tabIndex={-1}
              />
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition-all active:scale-95 cursor-pointer"
              aria-label="Cetak Dokumen Ini"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Dokumen (Print/PDF)</span>
            </button>
          </div>
        </div>

        {/* Active Filter Summary Indicator (Hidden in Print) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            {selectedQuarters.length === 0 ? (
              <span className="text-amber-700 font-medium">
                Belum ada Triwulan yang dicentang pada combo box filter.
              </span>
            ) : selectedQuarters.length === 1 ? (
              <span>
                Laporan menampilkan inputan{' '}
                <strong className="text-slate-900">
                  {selectedQuarters[0]}
                </strong>{' '}
                ({filteredExpenses.length} data inputan).
              </span>
            ) : (
              <span>
                Laporan menampilkan gabungan inputan{' '}
                <strong className="text-emerald-700">
                  {selectedQuarters.join(', ')}
                </strong>{' '}
                ({filteredExpenses.length} data inputan digabung nilainya per
                jenis rekening belanja).
              </span>
            )}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
            <span>Periode Otomatis:</span>
            <span className="font-bold">{periodeTahunAnggaran}</span>
          </div>
        </div>
      </div>

      {/* The Printable Official Document Sheet */}
      <div
        id="printable-receipt"
        className="bg-white p-6 sm:p-10 rounded-xl border border-slate-300 shadow-sm print:shadow-none print:border-none print:p-0 text-slate-950 font-serif"
      >
        {variant === 'reklas_barang_ekstra' ? (
          activeReklasSubView === 'ba_reklas' ? (
            /* ================================================================= */
            /* 1. BA REKLAS BARANG EKSTRA (Sesuai File Lampiran CSV)             */
            /* ================================================================= */
            <div>
              {/* Kop Pemerintah & Dinas Pendidikan */}
              <div className="text-center text-xs sm:text-sm font-bold uppercase leading-snug pb-3 mb-6 border-b-2 border-slate-900">
                <div>{pemerintahDaerah}</div>
                <div>DINAS PENDIDIKAN</div>
                {activeUpt && activeUpt !== 'Semua' && activeUpt !== 'DINAS PENDIDIKAN' && (
                  <div className="text-xs text-slate-700 font-semibold mt-0.5">{activeUpt}</div>
                )}
              </div>

              {/* Judul Berita Acara */}
              <div className="text-center mb-6">
                <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide text-slate-950">
                  BERITA ACARA BARANG EKSTRAKOMPTABEL
                </h1>
                <p className="text-xs sm:text-sm font-bold uppercase text-slate-950 mt-0.5">
                  {periodeTahunAnggaran}
                </p>
              </div>

              {/* Paragraf Pembuka & Penandatangan Pihak 1 & 2 */}
              <div className="text-xs sm:text-[13px] leading-relaxed space-y-4 mb-6 text-slate-950">
                <p>{kalimatPembuka}</p>

                <div className="space-y-3 pl-2 sm:pl-4">
                  {/* Pihak 1: Pengurus Barang */}
                  <table className="text-xs sm:text-[13px] border-collapse">
                    <tbody>
                      <tr>
                        <td className="w-24 py-0.5 align-top">Nama</td>
                        <td className="py-0.5 font-semibold">: {namaPihak1}</td>
                      </tr>
                      <tr>
                        <td className="w-24 py-0.5 align-top">NIP</td>
                        <td className="py-0.5">: {nipPihak1}</td>
                      </tr>
                      <tr>
                        <td className="w-24 py-0.5 align-top">Jabatan</td>
                        <td className="py-0.5">: {jabatanPihak1}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Pihak 2: Pejabat Penatausahaan Barang */}
                  <table className="text-xs sm:text-[13px] border-collapse">
                    <tbody>
                      <tr>
                        <td className="w-24 py-0.5 align-top">Nama</td>
                        <td className="py-0.5 font-semibold">: {namaPihak2}</td>
                      </tr>
                      <tr>
                        <td className="w-24 py-0.5 align-top">NIP</td>
                        <td className="py-0.5">: {nipPihak2}</td>
                      </tr>
                      <tr>
                        <td className="w-24 py-0.5 align-top">Jabatan</td>
                        <td className="py-0.5">: {jabatanPihak2}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Isi Poin 1 & 2 sesuai File CSV */}
                <div className="pt-2 space-y-3">
                  <p>
                    Berdasarkan hasil pemeriksaan fisik Barang Ektrakomptabel per{' '}
                    {cutOffDate.replace(/^PER\s+/i, '').replace(/\s+(\d{4})$/, ' Tahun $1')} maka:
                  </p>

                  <div className="space-y-2.5 pl-1">
                    <div className="flex items-start gap-2">
                      <span className="w-5 shrink-0">1.</span>
                      <span>
                        Pembelian Barang Ektrakomptabel pada Tahun {tahunAnggaranBerjalan} rinciannya
                        sebagaimana terlampir pada lampiran I :
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="w-5 shrink-0">2.</span>
                      <span>
                        Rincian Barang Ekstakomptabel yang dikuasai oleh{' '}
                        {activeUpt && activeUpt !== 'Semua' ? activeUpt : 'DINAS PENDIDIKAN'}{' '}
                        sampai pada {cutOffDate.replace(/^PER\s+/i, '')} sebagaimana terlampir pada
                        lampiran II:
                      </span>
                    </div>
                  </div>
                </div>

                <p className="pt-2">
                  Demikian Berita Acara Rekonsiliasi Barang Persediaan ini dibuat untuk keperluan
                  Laporan Keuangan DINAS PENDIDIKAN
                </p>
              </div>

              {/* Tanda Tangan Resmi (3 Penandatangan sesuai File CSV) */}
              <div className="mt-10 pt-4 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
                {/* Baris Atas: Kiri (Pejabat Penatausahaan Barang) & Kanan (Pengurus Barang) */}
                <div className="grid grid-cols-2 gap-8 text-center">
                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pejabat Penatausahaan Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusPembantuFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pengurus Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusBarangFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusBarangFooter}</p>
                    </div>
                  </div>
                </div>

                {/* Baris Bawah Tengah: Mengetahui Kepala Dinas Pendidikan */}
                <div className="mt-10 text-center flex flex-col items-center justify-between min-h-[120px]">
                  <div>
                    <p className="font-normal">Mengetahui,</p>
                    <p className="font-normal">Kepala Dinas Pendidikan,</p>
                  </div>
                  <div className="mt-16">
                    <p className="font-bold underline">{namaKepsekFooter}</p>
                    <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : activeReklasSubView === 'lampiran_1' ? (
            /* ================================================================= */
            /* 2. LAMPIRAN 1 (Pembelian Barang Ekstrakomptabel Tahun Berjalan)   */
            /* ================================================================= */
            <div>
              <div className="flex justify-end mb-4 text-xs">
                <div className="text-right border-b border-slate-900 pb-1">
                  <div className="font-bold uppercase">
                    LAMPIRAN I : BERITA ACARA BARANG EKSTRAKOMPTABEL
                  </div>
                  <div className="text-[11px] text-slate-700 uppercase">
                    {periodeTahunAnggaran}
                  </div>
                </div>
              </div>

              <div className="text-center text-xs sm:text-sm font-bold uppercase leading-snug pb-3 mb-5 border-b-2 border-slate-900">
                <div>{pemerintahDaerah}</div>
                <div>DINAS PENDIDIKAN</div>
                {activeUpt && activeUpt !== 'Semua' && activeUpt !== 'DINAS PENDIDIKAN' && (
                  <div className="text-xs text-slate-700 font-semibold mt-0.5">{activeUpt}</div>
                )}
              </div>

              <div className="text-center mb-6">
                <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide text-slate-950">
                  LAMPIRAN I
                </h1>
                <p className="text-xs sm:text-sm font-bold uppercase text-slate-950 mt-0.5">
                  PEMBELIAN BARANG EKSTRAKOMPTABEL PADA TAHUN {tahunAnggaranBerjalan}
                </p>
                <p className="text-xs font-bold uppercase text-slate-800 mt-0.5">
                  {periodeTahunAnggaran}
                </p>
              </div>

              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full border-collapse border border-slate-900 text-[11px] sm:text-xs relative z-0">
                  <thead>
                    <tr className="bg-white text-slate-950 font-bold text-center">
                      <th className="border border-slate-900 py-2 px-2 w-10">No</th>
                      <th className="border border-slate-900 py-2 px-3 text-left">Jenis Persediaan</th>
                      <th className="border border-slate-900 py-2 px-2 w-20">Jumlah</th>
                      <th className="border border-slate-900 py-2 px-2.5 w-32 text-right">Harga Satuan (Rp)</th>
                      <th className="border border-slate-900 py-2 px-2 w-28">Tahun Pembelian</th>
                      <th className="border border-slate-900 py-2 px-2.5 w-36 text-right">Total Harga (Rp)</th>
                      <th className="border border-slate-900 py-2 px-3 text-left">NAMA UPT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lampiran1BarangEkstra.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="border border-slate-900 py-6 text-center italic text-slate-500">
                          NIHIL - Belum ada data Pembelian Barang Ekstrakomptabel Tahun {tahunAnggaranBerjalan} yang disetujui.
                        </td>
                      </tr>
                    ) : (
                      lampiran1BarangEkstra.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="border border-slate-900 py-1.5 px-2 text-center font-bold">{idx + 1}</td>
                          <td className="border border-slate-900 py-1.5 px-3 font-semibold text-slate-950 text-left">
                            {item.namaBarang} {item.spesifikasi ? `(${item.spesifikasi})` : ''}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2 text-center font-medium">
                            {item.volume} {item.satuan || ''}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2.5 text-right font-medium whitespace-nowrap">
                            {formatNominalRekonsiliasi(item.hargaSatuan)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2 text-center">
                            {item.tahunAnggaran || (item.tanggalPerolehan ? new Date(item.tanggalPerolehan).getFullYear() : tahunAnggaranBerjalan)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2.5 text-right font-bold whitespace-nowrap">
                            {formatNominalRekonsiliasi(item.totalHarga)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-3 text-left uppercase text-slate-950">
                            {item.schoolName || (activeUpt !== 'Semua' ? activeUpt : 'DINAS PENDIDIKAN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white font-bold text-slate-950">
                      <td colSpan={5} className="border border-slate-900 py-2 px-3 text-center uppercase tracking-wider font-extrabold">
                        JUMLAH
                      </td>
                      <td className="border border-slate-900 py-2 px-2.5 text-right font-black whitespace-nowrap">
                        {lampiran1BarangEkstra.length > 0
                          ? formatNominalRekonsiliasi(
                              lampiran1BarangEkstra.reduce((acc, i) => acc + (i.totalHarga || 0), 0)
                            )
                          : '-'}
                      </td>
                      <td className="border border-slate-900 py-2 px-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Tanda Tangan Lampiran 1 */}
              <div className="mt-10 pt-4 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
                <div className="grid grid-cols-2 gap-8 text-center">
                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pejabat Penatausahaan Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusPembantuFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pengurus Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusBarangFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusBarangFooter}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-10 text-center flex flex-col items-center justify-between min-h-[120px]">
                  <div>
                    <p className="font-normal">Mengetahui,</p>
                    <p className="font-normal">Kepala Dinas Pendidikan,</p>
                  </div>
                  <div className="mt-16">
                    <p className="font-bold underline">{namaKepsekFooter}</p>
                    <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================================================================= */
            /* 3. LAMPIRAN 2 (Rincian Barang Ekstrakomptabel yang Dikuasai)      */
            /* ================================================================= */
            <div>
              <div className="flex justify-end mb-4 text-xs">
                <div className="text-right border-b border-slate-900 pb-1">
                  <div className="font-bold uppercase">
                    LAMPIRAN II : BERITA ACARA BARANG EKSTRAKOMPTABEL
                  </div>
                  <div className="text-[11px] text-slate-700 uppercase">
                    {periodeTahunAnggaran}
                  </div>
                </div>
              </div>

              <div className="text-center text-xs sm:text-sm font-bold uppercase leading-snug pb-3 mb-5 border-b-2 border-slate-900">
                <div>{pemerintahDaerah}</div>
                <div>DINAS PENDIDIKAN</div>
                {activeUpt && activeUpt !== 'Semua' && activeUpt !== 'DINAS PENDIDIKAN' && (
                  <div className="text-xs text-slate-700 font-semibold mt-0.5">{activeUpt}</div>
                )}
              </div>

              <div className="text-center mb-6">
                <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide text-slate-950">
                  LAMPIRAN II
                </h1>
                <p className="text-xs sm:text-sm font-bold uppercase text-slate-950 mt-0.5">
                  RINCIAN BARANG EKSTRAKOMPTABEL YANG DIKUASAI OLEH{' '}
                  {activeUpt && activeUpt !== 'Semua' ? activeUpt : 'DINAS PENDIDIKAN'}
                </p>
                <p className="text-xs font-bold uppercase text-slate-800 mt-0.5">
                  SAMPAI PADA {cutOffDate.replace(/^PER\s+/i, '').toUpperCase()}
                </p>
              </div>

              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full border-collapse border border-slate-900 text-[11px] sm:text-xs relative z-0">
                  <thead>
                    <tr className="bg-white text-slate-950 font-bold text-center">
                      <th className="border border-slate-900 py-2 px-2 w-10">No</th>
                      <th className="border border-slate-900 py-2 px-3 text-left">Jenis Persediaan</th>
                      <th className="border border-slate-900 py-2 px-2 w-20">Jumlah</th>
                      <th className="border border-slate-900 py-2 px-2.5 w-32 text-right">Harga Satuan (Rp)</th>
                      <th className="border border-slate-900 py-2 px-2 w-28">Tahun Pembelian</th>
                      <th className="border border-slate-900 py-2 px-2.5 w-36 text-right">Total Harga (Rp)</th>
                      <th className="border border-slate-900 py-2 px-3 text-left">NAMA UPT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayBarangEkstra.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="border border-slate-900 py-6 text-center italic text-slate-500">
                          NIHIL - Belum ada data Barang Ekstrakomptabel yang disetujui (Approved).
                        </td>
                      </tr>
                    ) : (
                      displayBarangEkstra.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="border border-slate-900 py-1.5 px-2 text-center font-bold">{idx + 1}</td>
                          <td className="border border-slate-900 py-1.5 px-3 font-semibold text-slate-950 text-left">
                            {item.namaBarang} {item.spesifikasi ? `(${item.spesifikasi})` : ''}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2 text-center font-medium">
                            {item.volume} {item.satuan || ''}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2.5 text-right font-medium whitespace-nowrap">
                            {formatNominalRekonsiliasi(item.hargaSatuan)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2 text-center">
                            {item.tahunAnggaran || (item.tanggalPerolehan ? new Date(item.tanggalPerolehan).getFullYear() : tahunAnggaranBerjalan)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-2.5 text-right font-bold whitespace-nowrap">
                            {formatNominalRekonsiliasi(item.totalHarga)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-3 text-left uppercase text-slate-950">
                            {item.schoolName || (activeUpt !== 'Semua' ? activeUpt : 'DINAS PENDIDIKAN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white font-bold text-slate-950">
                      <td colSpan={5} className="border border-slate-900 py-2 px-3 text-center uppercase tracking-wider font-extrabold">
                        JUMLAH
                      </td>
                      <td className="border border-slate-900 py-2 px-2.5 text-right font-black whitespace-nowrap">
                        {displayBarangEkstra.length > 0
                          ? formatNominalRekonsiliasi(
                              displayBarangEkstra.reduce((acc, i) => acc + (i.totalHarga || 0), 0)
                            )
                          : '-'}
                      </td>
                      <td className="border border-slate-900 py-2 px-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Tanda Tangan Lampiran 2 */}
              <div className="mt-10 pt-4 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
                <div className="grid grid-cols-2 gap-8 text-center">
                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pejabat Penatausahaan Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusPembantuFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between min-h-[120px]">
                    <p className="font-normal">Pengurus Barang</p>
                    <div className="mt-16">
                      <p className="font-bold underline">{namaPengurusBarangFooter}</p>
                      <p className="mt-0.5">NIP. {nipPengurusBarangFooter}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-10 text-center flex flex-col items-center justify-between min-h-[120px]">
                  <div>
                    <p className="font-normal">Mengetahui,</p>
                    <p className="font-normal">Kepala Dinas Pendidikan,</p>
                  </div>
                  <div className="mt-16">
                    <p className="font-bold underline">{namaKepsekFooter}</p>
                    <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : variant === 'kib_barang_ekstra' ? (
          /* ===================================================================== */
          /* VARIANT: KARTU INVENTARIS BARANG (KIB) B BARANG EKSTRAKONTABEL         */
          /* ===================================================================== */
          <div>
            {/* Kop KIB B dengan Garis Datar */}
            <div className="text-center text-xs sm:text-sm font-bold uppercase leading-snug pb-3 mb-5 border-b-2 border-slate-900">
              <div>KABUPATEN MINAHASA TENGGARA</div>
              <div className="mt-2 text-sm sm:text-base font-extrabold tracking-wide">
                KARTU INVENTARIS BARANG (KIB) B
              </div>
              <div className="text-xs sm:text-sm font-bold">
                BARANG EKSTRAKONTABEL
              </div>
            </div>

            {/* Metadata Lokasi & Organisasi sesuai File CSV */}
            <div className="text-xs sm:text-[13px] mb-4 text-slate-950">
              <table className="border-collapse text-xs sm:text-[13px]">
                <tbody>
                  <tr>
                    <td className="w-44 py-0.5 font-semibold">Provinsi</td>
                    <td className="py-0.5 font-bold uppercase">: PROVINSI SULAWESI UTARA</td>
                  </tr>
                  <tr>
                    <td className="w-44 py-0.5 font-semibold">Kab./Kota</td>
                    <td className="py-0.5 font-bold uppercase">: KABUPATEN MINAHASA TENGGARA</td>
                  </tr>
                  <tr>
                    <td className="w-44 py-0.5 font-semibold">Bidang</td>
                    <td className="py-0.5 font-semibold">: Bidang Pendidikan dan Kebudayaan</td>
                  </tr>
                  <tr>
                    <td className="w-44 py-0.5 font-semibold">Unit Organisasi</td>
                    <td className="py-0.5 font-semibold">: Dinas Pendidikan</td>
                  </tr>
                  <tr>
                    <td className="w-44 py-0.5 font-semibold">Sub Unit Organisasi</td>
                    <td className="py-0.5 font-bold uppercase">
                      : {activeUpt && activeUpt !== 'Semua' ? activeUpt : namaSekolahHeader}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-3 font-bold text-xs uppercase tracking-wide">
                NO. KODE LOKASI :
              </div>
            </div>

            {/* Tabel 21 Kolom KIB B Barang Ekstrakontabel */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse border border-slate-900 text-[10px] sm:text-[11px]">
                <thead>
                  <tr className="bg-white text-slate-950 font-bold text-center">
                    <th className="border border-slate-900 py-1.5 px-1 w-8">No.</th>
                    <th className="border border-slate-900 py-1.5 px-1.5 min-w-[90px]">Nama SKPD</th>
                    <th className="border border-slate-900 py-1.5 px-1.5 min-w-[75px]">Kode Barang</th>
                    <th className="border border-slate-900 py-1.5 px-2 min-w-[120px]">
                      Jenis Barang /<br />Nama Barang
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Nomor<br />Register
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Merk/<br />Type
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Ukuran/<br />CC
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Bahan</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Bulan Pem-<br />belian
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Tahun Pem-<br />belian
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Nomor Pabrik</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Nomor Rangka</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Nomor Mesin</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Nomor Polisi</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Nomor BPKB</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Kondisi</th>
                    <th className="border border-slate-900 py-1.5 px-1.5">
                      Asal<br />usul
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Jumlah</th>
                    <th className="border border-slate-900 py-1.5 px-1.5 text-right">Harga Satuan</th>
                    <th className="border border-slate-900 py-1.5 px-1.5 text-right">
                      Harga<br />(Rp)
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1.5">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {displayBarangEkstra.map((item, idx) => {
                    const parsedTgl = item.tanggalPerolehan
                      ? parseReportDateComponents(item.tanggalPerolehan)
                      : null;
                    const bulanBeli = parsedTgl ? parsedTgl.monthName : '-';
                    const tahunBeli =
                      item.tahunAnggaran ||
                      (parsedTgl ? parsedTgl.year : tahunAnggaranBerjalan);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="border border-slate-900 py-1 px-1 text-center font-semibold">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-left uppercase">
                          {item.schoolName || (activeUpt !== 'Semua' ? activeUpt : namaSekolahHeader)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-2 text-left font-semibold">
                          {item.namaBarang}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {String(idx + 1).padStart(4, '0')}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {item.spesifikasi || '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {bulanBeli}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {tahunBeli}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">-</td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {item.kondisi || 'Baik'}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center">
                          {item.sumberPerolehan || 'Pembelian'}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center whitespace-nowrap">
                          {item.volume} {item.satuan || ''}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right whitespace-nowrap">
                          {formatNominalRekonsiliasi(item.hargaSatuan)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right font-bold whitespace-nowrap">
                          {formatNominalRekonsiliasi(item.totalHarga)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-left">
                          {item.keterangan || '-'}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Baris kosong bernomor (1 s/d 11) sesuai template CSV bila data kurang dari 11 */}
                  {!showOnlyFilledRows &&
                    displayBarangEkstra.length < 11 &&
                    Array.from({ length: 11 - displayBarangEkstra.length }).map((_, i) => {
                      const rowNum = displayBarangEkstra.length + i + 1;
                      return (
                        <tr key={`empty-kib-${rowNum}`} className="h-6">
                          <td className="border border-slate-900 py-1 px-1 text-center">
                            {rowNum}
                          </td>
                          {Array.from({ length: 20 }).map((__, colIdx) => (
                            <td key={colIdx} className="border border-slate-900 py-1 px-1">
                              &nbsp;
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="bg-white font-bold text-slate-950">
                    <td
                      colSpan={19}
                      className="border border-slate-900 py-1.5 px-3 text-center font-extrabold"
                    >
                      Total
                    </td>
                    <td className="border border-slate-900 py-1.5 px-1.5 text-right font-black whitespace-nowrap">
                      {displayBarangEkstra.length > 0
                        ? formatNominalRekonsiliasi(
                            displayBarangEkstra.reduce((acc, i) => acc + (i.totalHarga || 0), 0)
                          )
                        : '-'}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-1.5"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Tanda Tangan KIB B sesuai File CSV */}
            <div className="mt-8 pt-2 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
              <div className="grid grid-cols-2 gap-8 text-center">
                {/* Kiri: MENGETAHUI KEPALA SATUAN SEKOLAH */}
                <div className="flex flex-col justify-between min-h-[120px]">
                  <div>
                    <p className="font-semibold uppercase">MENGETAHUI</p>
                    <p className="font-bold uppercase">KEPALA SATUAN SEKOLAH</p>
                  </div>
                  <div className="mt-16">
                    <p className="font-bold underline">{namaKepsekFooter}</p>
                    <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                  </div>
                </div>

                {/* Kanan: Tanggal Lokasi & PENGURUS BARANG PEMBANTU */}
                <div className="flex flex-col justify-between min-h-[120px]">
                  <div>
                    <p className="font-normal">
                      {schoolInfo.kecamatan || 'Tambelang'},{' '}
                      {reportDateInfo
                        ? `${reportDateInfo.dayPad} ${reportDateInfo.monthName} ${reportDateInfo.year}`
                        : cutOffDate.replace(/^PER\s+/i, '')}
                    </p>
                    <p className="font-bold uppercase">PENGURUS BARANG PEMBANTU</p>
                  </div>
                  <div className="mt-16">
                    <p className="font-bold underline">{namaPengurusPembantuFooter}</p>
                    <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Centered Government & School Header */}
            <div className="text-center text-xs sm:text-sm font-bold uppercase leading-snug pb-3 mb-6 border-b-2 border-slate-900">
              <div>{pemerintahDaerah}</div>
              {isStockOpname && <div>{dinasHeader}</div>}
              <div>{namaSekolahHeader}</div>
            </div>

            {/* Centered Document Title */}
            <div className="text-center mb-6">
              <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide text-slate-950">
                {variant === 'barang_ekstra'
                  ? 'BERITA ACARA BARANG EKSTRAKOMPTABEL'
                  : isStockOpname
                  ? 'BERITA ACARA STOCK OPNAME FISIK PERSEDIAAN BARANG'
                  : 'BERITA ACARA REKONSILIASI PERSEDIAAN'}
              </h1>
              <p className="text-xs sm:text-sm font-bold uppercase text-slate-950 mt-0.5">
                {periodeTahunAnggaran}
              </p>
            </div>

            {/* Opening Paragraph & Officials List */}
            <div className="text-xs sm:text-[13px] leading-relaxed space-y-3 mb-4 text-slate-950">
              <p>{kalimatPembuka}</p>

              <div className="space-y-3 pl-1">
                {/* Official 1 */}
                <table className="text-xs sm:text-[13px] border-collapse">
                  <tbody>
                    <tr>
                      <td className="w-24 py-0.5 align-top">Nama</td>
                      <td className="py-0.5 font-semibold">: {namaPihak1}</td>
                    </tr>
                    <tr>
                      <td className="w-24 py-0.5 align-top">NIP</td>
                      <td className="py-0.5">: {nipPihak1}</td>
                    </tr>
                    <tr>
                      <td className="w-24 py-0.5 align-top">Jabatan</td>
                      <td className="py-0.5">: {jabatanPihak1}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Official 2 */}
                <table className="text-xs sm:text-[13px] border-collapse">
                  <tbody>
                    <tr>
                      <td className="w-24 py-0.5 align-top">Nama</td>
                      <td className="py-0.5 font-semibold">: {namaPihak2}</td>
                    </tr>
                    <tr>
                      <td className="w-24 py-0.5 align-top">NIP</td>
                      <td className="py-0.5">: {nipPihak2}</td>
                    </tr>
                    <tr>
                      <td className="w-24 py-0.5 align-top">Jabatan</td>
                      <td className="py-0.5">: {jabatanPihak2}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>
                {variant === 'barang_ekstra'
                  ? `Dengan ini Rincian Barang Ekstakomptabel yang dikuasai oleh ${namaSekolahHeader} sampai pada ${cutOffDate.replace(/^PER\s+/i, '')} adalah sebagai berikut :`
                  : 'Berdasarkan hasil pemeriksaan persediaan fisik, serta bukti-bukti yang berada dalam pengurusan/pengelolaan ini ditemukan perincian sebagai berikut :'}
              </p>
            </div>

        {/* Document Table: Stock Opname vs Rekonsiliasi Persediaan vs Barang Ekstra */}
        <div className="overflow-x-auto print:overflow-visible">
          {variant === 'barang_ekstra' ? (
            <table className="w-full border-collapse border border-slate-900 text-[11px] sm:text-xs relative z-0">
              <thead>
                <tr className="bg-white text-slate-950 font-bold text-center">
                  <th className="border border-slate-900 py-2 px-2 w-10">No</th>
                  <th className="border border-slate-900 py-2 px-3 text-left">Jenis Persediaan</th>
                  <th className="border border-slate-900 py-2 px-2 w-20">Jumlah</th>
                  <th className="border border-slate-900 py-2 px-2.5 w-32 text-right">Harga Satuan (Rp)</th>
                  <th className="border border-slate-900 py-2 px-2 w-28">Tahun Pembelian</th>
                  <th className="border border-slate-900 py-2 px-2.5 w-36 text-right">Total Harga (Rp)</th>
                  <th className="border border-slate-900 py-2 px-3 text-left">NAMA UPT</th>
                </tr>
              </thead>
              <tbody>
                {displayBarangEkstra.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-900 py-6 text-center italic text-slate-500">
                      NIHIL - Belum ada data Barang Ekstrakomptabel yang disetujui (Approved).
                    </td>
                  </tr>
                ) : (
                  displayBarangEkstra.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-bold">{idx + 1}</td>
                      <td className="border border-slate-900 py-1.5 px-3 font-semibold text-slate-950 text-left">
                        {item.namaBarang} {item.spesifikasi ? `(${item.spesifikasi})` : ''}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-medium">
                        {item.volume} {item.satuan || ''}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-2.5 text-right font-medium whitespace-nowrap">
                        {formatNominalRekonsiliasi(item.hargaSatuan)}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-2 text-center">
                        {item.tahunAnggaran || (item.tanggalPerolehan ? new Date(item.tanggalPerolehan).getFullYear() : tahunAnggaranBerjalan)}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-2.5 text-right font-bold whitespace-nowrap">
                        {formatNominalRekonsiliasi(item.totalHarga)}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-3 text-left uppercase text-slate-950">
                        {item.schoolName || namaSekolahHeader}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-white font-bold text-slate-950">
                  <td colSpan={5} className="border border-slate-900 py-2 px-3 text-center uppercase tracking-wider font-extrabold">
                    JUMLAH
                  </td>
                  <td className="border border-slate-900 py-2 px-2.5 text-right font-black whitespace-nowrap">
                    {displayBarangEkstra.length > 0
                      ? formatNominalRekonsiliasi(displayBarangEkstra.reduce((acc, i) => acc + (i.totalHarga || 0), 0))
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-2 px-2"></td>
                </tr>
              </tfoot>
            </table>
          ) : isStockOpname ? (
            <div className="relative">
              {/* Watermark NIHIL di tengah tabel */}
              <div
                aria-hidden="true"
                className="pointer-events-none select-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden pt-10"
              >
                <span className="text-5xl sm:text-7xl font-extrabold uppercase tracking-[0.3em] text-slate-900/20 print:text-slate-900/25">
                  NIHIL
                </span>
              </div>

              <table className="w-full border-collapse border border-slate-900 text-[11px] sm:text-xs relative z-0">
                <thead>
                  <tr className="bg-white text-slate-950 font-bold">
                    <th
                      rowSpan={2}
                      className="border border-slate-900 py-2 px-2.5 text-center align-middle min-w-[230px] uppercase"
                    >
                      BEBAN
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-slate-900 py-2 px-2 text-center align-middle w-24"
                    >
                      Satuan
                    </th>
                    <th
                      colSpan={2}
                      className="border border-slate-900 py-1.5 px-2 text-center align-middle"
                    >
                      Jumlah
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-slate-900 py-2 px-2 text-center align-middle w-28"
                    >
                      Selisih
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-slate-900 py-2 px-2 text-center align-middle w-32"
                    >
                      Kondisi Barang
                    </th>
                  </tr>
                  <tr className="bg-white text-slate-950 font-bold">
                    <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-36">
                      Saldo pada kartu persediaan
                    </th>
                    <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-36">
                      Fisik Barang Hasil
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="h-9">
                      <td className="border border-slate-900 py-2 px-2 text-left text-slate-950">
                        &nbsp;
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center whitespace-nowrap">
                        &nbsp;
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-right whitespace-nowrap">
                        &nbsp;
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-right whitespace-nowrap">
                        &nbsp;
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-right whitespace-nowrap">
                        &nbsp;
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center whitespace-nowrap">
                        &nbsp;
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <table className="w-full border-collapse border border-slate-900 text-[11px] sm:text-xs">
              <thead>
                <tr className="bg-white text-slate-950 font-bold uppercase">
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-2.5 text-center align-middle min-w-[220px]"
                  >
                    JENIS PERSEDIAAN
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-2 text-center align-middle leading-tight w-28"
                  >
                    {labelSaldoAwalHeader}
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-2 text-center align-middle w-28"
                  >
                    BELANJA LRA
                  </th>
                  <th
                    colSpan={2}
                    className="border border-slate-900 py-1.5 px-2 text-center align-middle"
                  >
                    PENGELUARAN
                  </th>
                  <th
                    colSpan={2}
                    className="border border-slate-900 py-1.5 px-2 text-center align-middle"
                  >
                    HIBAH
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-900 py-2 px-2 text-center align-middle leading-tight w-28"
                  >
                    SALDO AKHIR
                  </th>
                </tr>
                <tr className="bg-white text-slate-950 font-bold uppercase">
                  <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-24">
                    SALDO AWAL
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-28">
                    BELANJA
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-20">
                    MASUK
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center align-middle w-20">
                    KELUAR
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.kodeRekening} className="hover:bg-slate-50/70">
                    <td className="border border-slate-900 py-1 px-2 text-left text-slate-950">
                      {row.kodeRekening}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalSaldoAwal > 0
                        ? formatNominalRekonsiliasi(row.nominalSaldoAwal)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalBelanjaLra > 0
                        ? formatNominalRekonsiliasi(row.nominalBelanjaLra)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalPengeluaranSaldoAwal > 0
                        ? formatNominalRekonsiliasi(
                            row.nominalPengeluaranSaldoAwal
                          )
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalPengeluaranBelanja > 0
                        ? formatNominalRekonsiliasi(
                            row.nominalPengeluaranBelanja
                          )
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalHibahMasuk > 0
                        ? formatNominalRekonsiliasi(row.nominalHibahMasuk)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.nominalHibahKeluar > 0
                        ? formatNominalRekonsiliasi(row.nominalHibahKeluar)
                        : ''}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right whitespace-nowrap">
                      {row.sisaNilai !== 0
                        ? formatNominalRekonsiliasi(row.sisaNilai)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white font-bold text-slate-950">
                  <td className="border border-slate-900 py-1.5 px-2 text-left uppercase">
                    SUB TOTAL
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalSaldoAwal > 0
                      ? formatNominalRekonsiliasi(subTotals.nominalSaldoAwal)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalBelanjaLra > 0
                      ? formatNominalRekonsiliasi(subTotals.nominalBelanjaLra)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalPengeluaranSaldoAwal > 0
                      ? formatNominalRekonsiliasi(
                          subTotals.nominalPengeluaranSaldoAwal
                        )
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalPengeluaranBelanja > 0
                      ? formatNominalRekonsiliasi(
                          subTotals.nominalPengeluaranBelanja
                        )
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalHibahMasuk > 0
                      ? formatNominalRekonsiliasi(subTotals.nominalHibahMasuk)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.nominalHibahKeluar > 0
                      ? formatNominalRekonsiliasi(subTotals.nominalHibahKeluar)
                      : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right whitespace-nowrap">
                    {subTotals.sisaNilai !== 0
                      ? formatNominalRekonsiliasi(subTotals.sisaNilai)
                      : '-'}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Signatures Section */}
        {variant === 'barang_ekstra' ? (
          <div className="mt-8 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
            <div className="grid grid-cols-2 gap-6 text-center">
              {/* Left: Pengurus Barang Pembantu */}
              <div className="flex flex-col justify-between min-h-[115px]">
                <div>
                  <p className="font-normal">&nbsp;</p>
                  <p className="font-normal">Pengurus Barang Pembantu,</p>
                </div>
                <div className="mt-14">
                  <p className="font-bold underline">{namaPengurusPembantuFooter}</p>
                  <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                </div>
              </div>

              {/* Right: Mengetahui, Kepala Sekolah */}
              <div className="flex flex-col justify-between min-h-[115px]">
                <div>
                  <p className="font-normal">Mengetahui,</p>
                  <p className="font-normal">Kepala Sekolah,</p>
                </div>
                <div className="mt-14">
                  <p className="font-bold underline">{namaKepsekFooter}</p>
                  <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                </div>
              </div>
            </div>
          </div>
        ) : isStockOpname ? (
          <div className="mt-8 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
            <div className="grid grid-cols-2 gap-6 text-center">
              {/* Left: Mengetahui, Kepala Sekolah */}
              <div className="flex flex-col justify-between min-h-[115px]">
                <div>
                  <p className="font-normal">Mengetahui,</p>
                  <p className="font-normal">Kepala Sekolah,</p>
                </div>
                <div className="mt-14">
                  <p className="font-bold underline">{namaKepsekFooter}</p>
                  <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
                </div>
              </div>

              {/* Right: Pengurus Barang */}
              <div className="flex flex-col justify-between min-h-[115px]">
                <div>
                  <p className="font-normal">&nbsp;</p>
                  <p className="font-normal">Pengurus Barang</p>
                </div>
                <div className="mt-14">
                  <p className="font-bold underline">
                    {namaPengurusBarangFooter}
                  </p>
                  <p className="mt-0.5">NIP. {nipPengurusBarangFooter}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 text-xs sm:text-[13px] text-slate-950 break-inside-avoid">
            <div className="grid grid-cols-2 gap-6 text-center">
              {/* Left: Pengurus Barang Pembantu */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <p className="font-normal">Pengurus Barang Pembantu</p>
                <div className="mt-14">
                  <p className="font-bold underline">
                    {namaPengurusPembantuFooter}
                  </p>
                  <p className="mt-0.5">NIP. {nipPengurusPembantuFooter}</p>
                </div>
              </div>

              {/* Right: Pengurus Barang */}
              <div className="flex flex-col justify-between min-h-[110px]">
                <p className="font-normal">Pengurus Barang</p>
                <div className="mt-14">
                  <p className="font-bold underline">
                    {namaPengurusBarangFooter}
                  </p>
                  <p className="mt-0.5">NIP. {nipPengurusBarangFooter}</p>
                </div>
              </div>
            </div>

            {/* Bottom Center: Mengetahui Kepala Sekolah */}
            <div className="mt-8 text-center flex flex-col items-center justify-between min-h-[115px]">
              <div>
                <p>Mengetahui:</p>
                <p>Kepala Sekolah</p>
              </div>
              <div className="mt-14">
                <p className="font-bold underline">{namaKepsekFooter}</p>
                <p className="mt-0.5">NIP. {nipKepsekFooter}</p>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Bottom Print Button (Hidden in Print) */}
      <div className="print:hidden flex items-center justify-end">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak</span>
        </button>
      </div>
    </div>
  );
};
