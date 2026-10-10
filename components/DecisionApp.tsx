"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CRITERIA_POOL,
  DEFAULT_CRITERIA,
  MIN_CRITERIA,
  applyPoolEdits,
  criterionArah,
  getCriteria,
  getCriterionValue,
} from "@/lib/criteria";
import {
  SAATY_LABEL,
  computeAhp,
  equalWeights,
  identityPairs,
  listPairs,
  pairKey,
  readPair,
  writePair,
  type PairKey,
  type PairSide,
} from "@/lib/ahp";
import { computeTopsis } from "@/lib/topsis";
import { buildConclusion } from "@/lib/conclusion";
import { PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/geo";
import type { Alternative, Criterion, RankedRow } from "@/lib/types";
import { SpectrumHalftone } from "@/components/SpectrumHalftone";
import { HalftoneJatim } from "@/components/HalftoneJatim";
import { CustomCriterionForm } from "@/components/CustomCriterionForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { withBase } from "@/lib/paths";

const PriorityMap = dynamic(
  () => import("@/components/PriorityMap").then((mod) => mod.PriorityMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center rounded-[8px] bg-cloud-canvas text-sm text-steel">
        Menyiapkan peta Jawa Timur…
      </div>
    ),
  },
);

type View = "kriteria" | "bobot" | "hasil";
type WeightMode = "ahp" | "equal";

const GROUPS: Criterion["grup"][] = ["Pemicu", "Riwayat", "Paparan", "Bahaya", "Indeks"];

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: digits,
  }).format(value);
}

function sliderFromPref(pref: { side: PairSide; intensity: number }) {
  if (pref.side === "equal") return 8;
  if (pref.side === "left") return 9 - pref.intensity;
  return 7 + pref.intensity;
}

function prefFromSlider(pos: number): { side: PairSide; intensity: number } {
  if (pos === 8) return { side: "equal", intensity: 1 };
  if (pos < 8) return { side: "left", intensity: 9 - pos };
  return { side: "right", intensity: pos - 7 };
}

