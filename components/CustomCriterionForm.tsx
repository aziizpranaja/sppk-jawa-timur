"use client";

import { useEffect, useMemo, useState } from "react";
import type { Alternative, Criterion, CriterionDirection } from "@/lib/types";
import { nextCustomKode } from "@/lib/criteria";

type Props = {
  alternatives: Alternative[];
  extras: Criterion[];
  initial?: Criterion | null;
  onSave: (criterion: Criterion) => void;
  onCancel: () => void;
};

function parseNumber(raw: string): number {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return 0;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : 0;
}

function shortName(nama: string) {
  return nama.replace(/^Kabupaten\s+/i, "Kab. ");
}

export function CustomCriterionForm({
  alternatives,
  extras,
  initial,
  onSave,
  onCancel,
}: Props) {
  const kode = initial?.kode ?? nextCustomKode(extras);
  const [nama, setNama] = useState(initial?.nama ?? "");
  const [satuan, setSatuan] = useState(initial?.satuan ?? "");
  const [deskripsi, setDeskripsi] = useState(initial?.deskripsi ?? "");
  const [arah, setArah] = useState<CriterionDirection>(
    initial?.arah === "cost" ? "cost" : "benefit",
  );
  const [paste, setPaste] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const alt of alternatives) {
      const current = initial?.values?.[alt.kode_bps];
      out[alt.kode_bps] = current == null ? "" : String(current);
    }
    return out;
  });

  const filled = useMemo(
    () => alternatives.filter((alt) => values[alt.kode_bps]?.trim()).length,
    [alternatives, values],
  );

  useEffect(() => {
    document.getElementById("panel-kriteria-baru")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  function applyPaste() {
    const lines = paste
      .split(/\r?\n|\t/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (!lines.length) return;
    setValues((current) => {
      const next = { ...current };
      alternatives.forEach((alt, index) => {
        if (lines[index] != null) next[alt.kode_bps] = lines[index];
      });
      return next;
    });
  }

  function save() {
    if (!nama.trim()) return;
    const parsed: Record<string, number> = {};
    for (const alt of alternatives) {
      parsed[alt.kode_bps] = parseNumber(values[alt.kode_bps] ?? "");
    }
    onSave({
      kode,
      nama: nama.trim(),
      satuan: satuan.trim() || "skor",
      grup: "Kustom",
      defaultSelected: false,
      deskripsi: deskripsi.trim() || "Kriteria tambahan yang diisi manual.",
      arah,
      custom: true,
      values: parsed,
    });
  }

  return (
    <div
      id="panel-kriteria-baru"
      className="mt-4 overflow-hidden rounded-[8px] bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
        <div>
          <p className="font-mono text-[12px] text-seafoam-700">{kode} · kustom</p>
          <h3 className="mt-2 text-[20px] leading-[1.1] font-medium tracking-[-0.2px] text-indigo-navy">
            {initial ? "Ubah kriteria" : "Tambah kriteria"}
          </h3>
        </div>
        <p className="max-w-[36ch] text-[13px] leading-5 text-steel">
          {arah === "cost"
            ? "Sel kosong = 0. Semakin besar nilai, semakin rendah prioritas mitigasi."
            : "Sel kosong = 0. Semakin besar nilai, semakin tinggi prioritas mitigasi."}
        </p>
      </header>

      <div className="grid border-t border-silver-lining lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-5 border-b border-silver-lining p-6 lg:border-r lg:border-b-0">
          <label className="block">
            <span className="text-[12px] font-medium tracking-[0.04em] text-steel uppercase">
              Nama
            </span>
            <input
              className="field mt-2"
              value={nama}
              placeholder={
                arah === "cost" ? "Tutupan hutan" : "Persentase kawasan terbangun"
              }
              onChange={(event) => setNama(event.target.value)}
            />
          </label>
          <div>
            <p className="text-[12px] font-medium tracking-[0.04em] text-steel uppercase">Arah</p>
            <div className="mt-2 flex rounded-[8px] border border-silver-lining bg-white p-1">
              <button
                type="button"
                onClick={() => setArah("benefit")}
                className={`flex-1 rounded-[8px] px-3 py-2 text-[14px] ${
                  arah === "benefit" ? "bg-indigo-navy text-white" : "text-steel"
                }`}
              >
                Benefit
              </button>
              <button
                type="button"
                onClick={() => setArah("cost")}
                className={`flex-1 rounded-[8px] px-3 py-2 text-[14px] ${
                  arah === "cost" ? "bg-indigo-navy text-white" : "text-steel"
                }`}
              >
                Cost
              </button>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-steel">
              {arah === "cost"
                ? "Pakai untuk kapasitas atau kondisi yang menekan prioritas, misalnya tutupan hutan."
                : "Pakai untuk bahaya, riwayat, atau paparan yang menaikkan prioritas."}
            </p>
          </div>
          <label className="block">
            <span className="text-[12px] font-medium tracking-[0.04em] text-steel uppercase">
              Satuan
            </span>
            <input
              className="field mt-2"
              value={satuan}
              placeholder="%, kejadian, indeks"
              onChange={(event) => setSatuan(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium tracking-[0.04em] text-steel uppercase">
              Keterangan
            </span>
            <textarea
              className="field mt-2 min-h-[88px] resize-none text-[14px] leading-5"
              value={deskripsi}
              placeholder="Mengapa kriteria ini relevan untuk mitigasi"
              onChange={(event) => setDeskripsi(event.target.value)}
            />
          </label>
        </div>

        <div className="flex min-h-0 flex-col p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[12px] text-seafoam-700">
              {filled}/{alternatives.length} wilayah
            </p>
            <div className="flex items-center gap-4 text-[13px]">
              <button
                type="button"
                className="font-light text-indigo-navy"
                onClick={() =>
                  setValues(Object.fromEntries(alternatives.map((alt) => [alt.kode_bps, "0"])))
                }
              >
                Isi 0 semua
              </button>
            </div>
          </div>

          <details className="mt-4 rounded-[8px] bg-cloud-canvas px-4 py-3">
            <summary className="cursor-pointer text-[13px] text-indigo-navy">
              Tempel dari Excel
            </summary>
            <textarea
              className="field mt-3 min-h-[72px] font-mono text-[12px]"
              value={paste}
              placeholder="Satu angka per baris, urutan sama dengan daftar wilayah"
              onChange={(event) => setPaste(event.target.value)}
            />
            <button type="button" className="btn-ghost mt-3" onClick={applyPaste}>
              Terapkan
            </button>
          </details>

          <div className="mt-4 max-h-[320px] overflow-auto pr-1">
            <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
              {alternatives.map((alt) => (
                <label
                  key={alt.kode_bps}
                  className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-2"
                >
                  <span className="truncate text-[13px] text-indigo-navy" title={alt.nama}>
                    {shortName(alt.nama)}
                  </span>
                  <input
                    className="field field-compact"
                    inputMode="decimal"
                    value={values[alt.kode_bps] ?? ""}
                    placeholder="0"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [alt.kode_bps]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-silver-lining px-6 py-4">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Batal
        </button>
        <button type="button" className="btn-primary" disabled={!nama.trim()} onClick={save}>
          Simpan kriteria
        </button>
      </footer>
    </div>
  );
}
