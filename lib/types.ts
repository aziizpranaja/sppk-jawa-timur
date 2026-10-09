export type Alternative = {
  kode_bps: string;
  nama: string;
  tipe: "kabupaten" | "kota";
  provinsi: string;
  latitude: number;
  longitude: number;
  luas_km2: number;
  penduduk_2025: number;
  kepadatan_jiwa_km2: number;
  kejadian_banjir_2024: number;
  kejadian_longsor_2024: number;
  kejadian_cuaca_ekstrem_2024: number;
  hujan_mm_tahun_2020_2024: number;
  indeks_bahaya_longsor_inarisk: number;
  indeks_bahaya_banjir_inarisk: number;
  irbi_2024: number;
  irbi_kelas_2024: string;
  indeks_bahaya_longsor_n_sampel: number;
  indeks_bahaya_longsor_max: number;
  indeks_bahaya_banjir_n_sampel: number;
  indeks_bahaya_banjir_max: number;
};

export type CriterionField = keyof Alternative;

export type CriterionGroup =
  | "Pemicu"
  | "Riwayat"
  | "Paparan"
  | "Bahaya"
  | "Indeks"
  | "Kustom";

export type CriterionDirection = "benefit" | "cost";

export type Criterion = {
  kode: string;
  nama: string;
  kolom?: CriterionField;
  satuan: string;
  grup: CriterionGroup;
  defaultSelected: boolean;
  deskripsi: string;
  arah?: CriterionDirection;
  custom?: boolean;
  values?: Record<string, number>;
};

export type RankedRow = Alternative & {
  rank: number;
  cc: number;
  kelas: "tinggi" | "sedang" | "rendah";
  scores: Record<string, number>;
};