function downloadCsv(rows: RankedRow[], criteria: Criterion[]) {
  const headers = [
    "peringkat",
    "kode_bps",
    "nama",
    "skor_topsis",
    "kelas",
    ...criteria.map((item) => item.kode),
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.rank,
        row.kode_bps,
        `"${row.nama}"`,
        row.cc.toFixed(4),
        row.kelas,
        ...criteria.map((item) => String(getCriterionValue(row, item))),
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ranking-sppk-jatim.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function DecisionApp() {
  const [data, setData] = useState<Alternative[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [view, setView] = useState<View>("kriteria");
  const [selected, setSelected] = useState<string[]>(DEFAULT_CRITERIA);
  const [mode, setMode] = useState<WeightMode>("ahp");
  const [pairs, setPairs] = useState<Record<PairKey, number>>(
    identityPairs(DEFAULT_CRITERIA),
  );
  const [scrolled, setScrolled] = useState(false);
  const [focusKode, setFocusKode] = useState<string | null>(null);
  const [extras, setExtras] = useState<Criterion[]>([]);
  const [poolEdits, setPoolEdits] = useState<Record<string, Criterion>>({});
  const [extrasReady, setExtrasReady] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingCustom, setEditingCustom] = useState<Criterion | null>(null);

  useEffect(() => {
    void fetch(withBase("/data/alternatives_jatim.json"))
      .then((response) => {
        if (!response.ok) throw new Error("Gagal memuat data");
        return response.json() as Promise<Alternative[]>;
      })
      .then((rows) => {
        setData(rows);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setFocusKode(null);
  }, [view]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("sppk-custom-criteria");
      if (raw) {
        const parsed = JSON.parse(raw) as Criterion[];
        if (Array.isArray(parsed)) {
          setExtras(
            parsed
              .filter((item) => item?.custom && item.kode)
              .map((item) => ({
                ...item,
                arah: item.arah === "cost" ? "cost" : "benefit",
              })),
          );
        }
      }
      const editsRaw = sessionStorage.getItem("sppk-pool-edits");
      if (editsRaw) {
        const parsed = JSON.parse(editsRaw) as Record<string, Criterion>;
        if (parsed && typeof parsed === "object") {
          const next: Record<string, Criterion> = {};
          for (const item of Object.values(parsed)) {
            if (item?.kode && CRITERIA_POOL.some((pool) => pool.kode === item.kode)) {
              next[item.kode] = item;
            }
          }
          setPoolEdits(next);
        }
      }
    } catch {
      /* abaikan cache rusak */
    }
    setExtrasReady(true);
  }, []);

  useEffect(() => {
    if (!extrasReady) return;
    sessionStorage.setItem("sppk-custom-criteria", JSON.stringify(extras));
    sessionStorage.setItem("sppk-pool-edits", JSON.stringify(poolEdits));
  }, [extras, poolEdits, extrasReady]);

  const criteria = useMemo(
    () => getCriteria(selected, extras, poolEdits),
    [selected, extras, poolEdits],
  );
  const ahp = useMemo(() => computeAhp(selected, pairs), [selected, pairs]);
  const weights = useMemo(
    () => (mode === "equal" ? equalWeights(selected) : ahp.weights),
    [mode, selected, ahp.weights],
  );
  const ranking = useMemo(
    () => (data.length && criteria.length ? computeTopsis(data, criteria, weights) : []),
    [data, criteria, weights],
  );
  const top = ranking[0];
  const canContinueCriteria = selected.length >= MIN_CRITERIA;
  const focused = ranking.find((row) => row.kode_bps === focusKode) ?? top;

  function toggleCriterion(kode: string) {
    setSelected((current) => {
      const exists = current.includes(kode);
      if (exists) {
        if (current.length <= MIN_CRITERIA) return current;
        const next = current.filter((item) => item !== kode);
        setPairs((old) => {
          const fresh = identityPairs(next);
          for (const key of Object.keys(fresh) as PairKey[]) {
            if (old[key] != null) fresh[key] = old[key];
          }
          return fresh;
        });
        return next;
      }
      const next = [...current, kode];
      setPairs((old) => {
        const fresh = identityPairs(next);
        for (const key of Object.keys(fresh) as PairKey[]) {
          if (old[key] != null) fresh[key] = old[key];
        }
        return fresh;
      });
      return next;
    });
  }

  function applyPreset(kind: "banjir" | "longsor" | "default") {
    const next =
      kind === "default"
        ? DEFAULT_CRITERIA
        : kind === "banjir"
          ? ["K01", "K02", "K04", "K06", "K07"]
          : ["K01", "K03", "K04", "K05", "K10"];
    setSelected(next);
    setPairs(identityPairs(next));
  }

  function syncPairs(next: string[]) {
    setPairs((old) => {
      const fresh = identityPairs(next);
      for (const key of Object.keys(fresh) as PairKey[]) {
        if (old[key] != null) fresh[key] = old[key];
      }
      return fresh;
    });
  }

  function saveCustom(item: Criterion) {
    const isPool = CRITERIA_POOL.some((entry) => entry.kode === item.kode) && !item.custom;
    if (isPool) {
      setPoolEdits((current) => ({ ...current, [item.kode]: item }));
      setShowCustomForm(false);
      setEditingCustom(null);
      return;
    }
    setExtras((current) => {
      const exists = current.some((entry) => entry.kode === item.kode);
      return exists
        ? current.map((entry) => (entry.kode === item.kode ? item : entry))
        : [...current, item];
    });
    setSelected((current) => {
      if (current.includes(item.kode)) return current;
      const next = [...current, item.kode];
      syncPairs(next);
      return next;
    });
    setShowCustomForm(false);
    setEditingCustom(null);
  }

  function removeCustom(kode: string) {
    setExtras((current) => current.filter((item) => item.kode !== kode));
    setSelected((current) => {
      const next = current.filter((item) => item !== kode);
      syncPairs(next);
      return next;
    });
    if (editingCustom?.kode === kode) {
      setEditingCustom(null);
      setShowCustomForm(false);
    }
  }

  function setPair(left: string, right: string, side: PairSide, intensity: number) {
    const key = pairKey(left, right);
    const value = writePair(left, right, side, intensity);
    setPairs((old) => ({ ...old, [key]: value }));
  }

  function go(next: View) {
    if (next === "kriteria") setView("kriteria");
    if (next === "bobot" && canContinueCriteria) setView("bobot");
    if (next === "hasil" && canContinueCriteria) setView("hasil");
  }

  return (
    <div className="min-h-screen bg-cloud-canvas">
      <header
        className={`fixed inset-x-0 top-0 z-30 h-[62px] transition-colors duration-300 ${
          scrolled || view !== "kriteria"
            ? "nav-scrolled border-b border-silver-lining bg-white/80 backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        <div className="page-wrap flex h-full items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => go("kriteria")}
          >
            <img
              src={withBase("/logo.png")}
              alt="Logo SPPK Jawa Timur"
              width={40}
              height={40}
              className="h-10 w-10 rounded-[8px] bg-white object-contain"
            />
            <div>
              <p className="text-[12px] font-medium tracking-[0.14em] text-steel uppercase">
                Tools Pendukung Keputusan Jawa Timur
              </p>
              <p className="text-[14px] font-medium text-indigo-navy">Mitigasi Banjir & Longsor</p>
            </div>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main>
        {loadState === "error" ? (
          <p className="page-wrap mt-24 rounded-[8px] bg-white p-4 text-[14px] text-signal-orange shadow-sm">
            Data wilayah gagal dimuat. Muat ulang halaman.
          </p>
        ) : null}
        {view === "kriteria" ? (
          <CriteriaStep
            selected={selected}
            extras={extras}
            poolEdits={poolEdits}
            alternatives={data}
            canContinue={canContinueCriteria}
            showCustomForm={showCustomForm}
            editingCustom={editingCustom}
            onToggle={toggleCriterion}
            onPreset={applyPreset}
            onNext={() => go("bobot")}
            onOpenForm={() => {
              setEditingCustom(null);
              setShowCustomForm(true);
            }}
            onEditCustom={(item) => {
              setEditingCustom(item);
              setShowCustomForm(true);
            }}
            onRemoveCustom={removeCustom}
            onSaveCustom={saveCustom}
            onCancelForm={() => {
              setShowCustomForm(false);
              setEditingCustom(null);
            }}
            ranking={ranking}
            focusKode={focusKode}
            onFocus={setFocusKode}
            preview={focused}
          />
        ) : null}
        {view === "bobot" ? (
          <WeightStep
            selected={selected}
            criteria={criteria}
            mode={mode}
            pairs={pairs}
            ahp={ahp}
            weights={weights}
            ranking={ranking}
            onMode={setMode}
            onPair={setPair}
            onBack={() => go("kriteria")}
            onNext={() => go("hasil")}
          />
        ) : null}
        {view === "hasil" ? (
          <ResultsStep
            ranking={ranking}
            selected={selected}
            criteria={criteria}
            weights={weights}
            cr={mode === "ahp" ? ahp.cr : 0}
            lambdaMax={mode === "ahp" ? ahp.lambdaMax : selected.length}
            consistent={mode === "equal" || ahp.consistent}
            mode={mode}
            focusKode={focusKode}
            onFocus={setFocusKode}
            onBack={() => go("bobot")}
            onReset={() => go("kriteria")}
          />
        ) : null}
      </main>

      <footer className="mt-[72px] border-t border-silver-lining bg-white">
        <div className="page-wrap grid gap-8 py-12 md:grid-cols-2">
          <div>
            <p className="text-[14px] font-medium text-indigo-navy">SPPK Jawa Timur</p>
            <p className="mt-2 max-w-[48ch] text-[14px] text-steel">
              Alat bantu prioritas mitigasi banjir dan longsor. Bukan pengganti kajian resmi
              IRBI atau InaRISK.
            </p>
          </div>
          <p className="font-mono text-[12px] leading-6 text-fog md:text-right">
            <span className="code-key">sumber</span>
            {" = "}
            <span className="code-string">BNPB/DIBI 2024, InaRISK, Kepmendagri 2025, ERA5</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

function CriteriaStep({
  selected,
  extras,
  poolEdits,
  alternatives,
  canContinue,
  showCustomForm,
  editingCustom,
  onToggle,
  onPreset,
  onNext,
  onOpenForm,
  onEditCustom,
  onRemoveCustom,
  onSaveCustom,
  onCancelForm,
  ranking,
  focusKode,
  onFocus,
  preview,
}: {
  selected: string[];
  extras: Criterion[];
  poolEdits: Record<string, Criterion>;
  alternatives: Alternative[];
  canContinue: boolean;
  showCustomForm: boolean;
  editingCustom: Criterion | null;
  onToggle: (kode: string) => void;
  onPreset: (kind: "banjir" | "longsor" | "default") => void;
  onNext: () => void;
  onOpenForm: () => void;
  onEditCustom: (item: Criterion) => void;
  onRemoveCustom: (kode: string) => void;
  onSaveCustom: (item: Criterion) => void;
  onCancelForm: () => void;
  ranking: RankedRow[];
  focusKode: string | null;
  onFocus: (kode: string | null) => void;
  preview?: RankedRow;
}) {
  return (
    <>
      <section className="relative overflow-hidden pt-[110px] pb-[72px]">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block">
          <SpectrumHalftone />
        </div>
        <div className="page-wrap relative grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,1fr)] lg:gap-16">
          <div className="hero-copy animate-rise py-2 pr-6 lg:pr-10">
            <h1 className="text-[40px] leading-[1.08] font-semibold tracking-[-0.8px] text-indigo-navy md:text-[52px] md:tracking-[-1.56px]">
              Prioritas mitigasi
              <br />
              yang bisa diuji ulang.
            </h1>
            <p className="mt-5 max-w-[42ch] text-[18px] leading-[1.33] font-light text-steel">
              Pilih kriteria, geser kepentingan, lalu lihat 38 kabupaten/kota Jawa Timur
              berubah urutan secara langsung.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary" disabled={!canContinue} onClick={onNext}>
                Mulai pembobotan
                <span aria-hidden>→</span>
              </button>
              <button type="button" className="btn-secondary" onClick={() => onPreset("default")}>
                Set default
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" className="btn-ghost" onClick={() => onPreset("banjir")}>
                Fokus banjir
              </button>
              <button type="button" className="btn-ghost" onClick={() => onPreset("longsor")}>
                Fokus longsor
              </button>
            </div>
          </div>

          <article className="card-widget relative z-10 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[12px] text-seafoam-700">Peringkat 1 sementara</p>
                <p
                  key={preview?.kode_bps ?? "empty"}
                  className="mt-2 text-[20px] leading-[1.1] font-medium tracking-[-0.2px] text-indigo-navy"
                >
                  {preview ? preview.nama.replace("Kabupaten ", "") : "Memuat data"}
                </p>
              </div>
              <p className="font-mono text-[20px] leading-none text-seafoam-700">
                {preview ? formatNumber(preview.cc, 3) : "—"}
              </p>
            </div>
            <div className="mt-4 overflow-hidden rounded-[8px] bg-cloud-canvas">
              <HalftoneJatim points={ranking} focusKode={focusKode} onFocus={onFocus} />
            </div>
            <ul className="mt-4 space-y-2">
              {ranking.slice(0, 3).map((row) => (
                <li key={row.kode_bps}>
                  <button
                    type="button"
                    onMouseEnter={() => onFocus(row.kode_bps)}
                    onMouseLeave={() => onFocus(null)}
                    onClick={() => onFocus(row.kode_bps)}
                    className={`flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left text-[13px] transition ${
                      focusKode === row.kode_bps ? "bg-cloud-canvas" : "hover:bg-cloud-canvas/80"
                    }`}
                  >
                    <span className="text-indigo-navy">
                      <span className="mr-2 font-mono text-seafoam-700">{row.rank}</span>
                      {row.nama.replace("Kabupaten ", "")}
                    </span>
                    <span className="font-mono text-seafoam-700">{formatNumber(row.cc, 3)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="page-wrap relative mt-[72px] grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4 md:gap-12">
          <Stat label="Wilayah studi" value="38" />
          <Stat label="Kriteria terpilih" value={String(selected.length)} />
          <Stat label="Pool kriteria" value={String(10 + extras.length)} />
          <Stat label="Metode" value="AHP" />
        </div>
      </section>

      <section className="page-wrap mt-[72px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[28px] leading-[1.1] font-medium tracking-[-0.28px] text-indigo-navy">
              Parameter yang ikut dihitung
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[14px] text-steel">
              {selected.length} dipilih · minimal {MIN_CRITERIA}
            </p>
            <button type="button" className="btn-ghost" onClick={onOpenForm}>
              + Tambah kriteria
            </button>
          </div>
        </div>

        {showCustomForm ? (
          <CustomCriterionForm
            alternatives={alternatives}
            extras={extras}
            initial={editingCustom}
            onSave={onSaveCustom}
            onCancel={onCancelForm}
          />
        ) : null}

        {GROUPS.map((grup) => {
          const items = applyPoolEdits(poolEdits).filter((item) => item.grup === grup);
          if (!items.length) return null;
          return (
            <div key={grup} className="mt-10">
              <p className="tag-dot">
                <i />
                {grup}
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {items.map((item, index) => {
                  const active = selected.includes(item.kode);
                  return (
                    <div
                      key={item.kode}
                      className={`card-interactive animate-rise p-6 ${active ? "is-on" : ""}`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <button type="button" className="w-full text-left" onClick={() => onToggle(item.kode)}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-mono text-[12px] text-seafoam-700">
                              {item.kode} · {criterionArah(item)}
                            </p>
                            <h3 className="mt-2 text-[20px] leading-[1.1] font-medium tracking-[-0.2px] text-indigo-navy">
                              {item.nama}
                            </h3>
                          </div>
                          <span
                            className={`grid h-6 w-6 place-items-center rounded-[8px] text-[12px] transition ${
                              active ? "bg-indigo-navy text-white" : "bg-cloud-canvas text-fog"
                            }`}
                          >
                            {active ? "✓" : "+"}
                          </span>
                        </div>
                        <p className="mt-3 text-[14px] leading-5 text-steel">{item.deskripsi}</p>
                        <p className="mt-4 font-mono text-[12px] text-fog">{item.satuan}</p>
                      </button>
                      <div className="mt-4">
                        <button
                          type="button"
                          className="text-[13px] font-light text-indigo-navy"
                          onClick={() => onEditCustom(item)}
                        >
                          Ubah
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="mt-10">
          <p className="tag-dot">
            <i />
            Kustom
          </p>
          {extras.length === 0 ? (
            <p className="mt-3 text-[14px] text-steel">
              Belum ada kriteria tambahan. Gunakan tombol tambah jika terpikir parameter lain.
            </p>
          ) : extras.length ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {extras.map((item, index) => {
                const active = selected.includes(item.kode);
                return (
                  <div
                    key={item.kode}
                    className={`card-interactive animate-rise p-6 ${active ? "is-on" : ""}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <button type="button" className="w-full text-left" onClick={() => onToggle(item.kode)}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-mono text-[12px] text-seafoam-700">
                            {item.kode} · {criterionArah(item)}
                          </p>
                          <h3 className="mt-2 text-[20px] leading-[1.1] font-medium tracking-[-0.2px] text-indigo-navy">
                            {item.nama}
                          </h3>
                        </div>
                        <span
                          className={`grid h-6 w-6 place-items-center rounded-[8px] text-[12px] transition ${
                            active ? "bg-indigo-navy text-white" : "bg-cloud-canvas text-fog"
                          }`}
                        >
                          {active ? "✓" : "+"}
                        </span>
                      </div>
                      <p className="mt-3 text-[14px] leading-5 text-steel">{item.deskripsi}</p>
                      <p className="mt-4 font-mono text-[12px] text-fog">{item.satuan}</p>
                    </button>
                    <div className="mt-4 flex gap-3 text-[13px]">
                      <button
                        type="button"
                        className="font-light text-indigo-navy"
                        onClick={() => onEditCustom(item)}
                      >
                        Ubah nilai
                      </button>
                      <button
                        type="button"
                        className="font-light text-steel"
                        onClick={() => onRemoveCustom(item.kode)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mt-10 flex justify-end">
          <button type="button" className="btn-primary" disabled={!canContinue} onClick={onNext}>
            Lanjutkan ke pembobotan
            <span aria-hidden>→</span>
          </button>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[28px] leading-none font-medium text-seafoam-700">{value}</p>
      <p className="mt-2 text-[14px] text-steel">{label}</p>
    </div>
  );
}

function CodePreview({ ranking, selected }: { ranking: RankedRow[]; selected: string[] }) {
  const lead = ranking[0];
  return (
    <pre className="code-block animate-rise">
      <span>{"{"}</span>
      {"\n  "}
      <span className="code-key">"metode"</span>
      {": "}
      <span className="code-string">"AHP-TOPSIS"</span>
      {",\n  "}
      <span className="code-key">"kriteria"</span>
      {": ["}
      {selected.map((kode, i) => (
        <span key={kode}>
          {i ? ", " : ""}
          <span className="code-string">"{kode}"</span>
        </span>
      ))}
      {"],\n  "}
      <span className="code-key">"peringkat_1"</span>
      {": "}
      <span className="code-string">"{lead?.nama ?? "..."}"</span>
      {",\n  "}
      <span className="code-key">"cci"</span>
      {": "}
      <span className="code-num">{lead ? lead.cc.toFixed(3) : "0"}</span>
      {"\n"}
      <span>{"}"}</span>
    </pre>
  );
}

function WeightStep({
  selected,
  criteria,
  mode,
  pairs,
  ahp,
  weights,
  ranking,
  onMode,
  onPair,
  onBack,
  onNext,
}: {
  selected: string[];
  criteria: Criterion[];
  mode: WeightMode;
  pairs: Record<PairKey, number>;
  ahp: ReturnType<typeof computeAhp>;
  weights: Record<string, number>;
  ranking: RankedRow[];
  onMode: (mode: WeightMode) => void;
  onPair: (left: string, right: string, side: PairSide, intensity: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const named = criteria;
  const chart = named.map((item) => ({
    name: item.kode,
    bobot: Number(((weights[item.kode] ?? 0) * 100).toFixed(1)),
  }));
  const consistent = mode === "equal" || ahp.consistent;

  return (
    <section className="page-wrap pt-[110px]">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="animate-rise">
          <p className="tag-dot">
            <i />
            Pembobotan kepentingan
          </p>
          <h1 className="mt-4 text-[40px] leading-[1.1] font-semibold tracking-[-0.8px] text-indigo-navy">
            Mana yang lebih penting?
          </h1>
          <p className="mt-3 max-w-[52ch] text-[16px] text-steel">
            Geser titik ke kriteria yang lebih penting. Bobot dan rasio konsistensi dihitung
            langsung.
          </p>
        </div>
        <div className="flex rounded-[8px] border border-silver-lining bg-white p-1">
          <button
            type="button"
            onClick={() => onMode("ahp")}
            className={`rounded-[8px] px-4 py-2 text-[14px] ${mode === "ahp" ? "bg-indigo-navy text-white" : "text-steel"}`}
          >
            AHP
          </button>
          <button
            type="button"
            onClick={() => onMode("equal")}
            className={`rounded-[8px] px-4 py-2 text-[14px] ${mode === "equal" ? "bg-indigo-navy text-white" : "text-steel"}`}
          >
            Bobot sama
          </button>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4">
          {mode === "equal" ? (
            <div className="card-bordered p-6">
              <p className="text-[16px] text-indigo-navy">
                Setiap kriteria mendapat bobot yang sama. Cocok untuk uji awal, lalu bandingkan
                dengan AHP.
              </p>
            </div>
          ) : (
            listPairs(selected).map(([left, right], index) => {
              const leftItem = named.find((item) => item.kode === left)!;
              const rightItem = named.find((item) => item.kode === right)!;
              const pref = readPair(left, right, pairs);
              const slider = sliderFromPref(pref);
              return (
                <article
                  key={`${left}-${right}`}
                  className="card-bordered animate-rise p-6"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <p className="font-mono text-[12px] text-fog">Perbandingan {index + 1}</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                    <button
                      type="button"
                      onClick={() => onPair(left, right, "left", pref.side === "left" ? pref.intensity : 3)}
                      className={`rounded-[8px] border p-4 text-left transition ${
                        pref.side === "left"
                          ? "border-indigo-navy bg-cloud-canvas"
                          : "border-silver-lining hover:border-indigo-navy/40"
                      }`}
                    >
                      <p className="font-mono text-[12px] text-seafoam-700">{leftItem.kode}</p>
                      <p className="mt-1 text-[16px] font-medium text-indigo-navy">{leftItem.nama}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onPair(left, right, "equal", 1)}
                      className={`rounded-[8px] px-3 py-2 font-mono text-[12px] ${
                        pref.side === "equal" ? "bg-indigo-navy text-white" : "text-steel"
                      }`}
                    >
                      1
                    </button>
                    <button
                      type="button"
                      onClick={() => onPair(left, right, "right", pref.side === "right" ? pref.intensity : 3)}
                      className={`rounded-[8px] border p-4 text-left transition md:text-right ${
                        pref.side === "right"
                          ? "border-indigo-navy bg-cloud-canvas"
                          : "border-silver-lining hover:border-indigo-navy/40"
                      }`}
                    >
                      <p className="font-mono text-[12px] text-seafoam-700">{rightItem.kode}</p>
                      <p className="mt-1 text-[16px] font-medium text-indigo-navy">{rightItem.nama}</p>
                    </button>
                  </div>
                  <input
                    className="saaty mt-6"
                    type="range"
                    min={0}
                    max={16}
                    step={1}
                    value={slider}
                    aria-label={`Kepentingan ${leftItem.nama} versus ${rightItem.nama}`}
                    onChange={(event) => {
                      const next = prefFromSlider(Number(event.target.value));
                      onPair(left, right, next.side, next.intensity);
                    }}
                  />
                  <div className="mt-2 flex justify-between font-mono text-[10px] text-fog">
                    <span>9</span>
                    <span>5</span>
                    <span>1</span>
                    <span>5</span>
                    <span>9</span>
                  </div>
                  <p className="mt-3 text-[13px] text-steel">
                    {pref.side === "equal"
                      ? "Kedua kriteria sama penting."
                      : `${pref.side === "left" ? leftItem.nama : rightItem.nama}: ${SAATY_LABEL[pref.intensity]}`}
                  </p>
                </article>
              );
            })
          )}
        </div>

        <aside className="card-widget h-fit p-6 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-medium text-indigo-navy">Konsistensi AHP</p>
            <span
              className={`rounded-full px-3 py-1 text-[12px] ${
                consistent ? "bg-seafoam-400/40 text-seafoam-700" : "bg-peach-glow/30 text-signal-orange"
              }`}
            >
              CR {mode === "equal" ? "0,00" : formatNumber(ahp.cr, 3)}
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-cloud-canvas">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                consistent ? "bg-seafoam-700" : "bg-signal-orange"
              }`}
              style={{ width: `${Math.min(100, mode === "equal" ? 8 : (ahp.cr / 0.2) * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-[13px] text-steel">
            {mode === "equal"
              ? "Mode bobot sama tidak memakai matriks pairwise."
              : ahp.consistent
                ? "Perbandingan cukup konsisten (CR ≤ 0,10)."
                : "CR di atas 0,10. Geser beberapa pasangan agar lebih andal."}
          </p>
          <div className="mt-6 h-44 text-steel">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={42}
                  tick={{ fill: "currentColor", fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Bobot"]}
                  contentStyle={{ borderRadius: 8, borderColor: "currentColor", background: "var(--color-cloud-canvas)", color: "var(--color-slate-ink)" }}
                />
                <Bar dataKey="bobot" fill="#167e6c" radius={[0, 4, 4, 0]} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-3">
            {named.map((item) => (
              <li key={item.kode}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-steel">
                    {item.kode} {item.nama}
                    <span className="ml-1 font-mono text-[11px] text-fog">{criterionArah(item)}</span>
                  </span>
                  <span className="font-mono text-seafoam-700">
                    {formatNumber((weights[item.kode] ?? 0) * 100, 1)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cloud-canvas">
                  <div
                    className="h-full rounded-full bg-seafoam-700 transition-all duration-500"
                    style={{ width: `${(weights[item.kode] ?? 0) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[13px] text-steel">
            Pratinjau peringkat 1:{" "}
            <span className="font-medium text-indigo-navy">{ranking[0]?.nama ?? "—"}</span>
          </p>
        </aside>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Kembali
        </button>
        <div className="flex flex-col items-end gap-2">
          {mode === "ahp" && !ahp.consistent ? (
            <p className="max-w-[36ch] text-right text-[12px] text-signal-orange">
              CR di atas 0,10. Ranking tetap bisa dilihat, tetapi bobot kurang andal.
            </p>
          ) : null}
          <button type="button" className="btn-accent" onClick={onNext}>
            Lihat hasil prioritas
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function ResultsStep({
  ranking,
  selected,
  criteria,
  weights,
  cr,
  lambdaMax,
  consistent,
  mode,
  focusKode,
  onFocus,
  onBack,
  onReset,
}: {
  ranking: RankedRow[];
  selected: string[];
  criteria: Criterion[];
  weights: Record<string, number>;
  cr: number;
  lambdaMax: number;
  consistent: boolean;
  mode: WeightMode;
  focusKode: string | null;
  onFocus: (kode: string | null) => void;
  onBack: () => void;
  onReset: () => void;
}) {
  const named = criteria;
  const high = ranking.filter((row) => row.kelas === "tinggi");
  const lead = ranking[0];
  const spark = ranking.slice(0, 8).map((row) => row.cc);
  const conclusion = buildConclusion({
    ranking,
    criteria,
    weights,
    mode,
    cr,
    consistent,
  });

  return (
    <section className="page-wrap pt-[110px]">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="animate-rise">
          <p className="tag-dot">
            <i />
            Hasil prioritas
          </p>
          <h1 className="mt-4 max-w-[18ch] text-[40px] leading-[1.1] font-semibold tracking-[-0.8px] text-indigo-navy">
            {lead ? lead.nama : "Hasil ranking"}
          </h1>
          <p className="mt-3 max-w-[54ch] text-[16px] text-steel">
            {lead
              ? `${lead.nama} paling dekat ke solusi ideal untuk kombinasi ini. Ubah kriteria atau bobot untuk menguji skenario lain.`
              : "Menghitung ranking."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={onBack}>
            Ubah bobot
          </button>
          <button type="button" className="btn-primary" onClick={() => downloadCsv(ranking, criteria)}>
            Unduh CSV
          </button>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {lead ? (
          <article className="rounded-[8px] bg-signal-orange p-6 text-white animate-pop">
            <p className="font-mono text-[12px] text-white/80">Peringkat 1</p>
            <h2 className="mt-2 text-[24px] leading-none font-medium">{lead.nama}</h2>
            <p className="mt-3 font-mono text-[18px]">{formatNumber(lead.cc, 3)}</p>
            <Sparkline values={spark} />
            <p className="mt-2 text-[13px] text-white/80">
              Utamakan mitigasi struktural dan non-struktural.
            </p>
          </article>
        ) : null}
        {ranking.slice(1, 3).map((row, index) => (
          <article
            key={row.kode_bps}
            className="card-bordered animate-rise cursor-pointer p-6"
            style={{ animationDelay: `${(index + 1) * 80}ms` }}
            onMouseEnter={() => onFocus(row.kode_bps)}
            onMouseLeave={() => onFocus(null)}
            onClick={() => onFocus(row.kode_bps)}
          >
            <p className="font-mono text-[12px] text-seafoam-700">Peringkat {row.rank}</p>
            <h2 className="mt-2 text-[24px] leading-none font-medium text-indigo-navy">{row.nama}</h2>
            <p className="mt-3 font-mono text-[18px] text-seafoam-700">{formatNumber(row.cc, 3)}</p>
            <p className="mt-4 text-[13px] text-steel">Pantau rutin dan siapkan kapasitas lokal.</p>
          </article>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-12 md:grid-cols-4">
        <Stat label="Skor TOPSIS" value={lead ? formatNumber(lead.cc, 3) : "—"} />
        <Stat
          label="Konsistensi"
          value={mode === "equal" ? "Sama" : consistent ? "Layak" : "Perbaiki"}
        />
        <Stat label="Prioritas tinggi" value={String(high.length)} />
        <Stat label="Kriteria" value={String(selected.length)} />
      </div>

      <div className="mt-[72px] grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="card-bordered overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-[20px] font-medium tracking-[-0.2px] text-indigo-navy">
              Peta prioritas
            </h2>
            <div className="flex gap-3 text-[12px] text-steel">
              {(["tinggi", "sedang", "rendah"] as const).map((kelas) => (
                <span key={kelas} className="flex items-center gap-1.5">
                  <i
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: PRIORITY_COLOR[kelas] }}
                  />
                  {PRIORITY_LABEL[kelas]}
                </span>
              ))}
            </div>
          </div>
          <PriorityMap rows={ranking} selectedKode={focusKode} onSelect={onFocus} />
        </div>

        <div className="space-y-4">
          <div className="card-bordered p-6">
            <h2 className="text-[20px] font-medium tracking-[-0.2px] text-indigo-navy">
              Bobot terpakai
            </h2>
            <ul className="mt-5 space-y-4">
              {named.map((item) => (
                <li key={item.kode}>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-indigo-navy">
                      {item.kode} {item.nama}
                      <span className="ml-1 font-mono text-[11px] text-fog">{criterionArah(item)}</span>
                    </span>
                    <span className="font-mono text-seafoam-700">
                      {formatNumber((weights[item.kode] ?? 0) * 100, 1)}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cloud-canvas">
                    <div
                      className="animate-bar h-full rounded-full bg-seafoam-700"
                      style={{ width: `${(weights[item.kode] ?? 0) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 font-mono text-[12px] text-fog">
              {mode === "ahp"
                ? `λmax ${formatNumber(lambdaMax, 3)} · CR ${formatNumber(cr, 3)}`
                : "Mode bobot sama rata"}
            </p>
          </div>
          <CodePreview ranking={ranking} selected={selected} />
        </div>
      </div>

      <div className="mt-10 overflow-x-auto card-bordered">
        <table className="min-w-full text-left text-[14px]">
          <thead className="bg-cloud-canvas text-[12px] tracking-wide text-steel uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Wilayah</th>
              <th className="px-4 py-3 font-medium">Skor</th>
              <th className="px-4 py-3 font-medium">Kelas</th>
              {named.map((item) => (
                <th key={item.kode} className="px-4 py-3 font-medium">
                  {item.kode}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranking.map((row) => {
              const active = focusKode === row.kode_bps;
              return (
                <tr
                  key={row.kode_bps}
                  id={`row-${row.kode_bps}`}
                  className={`cursor-pointer border-t border-silver-lining transition-colors ${
                    active ? "bg-sky-cyan/20" : "hover:bg-cloud-canvas/80"
                  }`}
                  onMouseEnter={() => onFocus(row.kode_bps)}
                  onMouseLeave={() => onFocus(null)}
                  onClick={() => onFocus(row.kode_bps)}
                >
                  <td className="px-4 py-3 font-mono text-seafoam-700">{row.rank}</td>
                  <td className="px-4 py-3 text-indigo-navy">{row.nama}</td>
                  <td className="px-4 py-3 font-mono">{formatNumber(row.cc, 3)}</td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-[12px] text-white"
                      style={{ background: PRIORITY_COLOR[row.kelas] }}
                    >
                      {row.kelas}
                    </span>
                  </td>
                  {named.map((item) => {
                    const value = getCriterionValue(row, item);
                    return (
                      <td key={item.kode} className="px-4 py-3 font-mono text-steel">
                        {formatNumber(value, value > 20 ? 0 : 2)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {conclusion ? (
        <section className="mt-[72px]">
          <p className="tag-dot">
            <i />
            Kesimpulan
          </p>
          <h2 className="mt-3 text-[28px] leading-[1.1] font-medium tracking-[-0.28px] text-indigo-navy">
            Keputusan prioritas
          </h2>

          <div className="mt-6 overflow-hidden rounded-[8px] bg-white shadow-sm">
            <div className="grid gap-6 border-b border-silver-lining p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:p-8">
              <div>
                <p className="text-[12px] font-medium tracking-[0.14em] text-steel uppercase">
                  Prioritas utama
                </p>
                <p className="mt-2 text-[28px] leading-[1.1] font-medium tracking-[-0.28px] text-indigo-navy">
                  {conclusion.leadName}
                </p>
                <p className="mt-2 font-mono text-[16px] text-seafoam-700">
                  Skor {conclusion.leadScore}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-4">
                <div>
                  <dt className="text-[12px] text-steel">Tinggi</dt>
                  <dd className="mt-1 font-mono text-[20px] text-seafoam-700">{conclusion.highCount}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-steel">Sedang</dt>
                  <dd className="mt-1 font-mono text-[20px] text-seafoam-700">{conclusion.midCount}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-steel">Rendah</dt>
                  <dd className="mt-1 font-mono text-[20px] text-seafoam-700">{conclusion.lowCount}</dd>
                </div>
              </dl>
            </div>

            <div className="grid gap-0 lg:grid-cols-2">
              <div className="border-b border-silver-lining p-6 md:p-8 lg:border-r lg:border-b-0">
                <p className="text-[12px] font-medium tracking-[0.14em] text-steel uppercase">
                  Wilayah kelas tinggi
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {conclusion.highNames.map((nama) => (
                    <span
                      key={nama}
                      className="rounded-full bg-cloud-canvas px-3 py-1.5 text-[13px] text-indigo-navy"
                    >
                      {nama}
                    </span>
                  ))}
                </div>
                <p className="mt-6 text-[12px] font-medium tracking-[0.14em] text-steel uppercase">
                  Tiga besar
                </p>
                <ol className="mt-3 space-y-2">
                  {conclusion.topThree.map((item) => (
                    <li key={item.rank} className="flex items-center justify-between text-[14px]">
                      <span className="text-indigo-navy">
                        <span className="mr-2 font-mono text-seafoam-700">{item.rank}</span>
                        {item.nama}
                      </span>
                      <span className="font-mono text-seafoam-700">{item.skor}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="p-6 md:p-8">
                <p className="text-[12px] font-medium tracking-[0.14em] text-steel uppercase">
                  Mengapa
                </p>
                <ul className="mt-4 space-y-4">
                  <li>
                    <p className="text-[12px] text-steel">Metode</p>
                    <p className="mt-1 text-[15px] text-indigo-navy">{conclusion.methodLabel}</p>
                  </li>
                  <li>
                    <p className="text-[12px] text-steel">Bobot terbesar</p>
                    <p className="mt-1 text-[15px] text-indigo-navy">
                      {conclusion.heaviest.nama} · {conclusion.heaviest.bobot}
                    </p>
                  </li>
                  {conclusion.drivers.length ? (
                    <li>
                      <p className="text-[12px] text-steel">Faktor unggul peringkat 1</p>
                      <ul className="mt-1 space-y-1">
                        {conclusion.drivers.map((item) => (
                          <li key={item.nama} className="text-[15px] text-indigo-navy">
                            {item.nama}
                            <span className="ml-2 font-mono text-[13px] text-seafoam-700">
                              {item.value} {item.satuan}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>

            <div className="border-t border-silver-lining p-6 md:p-8">
              <p className="text-[12px] font-medium tracking-[0.14em] text-steel uppercase">
                Rekomendasi
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {conclusion.actions.map((item) => (
                  <div key={item.title} className="rounded-[8px] bg-cloud-canvas p-4">
                    <p className="text-[14px] font-medium text-indigo-navy">{item.title}</p>
                    <p className="mt-2 text-[14px] leading-5 text-steel">{item.body}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-[14px] leading-5 text-steel">{conclusion.watch}</p>
              <p
                className={`mt-4 text-[13px] leading-5 ${
                  conclusion.consistent ? "text-fog" : "text-signal-orange"
                }`}
              >
                {conclusion.caveat}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <button type="button" className="btn-secondary" onClick={onReset}>
          Mulai skenario baru
        </button>
        <p className="font-mono text-[12px] text-fog">
          CR {formatNumber(cr, 3)} · {selected.length} kriteria
        </p>
      </div>
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 0.001);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 22 - (value / max) * 18;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 24" className="mt-4 h-8 w-full" aria-hidden>
      <polyline points={points} fill="none" stroke="white" strokeOpacity="0.65" strokeWidth="1.5" />
    </svg>
  );
}
