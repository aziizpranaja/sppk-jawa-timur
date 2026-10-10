"use client";

import { useEffect, useState } from "react";
import { CRITERIA_POOL } from "@/lib/criteria";
import { ALT_VALUE_FIELDS, emptyAlternative } from "@/lib/alternatives";
import type { Alternative } from "@/lib/types";

type Props = {
  alternatives: Alternative[];
  initial?: Alternative | null;
  nextKode: string;
  onSave: (item: Alternative) => void;
  onCancel: () => void;
};

function parseNumber(raw: string): number {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return 0;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : 0;
}

function labelFor(field: string) {
  const found = CRITERIA_POOL.find((item) => item.kolom === field);
  return found ? `${found.kode} · ${found.nama}` : field;
}

export function AlternativeForm({
  alternatives,
  initial,
  nextKode,
  onSave,
  onCancel,
}: Props) {
  const editing = Boolean(initial);
  const [kode, setKode] = useState(initial?.kode_bps ?? nextKode);
  const [nama, setNama] = useState(initial?.nama ?? "");
  const [tipe, setTipe] = useState<Alternative["tipe"]>(initial?.tipe ?? "kabupaten");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const source = initial ?? emptyAlternative(nextKode);
    const out: Record<string, string> = {};
    for (const field of ALT_VALUE_FIELDS) {
      out[field] = String(Number(source[field]) || 0);
    }
    return out;
  });

  const kodeTaken = alternatives.some(
    (item) => item.kode_bps === kode.trim() && item.kode_bps !== initial?.kode_bps,
  );

  useEffect(() => {
    document.getElementById("panel-wilayah")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  function save() {
    if (!nama.trim() || !kode.trim() || kodeTaken) return;
    const base = initial ?? emptyAlternative(kode.trim());
    const next: Alternative = {
      ...base,
      kode_bps: kode.trim(),
      nama: nama.trim(),
      tipe,
      provinsi: "Jawa Timur",
    };
    for (const field of ALT_VALUE_FIELDS) {
      (next as unknown as Record<string, number | string>)[field] = parseNumber(values[field] ?? "");
    }
    onSave(next);
  }

  return (
    <div id="panel-wilayah" className="mt-4 overflow-hidden rounded-[8px] bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
        <div>
          <p className="font-mono text-[12px] text-seafoam-700">
            {editing ? kode : "wilayah baru"}
          </p>
          <h3 className="mt-2 text-[20px] leading-[1.1] font-medium tracking-[-0.2px] text-indigo-navy">
            {editing ? "Ubah wilayah" : "Tambah wilayah"}
          </h3>
        </div>
        <p className="max-w-[36ch] text-[13px] leading-5 text-steel">
          Isi nama dan nilai kriteria. Wilayah baru ikut ranking jika dicentang.
        </p>
      </header>

      <div className="grid border-t border-silver-lining lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-5 border-b border-silver-lining p-6 lg:border-r lg:border-b-0">
          <label className="block">
            <span className="text-[12px] font-medium tracking-[0.04em] text-steel uppercase">
              Kode
            </span>
            <input
              className="field mt-2"
              value={kode}
              disabled={editing}
              onChange={(event) => setKode(event.target.value)}
            />
            {kodeTaken ? (
              <p className="mt-2 text-[13px] text-signal-orange">Kode sudah dipakai.</p>
            ) : null}
          </label>
          <label className="block">
            <span className="text-[12px] font-medium tracking-[0.04em] text-steel uppercase">
              Nama
            </span>
            <input
              className="field mt-2"
              value={nama}
              placeholder="Kabupaten atau Kota"
              onChange={(event) => setNama(event.target.value)}
            />
          </label>
          <div>
            <p className="text-[12px] font-medium tracking-[0.04em] text-steel uppercase">Tipe</p>
            <div className="mt-2 flex rounded-[8px] border border-silver-lining bg-white p-1">
              <button
                type="button"
                onClick={() => setTipe("kabupaten")}
                className={`flex-1 rounded-[8px] px-3 py-2 text-[14px] ${
                  tipe === "kabupaten" ? "bg-indigo-navy text-white" : "text-steel"
                }`}
              >
                Kabupaten
              </button>
              <button
                type="button"
                onClick={() => setTipe("kota")}
                className={`flex-1 rounded-[8px] px-3 py-2 text-[14px] ${
                  tipe === "kota" ? "bg-indigo-navy text-white" : "text-steel"
                }`}
              >
                Kota
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          {ALT_VALUE_FIELDS.map((field) => (
            <label key={field} className="block">
              <span className="text-[12px] font-medium tracking-[0.04em] text-steel uppercase">
                {labelFor(field)}
              </span>
              <input
                className="field mt-2"
                inputMode="decimal"
                value={values[field] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field]: event.target.value }))
                }
              />
            </label>
          ))}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-silver-lining px-6 py-4">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Batal
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!nama.trim() || !kode.trim() || kodeTaken}
          onClick={save}
        >
          Simpan wilayah
        </button>
      </footer>
    </div>
  );
}
