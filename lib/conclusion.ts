import { criterionArah, getCriterionValue } from "./criteria";
import type { Criterion, RankedRow } from "./types";

const FLOOD_CODES = new Set(["K01", "K02", "K06", "K07"]);
const SLIDE_CODES = new Set(["K03", "K05", "K10"]);

export type ConclusionAction = {
  title: string;
  body: string;
};

export type Conclusion = {
  leadName: string;
  leadScore: string;
  highCount: number;
  midCount: number;
  lowCount: number;
  highNames: string[];
  topThree: Array<{ rank: number; nama: string; skor: string }>;
  methodLabel: string;
  heaviest: { nama: string; bobot: string };
  drivers: Array<{ nama: string; value: string; satuan: string }>;
  actions: ConclusionAction[];
  watch: string;
  caveat: string;
  consistent: boolean;
};

function formatId(value: number, digits = 1) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(value);
}

function drivers(
  lead: RankedRow,
  ranking: RankedRow[],
  criteria: Criterion[],
  weights: Record<string, number>,
) {
  return criteria
    .map((criterion) => {
      const values = ranking.map((row) => getCriterionValue(row, criterion));
      const mean = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
      const value = getCriterionValue(lead, criterion);
      const arah = criterionArah(criterion);
      const lift =
        arah === "cost"
          ? value === 0
            ? mean > 0
              ? Number.POSITIVE_INFINITY
              : 0
            : mean / value
          : mean === 0
            ? 0
            : value / mean;
      return { criterion, value, lift, weight: weights[criterion.kode] ?? 0 };
    })
    .sort((a, b) => b.lift * b.weight - a.lift * a.weight)
    .slice(0, 2);
}

export function buildConclusion({
  ranking,
  criteria,
  weights,
  mode,
  cr,
  consistent,
}: {
  ranking: RankedRow[];
  criteria: Criterion[];
  weights: Record<string, number>;
  mode: "ahp" | "equal";
  cr: number;
  consistent: boolean;
}): Conclusion | null {
  if (!ranking.length || !criteria.length) return null;

  const high = ranking.filter((row) => row.kelas === "tinggi");
  const mid = ranking.filter((row) => row.kelas === "sedang");
  const low = ranking.filter((row) => row.kelas === "rendah");
  const lead = ranking[0];
  const heaviest = [...criteria].sort(
    (a, b) => (weights[b.kode] ?? 0) - (weights[a.kode] ?? 0),
  )[0];
  const leadDrivers = drivers(lead, ranking, criteria, weights);
  const kodes = new Set(criteria.map((item) => item.kode));
  const flood = [...kodes].some((kode) => FLOOD_CODES.has(kode));
  const slide = [...kodes].some((kode) => SLIDE_CODES.has(kode));
  const exposure = kodes.has("K04") || kodes.has("K08");

  const actions: ConclusionAction[] = [];
  if (flood) {
    actions.push({
      title: "Banjir",
      body: "Perkuat drainase, jaga sempadan sungai, dan pasang peringatan dini di titik langganan genangan.",
    });
  }
  if (slide) {
    actions.push({
      title: "Longsor",
      body: "Utamakan vegetasi atau terasering, batasi bangun di lereng, dan siapkan jalur evakuasi lokal.",
    });
  }
  if (exposure) {
    actions.push({
      title: "Paparan",
      body: "Lindungi hunian, sekolah, dan pasar dengan peta evakuasi serta titik pengungsian yang sudah disepakati.",
    });
  }
  if (criteria.some((item) => item.custom)) {
    actions.push({
      title: "Kriteria kustom",
      body: "Angka tambahan ikut mendorong ranking. Uji sumbernya sebelum dipakai untuk alokasi anggaran.",
    });
  }
  if (!actions.length) {
    actions.push({
      title: "Intervensi",
      body: "Fokuskan kerja pada kelas tinggi, lalu uji ulang setelah kriteria atau bobot diubah.",
    });
  }

  return {
    leadName: lead.nama,
    leadScore: formatId(lead.cc, 3),
    highCount: high.length,
    midCount: mid.length,
    lowCount: low.length,
    highNames: high.map((row) => row.nama.replace(/^Kabupaten\s+/i, "Kab. ")),
    topThree: ranking.slice(0, 3).map((row) => ({
      rank: row.rank,
      nama: row.nama.replace(/^Kabupaten\s+/i, "Kab. "),
      skor: formatId(row.cc, 3),
    })),
    methodLabel: mode === "equal" ? "Bobot sama rata" : `AHP · CR ${formatId(cr, 3)}`,
    heaviest: {
      nama: heaviest.nama,
      bobot: `${formatId((weights[heaviest.kode] ?? 0) * 100, 1)}%`,
    },
    drivers: leadDrivers.map((item) => ({
      nama: item.criterion.nama,
      value: formatId(item.value, item.value > 20 ? 0 : 2),
      satuan: item.criterion.satuan,
    })),
    actions,
    watch: "Kelas sedang dipantau dan diperkuat kesiapsiagaan. Kelas rendah bukan berarti aman, hanya lebih rendah pada skenario ini.",
    caveat:
      mode === "ahp" && !consistent
        ? `CR ${formatId(cr, 3)} masih di atas 0,10. Perbaiki perbandingan AHP sebelum memakai kesimpulan ini. Bukan pengganti IRBI/InaRISK.`
        : "Alat bantu untuk skenario yang dipilih. Bukan pengganti kajian resmi IRBI atau InaRISK.",
    consistent: mode === "equal" || consistent,
  };
}
