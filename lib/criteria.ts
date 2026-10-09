import type { Alternative, Criterion, CriterionDirection } from "./types";

export const CRITERIA_POOL: Criterion[] = [
  {
    kode: "K01",
    nama: "Curah hujan tahunan",
    kolom: "hujan_mm_tahun_2020_2024",
    satuan: "mm/tahun",
    grup: "Pemicu",
    defaultSelected: true,
    deskripsi: "Rata-rata hujan 2020–2024. Semakin tinggi, potensi hidrometeorologi semakin besar.",
  },
  {
    kode: "K02",
    nama: "Kejadian banjir",
    kolom: "kejadian_banjir_2024",
    satuan: "kejadian/tahun",
    grup: "Riwayat",
    defaultSelected: true,
    deskripsi: "Jumlah kejadian banjir 2024 menurut BNPB. Riwayat tinggi menandakan kebutuhan mitigasi.",
  },
  {
    kode: "K03",
    nama: "Kejadian tanah longsor",
    kolom: "kejadian_longsor_2024",
    satuan: "kejadian/tahun",
    grup: "Riwayat",
    defaultSelected: true,
    deskripsi: "Jumlah kejadian longsor 2024 menurut BNPB.",
  },
  {
    kode: "K04",
    nama: "Kepadatan penduduk",
    kolom: "kepadatan_jiwa_km2",
    satuan: "jiwa/km²",
    grup: "Paparan",
    defaultSelected: true,
    deskripsi: "Jiwa terpapar per km². Wilayah padat mendapat prioritas perlindungan lebih tinggi.",
  },
  {
    kode: "K05",
    nama: "Bahaya longsor InaRISK",
    kolom: "indeks_bahaya_longsor_inarisk",
    satuan: "indeks 0–1",
    grup: "Bahaya",
    defaultSelected: true,
    deskripsi: "Indeks bahaya tanah longsor InaRISK, pengganti kemiringan lahan.",
  },
  {
    kode: "K06",
    nama: "Bahaya banjir InaRISK",
    kolom: "indeks_bahaya_banjir_inarisk",
    satuan: "indeks 0–1",
    grup: "Bahaya",
    defaultSelected: false,
    deskripsi: "Indeks bahaya banjir InaRISK. Cocok jika fokus skenario banjir.",
  },
  {
    kode: "K07",
    nama: "Kejadian cuaca ekstrem",
    kolom: "kejadian_cuaca_ekstrem_2024",
    satuan: "kejadian/tahun",
    grup: "Riwayat",
    defaultSelected: false,
    deskripsi: "Angin kencang dan cuaca ekstrem 2024, pemicu turunan banjir/longsor.",
  },
  {
    kode: "K08",
    nama: "Jumlah penduduk",
    kolom: "penduduk_2025",
    satuan: "jiwa",
    grup: "Paparan",
    defaultSelected: false,
    deskripsi: "Paparan absolut. Hindari memakai bersama kepadatan tanpa alasan yang jelas.",
  },
  {
    kode: "K09",
    nama: "IRBI 2024",
    kolom: "irbi_2024",
    satuan: "skor indeks",
    grup: "Indeks",
    defaultSelected: false,
    deskripsi: "Indeks Risiko Bencana Indonesia. Hati-hati jika digabung dengan K05 dan K06 sekaligus.",
  },
  {
    kode: "K10",
    nama: "Puncak bahaya longsor",
    kolom: "indeks_bahaya_longsor_max",
    satuan: "indeks 0–1",
    grup: "Bahaya",
    defaultSelected: false,
    deskripsi: "Nilai bahaya longsor tertinggi di wilayah, bukan rata-rata.",
  },
];

export const DEFAULT_CRITERIA = CRITERIA_POOL.filter((c) => c.defaultSelected).map(
  (c) => c.kode,
);

export const MIN_CRITERIA = 3;

export function criterionArah(item: Criterion): CriterionDirection {
  return item.arah === "cost" ? "cost" : "benefit";
}

export function allCriteria(extras: Criterion[] = []): Criterion[] {
  return [...CRITERIA_POOL, ...extras];
}

export function getCriteria(kodes: string[], extras: Criterion[] = []): Criterion[] {
  const pool = allCriteria(extras);
  return kodes
    .map((kode) => pool.find((item) => item.kode === kode))
    .filter((item): item is Criterion => Boolean(item));
}

export function getCriterionValue(alt: Alternative, criterion: Criterion): number {
  if (criterion.custom) return Number(criterion.values?.[alt.kode_bps]) || 0;
  if (!criterion.kolom) return 0;
  return Number(alt[criterion.kolom]) || 0;
}

export function nextCustomKode(extras: Criterion[]): string {
  const used = new Set(allCriteria(extras).map((item) => item.kode));
  for (let i = 11; i < 100; i += 1) {
    const kode = `K${String(i).padStart(2, "0")}`;
    if (!used.has(kode)) return kode;
  }
  return `KX${Date.now()}`;
}
