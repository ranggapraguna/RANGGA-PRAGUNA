export type Triwulan = 'TW1' | 'TW2' | 'TW3' | 'TW4';

export type BOSSource = 
  | 'BOS Reguler' 
  | 'BOS Kinerja' 
  | 'BOS Daerah (BOSDA)' 
  | 'BOP PAUD/Kesetaraan';

export type KomponenBOS =
  | '1. Penerimaan Peserta Didik Baru (PPDB)'
  | '2. Pengembangan Perpustakaan & Buku Teks'
  | '3. Pelaksanaan Pembelajaran & Ekstrakurikuler'
  | '4. Asesmen & Evaluasi Pembelajaran (ANBK/Ujian)'
  | '5. Administrasi Kegiatan Sekolah & ATK'
  | '6. Langganan Daya & Jasa (Listrik, Internet, Air)'
  | '7. Pemeliharaan Sarana & Prasarana Sekolah'
  | '8. Penyediaan Alat Multimedia Pembelajaran'
  | '9. Pembayaran Honor Tenaga Pendidik/Kependidikan';

export const REKENING_PERSEDIAAN_OPTIONS = [
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ALAT LISTRIK)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (ATK)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN CETAK)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (BAHAN KOMPUTER)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KAPORLAP & PERLENGKAPAN SATWA)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (KERTAS & COVER)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERABOT KANTOR)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERANGKO, MATERAI & BENDA POS LAINNYA)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN DINAS)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERLENGKAPAN PENDUKUNG OLAH RAGA)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (PERSEDIAAN DOKUMEN/ ADMISTRASI TENDER)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR (SUVENIR/ CENDERA MATA)',
  'ALAT/ BAHAN UNTUK KEGIATAN KANTOR LAINNYA',
  'ATACHMENT',
  'BAHAN BAKAR & PELUMAS',
  'BAHAN BAKU',
  'BAHAN BANGUNAN & KONSTRUKSI',
  'BAHAN KIMIA',
  'BAHAN KIMIA NUKLIR',
  'BAHAN LAINNYA',
  'BAHAN PELEDAK',
  'BAHAN/ BIBIT TANAMAN',
  'BAHAN/ BIBIT TERNAK/ BIBIT IKAN',
  'BARANG DALAM PROSES',
  'BARANG UNTUK DIJUAL/ DISERAHKAN KEPADA MASYARAKAT',
  'BARANG UNTUK DIJUAL/ DISERAHKAN LAINNYA',
  'ISI TABUNG GAS',
  'ISI TABUNG PEMADAM KEBAKARAN',
  'KOMPONEN BEKAS',
  'KOMPONEN BEKAS DAN PIPA BEKAS LAINNYA',
  'KOMPONEN JEMBATAN BAJA',
  'KOMPONEN JEMBATAN PRAKTEKAN',
  'KOMPONEN LAINNYA',
  'KOMPONEN PERALATAN',
  'KOMPONEN RAMBU-RAMBU',
  'NATURA',
  'OBAT',
  'OBAT-OBATAN LAINNYA',
  'PAKAN',
  'PAKAN LAINNYA',
  'PERSEDIAAN DALAM PROSES',
  'PERSEDIAAN DALAM PROSES LAINNYA',
  'PERSEDIAAN DARI BELANJA BANTUAN SOSIAL',
  'PERSEDIAAN PENELITIAN BIOLOGI',
  'PERSEDIAAN PENELITIAN BIOLOGI LAINNYA',
  'PERSEDIAAN PENELITIAN LAINNYA',
  'PERSEDIAAN PENELITIAN TEKNOLOGI',
  'PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA',
  'PERSEDIAAN UNTUK TUJUAN STRATEGIS/ BERJAGA-JAGA LAINNYA',
  'PIPA AIR BESI TUANG (DCI)',
  'PIPA ASBES SEMEN (APC)',
  'PIPA BAJA',
  'PIPA BEKAS',
  'PIPA BETON PRAKTEKAN',
  'PIPA FIBER GLASS',
  'PIPA LAINNYA',
  'PIPA PLASTIK PVC (UPVC)',
  'SUKU CADANG ALAT ANGKUTAN',
  'SUKU CADANG ALAT BENGKEL',
  'SUKU CADANG ALAT BESAR',
  'SUKU CADANG ALAT KEDOKTERAN',
  'SUKU CADANG ALAT LABORATORIUM',
  'SUKU CADANG ALAT PEMANCAR',
  'SUKU CADANG ALAT PERSENJATAAN',
  'SUKU CADANG ALAT PERTANIAN',
  'SUKU CADANG ALAT STUDIO & KOMUNIKASI',
];

