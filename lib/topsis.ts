import { criterionArah, getCriterionValue } from "./criteria";
import type { Alternative, Criterion, RankedRow } from "./types";

function vectorNormalize(column: number[]): number[] {
  const denom = Math.sqrt(column.reduce((sum, value) => sum + value * value, 0));
  if (denom === 0) return column.map(() => 0);
  return column.map((value) => value / denom);
}

export function classifyPriority(rank: number, total: number): RankedRow["kelas"] {
  const highCut = Math.max(1, Math.ceil(total * 0.25));
  const midCut = Math.max(highCut + 1, Math.ceil(total * 0.6));
  if (rank <= highCut) return "tinggi";
  if (rank <= midCut) return "sedang";
  return "rendah";
}

export function computeTopsis(
  alternatives: Alternative[],
  criteria: Criterion[],
  weights: Record<string, number>,
): RankedRow[] {
  const n = alternatives.length;
  const m = criteria.length;
  const columns = criteria.map((criterion) =>
    alternatives.map((alt) => getCriterionValue(alt, criterion)),
  );
  const normalized = columns.map(vectorNormalize);
  const weighted = normalized.map((col, j) => {
    const w = weights[criteria[j].kode] ?? 0;
    return col.map((value) => value * w);
  });

  const idealPos = Array.from({ length: m }, (_, j) =>
    criterionArah(criteria[j]) === "cost"
      ? Math.min(...weighted[j])
      : Math.max(...weighted[j]),
  );
  const idealNeg = Array.from({ length: m }, (_, j) =>
    criterionArah(criteria[j]) === "cost"
      ? Math.max(...weighted[j])
      : Math.min(...weighted[j]),
  );

  const result: RankedRow[] = alternatives.map((alt, i) => {
    let dPos = 0;
    let dNeg = 0;
    const scores: Record<string, number> = {};
    for (let j = 0; j < m; j += 1) {
      const value = weighted[j][i];
      scores[criteria[j].kode] = value;
      dPos += (value - idealPos[j]) ** 2;
      dNeg += (value - idealNeg[j]) ** 2;
    }
    dPos = Math.sqrt(dPos);
    dNeg = Math.sqrt(dNeg);
    const cc = dPos + dNeg === 0 ? 0 : dNeg / (dPos + dNeg);
    return {
      ...alt,
      rank: 0,
      cc,
      kelas: "sedang",
      scores,
    };
  });

  result.sort((a, b) => b.cc - a.cc);
  return result.map((row, index) => ({
    ...row,
    rank: index + 1,
    kelas: classifyPriority(index + 1, n),
  }));
}
