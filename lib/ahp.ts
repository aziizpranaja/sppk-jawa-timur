const RI: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
};

export const SAATY_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const SAATY_LABEL: Record<number, string> = {
  1: "Sama penting",
  2: "Mendekati sedikit lebih penting",
  3: "Sedikit lebih penting",
  4: "Mendekati lebih penting",
  5: "Lebih penting",
  6: "Mendekati sangat penting",
  7: "Sangat lebih penting",
  8: "Mendekati mutlak",
  9: "Mutlak lebih penting",
};

export type PairKey = `${string}__${string}`;

export function pairKey(a: string, b: string): PairKey {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

export function listPairs(kodes: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < kodes.length; i += 1) {
    for (let j = i + 1; j < kodes.length; j += 1) {
      pairs.push([kodes[i], kodes[j]]);
    }
  }
  return pairs;
}

export function identityPairs(kodes: string[]): Record<PairKey, number> {
  const out: Record<PairKey, number> = {};
  for (const [a, b] of listPairs(kodes)) {
    out[pairKey(a, b)] = 1;
  }
  return out;
}

export function buildMatrix(kodes: string[], pairs: Record<PairKey, number>): number[][] {
  const n = kodes.length;
  const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => 1));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const key = pairKey(kodes[i], kodes[j]);
      const stored = pairs[key] ?? 1;
      const value = kodes[i] < kodes[j] ? stored : 1 / stored;
      matrix[i][j] = value;
      matrix[j][i] = 1 / value;
    }
  }
  return matrix;
}

export function geometricMeanWeights(matrix: number[][]): number[] {
  const n = matrix.length;
  const raw = matrix.map((row) => Math.pow(row.reduce((acc, value) => acc * value, 1), 1 / n));
  const total = raw.reduce((acc, value) => acc + value, 0);
  return raw.map((value) => value / total);
}

export function lambdaMax(matrix: number[][], weights: number[]): number {
  const n = matrix.length;
  const aw = matrix.map((row) => row.reduce((sum, aij, j) => sum + aij * weights[j], 0));
  return aw.reduce((sum, value, i) => sum + value / weights[i], 0) / n;
}

export type AhpResult = {
  weights: Record<string, number>;
  lambdaMax: number;
  ci: number;
  ri: number;
  cr: number;
  consistent: boolean;
};

export function computeAhp(kodes: string[], pairs: Record<PairKey, number>): AhpResult {
  const matrix = buildMatrix(kodes, pairs);
  const weightList = geometricMeanWeights(matrix);
  const lambda = lambdaMax(matrix, weightList);
  const n = kodes.length;
  const ci = n <= 2 ? 0 : (lambda - n) / (n - 1);
  const ri = RI[n] ?? 1.49;
  const cr = ri === 0 ? 0 : ci / ri;
  const weights: Record<string, number> = {};
  kodes.forEach((kode, i) => {
    weights[kode] = weightList[i];
  });
  return {
    weights,
    lambdaMax: lambda,
    ci,
    ri,
    cr,
    consistent: cr <= 0.1,
  };
}

export function equalWeights(kodes: string[]): Record<string, number> {
  const w = 1 / kodes.length;
  return Object.fromEntries(kodes.map((kode) => [kode, w]));
}

export type PairSide = "left" | "right" | "equal";

export function readPair(
  left: string,
  right: string,
  pairs: Record<PairKey, number>,
): { side: PairSide; intensity: number } {
  const stored = pairs[pairKey(left, right)] ?? 1;
  const leftIsMin = left < right;
  if (Math.abs(stored - 1) < 1e-9) return { side: "equal", intensity: 1 };
  if (stored > 1) {
    return { side: leftIsMin ? "left" : "right", intensity: stored };
  }
  return { side: leftIsMin ? "right" : "left", intensity: 1 / stored };
}

export function writePair(left: string, right: string, side: PairSide, intensity: number): number {
  if (side === "equal") return 1;
  const leftIsMin = left < right;
  const leftWins = side === "left";
  return leftWins === leftIsMin ? intensity : 1 / intensity;
}