export type KodeRekening = string;

export type JenisSaldoAwal = 'Saldo Awal' | 'Bukan Saldo Awal';

export type TaxType = 
  | 'Tanpa Pajak' 
  | 'PPN 11%' 
  | 'PPh 21 (Honor 5%)' 
  | 'PPh 22 (Barang 1.5%)' 
  | 'PPh 23 (Jasa 2%)';

export type PaymentMethod = 
  | 'Transfer Bank BPD/BRI' 
  | 'Kas Tunai Bendahara' 
  | 'SIPLah (Marketplace Kemdikbud)' 
  | 'CMS (Corporate Banking)';

export type ExpenseStatus = 
  | 'Draf' 
  | 'Menunggu Verifikasi' 
  | 'Diverifikasi Bendahara' 
  | 'Disetujui Kepala Sekolah';

export interface RincianRekeningItem {
  id: string;
  kodeRekening: KodeRekening;
  saldoAwal: JenisSaldoAwal;
  saldoAwalMasuk?: JenisSaldoAwal;
  saldoAwalKeluar?: JenisSaldoAwal;
  isHibah?: boolean;
  nilaiSaldoAwal?: number;
  nilaiBelanjaLra?: number;
  pengeluaranSaldoAwal?: number;
  pengeluaranBelanja?: number;
  hibahMasuk?: number;
  hibahKeluar?: number;
  nilaiMasuk: number;
  nilaiKeluar: number;
  sisaNilai: number;
}

export interface SchoolExpense {
  id: string;
  tahunAnggaran?: number;
  schoolName?: string;
  npsn?: string;
  noBukti: string;
  tanggal: string; // YYYY-MM-DD
  triwulan: Triwulan;
  sumberDana: BOSSource;
  komponen: KomponenBOS;
  kodeRekening: KodeRekening;
  saldoAwal?: JenisSaldoAwal;
  saldoAwalMasuk?: JenisSaldoAwal;
  saldoAwalKeluar?: JenisSaldoAwal;
  isHibah?: boolean;
  uraian: string;
  penerimaToko: string;
  npwpPenerima?: string;
  metodePembayaran: PaymentMethod;
  volume: number;
  satuan: string;
  hargaSatuan: number;
  subtotal: number;
  nilaiSaldoAwal?: number;
  nilaiBelanjaLra?: number;
  pengeluaranSaldoAwal?: number;
  pengeluaranBelanja?: number;
  hibahMasuk?: number;
  hibahKeluar?: number;
  nilaiMasuk?: number;
  nilaiKeluar?: number;
  sisaNilai?: number;
  rincianItems?: RincianRekeningItem[];
  tipePajak: TaxType;
  nilaiPajak: number;
  totalBersih: number;
  status: ExpenseStatus;
  buktiFotoUrl?: string;
  catatan?: string;
  createdAt: string;
  mergedQuarters?: Triwulan[];
  combinedQuarterLabel?: string;
  sourceExpenseIds?: string[];
  mergedCount?: number;
}

export interface SchoolInfo {
  namaSekolah: string;
  npsn: string;
  alamat: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  bendahara: string;
  nipBendahara: string;
  bendaharaBarang?: string;
  nipBendaharaBarang?: string;
  tahunAnggaran: number;
  totalPaguTahunan: number;
  paguPerTriwulan: Record<Triwulan, number>;
}

export interface QuarterStats {
  pagu: number;
  realisasi: number;
  sisaPagu: number;
  persentaseSerapan: number;
  jumlahTransaksi: number;
  pajakTerpotong: number;
}

export interface BarangEkstraItem {
  id: string;
  tahunAnggaran: number;
  schoolName: string;
  npsn: string;
  namaBarang: string;
  spesifikasi?: string;
  volume: number;
  satuan: string;
  hargaSatuan: number;
  totalHarga: number;
  kondisi: 'Baik' | 'Kurang Baik' | 'Rusak Berat';
  sumberPerolehan: string;
  tanggalPerolehan: string;
  keterangan?: string;
  status: ExpenseStatus;
  createdAt: string;
}
