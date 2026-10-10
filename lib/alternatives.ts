import { CRITERIA_POOL } from "./criteria";
import type { Alternative, CriterionField } from "./types";

export const MIN_ALTERNATIVES = 2;

export const ALT_VALUE_FIELDS = Array.from(
  new Set(
    CRITERIA_POOL.map((item) => item.kolom).filter((item): item is CriterionField => Boolean(item)),
  ),
);

export function nextAltKode(alts: Alternative[]): string {
  const used = new Set(alts.map((item) => item.kode_bps));
  for (let i = 1; i < 1000; i += 1) {
    const kode = `A${String(i).padStart(3, "0")}`;
    if (!used.has(kode)) return kode;
  }
  return `A${Date.now()}`;
}

export function emptyAlternative(kode_bps: string): Alternative {
  return {
    kode_bps,
    nama: "",
    tipe: "kabupaten",
    provinsi: "Jawa Timur",
    latitude: -7.5,
    longitude: 112.5,
    luas_km2: 0,
    penduduk_2025: 0,
    kepadatan_jiwa_km2: 0,
    kejadian_banjir_2024: 0,
    kejadian_longsor_2024: 0,
    kejadian_cuaca_ekstrem_2024: 0,
    hujan_mm_tahun_2020_2024: 0,
    indeks_bahaya_longsor_inarisk: 0,
    indeks_bahaya_banjir_inarisk: 0,
    irbi_2024: 0,
    irbi_kelas_2024: "",
    indeks_bahaya_longsor_n_sampel: 0,
    indeks_bahaya_longsor_max: 0,
    indeks_bahaya_banjir_n_sampel: 0,
    indeks_bahaya_banjir_max: 0,
  };
}
