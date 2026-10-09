"use client";

import { PRIORITY_COLOR } from "@/lib/geo";
import type { RankedRow } from "@/lib/types";

type Point = {
  kode_bps: string;
  nama: string;
  latitude: number;
  longitude: number;
  kelas?: RankedRow["kelas"];
  rank?: number;
  cc?: number;
};

type Props = {
  points: Point[];
  focusKode?: string | null;
  onFocus?: (kode: string | null) => void;
};

const BOUNDS = {
  minLon: 110.9,
  maxLon: 114.7,
  minLat: -8.85,
  maxLat: -6.7,
};

export function HalftoneJatim({ points, focusKode, onFocus }: Props) {
  const w = 320;
  const h = 220;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[220px] w-full" role="img" aria-label="Peta titik Jawa Timur">
      {points.map((point) => {
        const x =
          ((point.longitude - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * (w - 28) + 14;
        const y =
          (1 - (point.latitude - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * (h - 28) + 14;
        const active = focusKode === point.kode_bps;
        const fill = point.kelas ? PRIORITY_COLOR[point.kelas] : "#111a4a";
        const r = active ? 7 : point.rank === 1 ? 6 : 4.2;
        return (
          <g
            key={point.kode_bps}
            className="cursor-pointer"
            onMouseEnter={() => onFocus?.(point.kode_bps)}
            onMouseLeave={() => onFocus?.(null)}
            onClick={() => onFocus?.(point.kode_bps)}
          >
            {active ? (
              <circle cx={x} cy={y} r={12} fill={fill} opacity={0.16}>
                <title>{point.nama}</title>
              </circle>
            ) : null}
            <circle cx={x} cy={y} r={r} fill={fill} className="transition-all duration-300">
              <title>
                {point.nama}
                {point.rank ? ` · peringkat ${point.rank}` : ""}
              </title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
