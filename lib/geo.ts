export function shapeNameFor(nama: string, tipe: string): string {
  if (tipe === "kota") return nama;
  return nama.replace(/^Kabupaten\s+/i, "");
}

export const PRIORITY_COLOR = {
  tinggi: "#111a4a",
  sedang: "#167e6c",
  rendah: "#44b48b",
} as const;

export const PRIORITY_LABEL = {
  tinggi: "Prioritas tinggi",
  sedang: "Prioritas sedang",
  rendah: "Prioritas rendah",
} as const;
