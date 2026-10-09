"use client";

import { useEffect, useMemo, useRef } from "react";
import type { RankedRow } from "@/lib/types";
import { PRIORITY_COLOR, shapeNameFor } from "@/lib/geo";
import { withBase } from "@/lib/paths";

type Props = {
  rows: RankedRow[];
  selectedKode?: string | null;
  onSelect?: (kode: string | null) => void;
};

export function PriorityMap({ rows, selectedKode, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const layerRef = useRef<import("leaflet").GeoJSON | null>(null);
  const selectedRef = useRef(selectedKode);
  const onSelectRef = useRef(onSelect);
  selectedRef.current = selectedKode;
  onSelectRef.current = onSelect;

  const lookup = useMemo(() => {
    const map = new Map<string, RankedRow>();
    for (const row of rows) {
      map.set(shapeNameFor(row.nama, row.tipe), row);
      map.set(row.nama, row);
    }
    return map;
  }, [rows]);

  function paint(featureLayer: import("leaflet").Layer, name: string) {
    const row = lookup.get(name);
    const selected = row?.kode_bps === selectedRef.current;
    const path = featureLayer as import("leaflet").Path;
    path.setStyle({
      color: selected ? "#111a4a" : "#ffffff",
      weight: selected ? 2.4 : 1,
      fillColor: row ? PRIORITY_COLOR[row.kelas] : "#cbcccf",
      fillOpacity: selected ? 0.92 : 0.78,
    });
    if (selected && "bringToFront" in path) path.bringToFront();
  }

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    async function draw() {
      const L = await import("leaflet");
      if (cancelled || !el) return;
      map = L.map(el, {
        scrollWheelZoom: false,
        attributionControl: true,
      }).setView([-7.7, 112.6], 8);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri &mdash; peta dasar",
          maxZoom: 16,
        },
      ).addTo(map);

      const geo = await fetch(withBase("/data/jatim_kabkota.geojson")).then((r) => r.json());
      if (cancelled || !map) return;

      const layer = L.geoJSON(geo, {
        style(feature) {
          const name = String(feature?.properties?.shapeName ?? "");
          const row = lookup.get(name);
          const selected = row?.kode_bps === selectedRef.current;
          return {
            color: selected ? "#111a4a" : "#ffffff",
            weight: selected ? 2.4 : 1,
            fillColor: row ? PRIORITY_COLOR[row.kelas] : "#cbcccf",
            fillOpacity: selected ? 0.92 : 0.78,
          };
        },
        onEachFeature(feature, featureLayer) {
          const name = String(feature.properties?.shapeName ?? "");
          const row = lookup.get(name);
          const html = row
            ? `<strong>${row.nama}</strong><br/>Peringkat ${row.rank} · skor ${row.cc.toFixed(3)}<br/>${row.kelas}`
            : name;
          featureLayer.bindTooltip(html, { sticky: true, className: "sppk-tip" });
          featureLayer.on({
            mouseover() {
              if (row) onSelectRef.current?.(row.kode_bps);
              paint(featureLayer, name);
            },
            mouseout() {
              onSelectRef.current?.(null);
              paint(featureLayer, name);
            },
            click() {
              if (row) onSelectRef.current?.(row.kode_bps);
            },
          });
        },
      }).addTo(map);

      layerRef.current = layer;
      map.fitBounds(layer.getBounds().pad(0.04));
      window.setTimeout(() => map?.invalidateSize(), 180);
    }

    void draw();
    return () => {
      cancelled = true;
      layerRef.current = null;
      map?.remove();
    };
  }, [lookup]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer((featureLayer) => {
      const feature = (featureLayer as import("leaflet").Layer & {
        feature?: { properties?: { shapeName?: string } };
      }).feature;
      const name = String(feature?.properties?.shapeName ?? "");
      paint(featureLayer, name);
    });
  }, [selectedKode, lookup]);

  return <div ref={host} className="h-[520px] w-full overflow-hidden rounded-[8px]" />;
}
