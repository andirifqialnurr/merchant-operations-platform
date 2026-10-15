import type { FloorSelectorLabels } from "@merchant/ui/floor-selector";
import type { TableLayoutCanvasLabels } from "@merchant/ui/table-layout-canvas";
import type {
  TableLayoutPropertyPanelLabels,
  TableLayoutToolbarLabels,
} from "@merchant/ui/table-layout-tools";
import type { UnplacedTableTrayLabels } from "@merchant/ui/table-layout-tray";
import type { TableQrManagerLabels } from "@merchant/ui/table-qr";
import type { TableTileMetric, TableTileState } from "@merchant/ui/table-tile";

/** The words the table components receive; in the app they come from the dictionaries. */
export const floorSelectorLabels: FloorSelectorLabels = {
  empty: "Belum ada lantai.",
  placeholder: "Pilih lantai",
  selector: "Pilih lantai",
  tableCount: (count) => `${count} meja`,
};

export const canvasLabels: TableLayoutCanvasLabels = {
  canvas: "Denah meja",
  moveDown: "Geser meja ke bawah",
  moveGroup: "Geser meja terpilih",
  moveLeft: "Geser meja ke kiri",
  moveRight: "Geser meja ke kanan",
  moveUp: "Geser meja ke atas",
  overlap: (first, second) => `${first} menimpa ${second}.`,
  position: (label, column, row, overlapping) =>
    `${label}, kolom ${column}, baris ${row}${overlapping ? ", menimpa meja lain" : ""}`,
  validationTitle: "Ada meja yang saling menimpa",
};

export const trayLabels: UnplacedTableTrayLabels = {
  count: (count) => `${count} meja`,
  empty: "Semua meja sudah ditempatkan.",
  place: (label) => `Tempatkan ${label}`,
  title: "Belum ditempatkan",
};

export const toolbarLabels: TableLayoutToolbarLabels = {
  modeGroup: "Mode denah",
  modes: { edit: "Ubah", preview: "Pratinjau", view: "Lihat" },
  snap: "Tempel ke grid",
  toolGroup: "Alat denah",
  tools: { move: "Geser meja", select: "Pilih meja" },
};

export const propertyPanelLabels: TableLayoutPropertyPanelLabels = {
  column: "Kolom",
  empty: "Pilih meja di denah.",
  height: "Tinggi",
  panel: "Meja terpilih",
  row: "Baris",
  selected: "Meja terpilih",
  width: "Lebar",
};

export const qrLabels: TableQrManagerLabels = {
  generate: "Buat QR",
  preview: (label) => `QR ${label}`,
  print: "Cetak QR",
  region: (label) => `QR meja ${label}`,
  revoke: "Cabut QR",
  rotate: "Rotasi QR",
  status: { active: "Aktif", "not-generated": "Belum dibuat", revoked: "Dicabut" },
};

export const stateLabels: Record<TableTileState, string> = {
  available: "Tersedia",
  cleaning: "Dibersihkan",
  closing: "Menutup",
  disabled: "Nonaktif",
  "needs-service": "Butuh layanan",
  occupied: "Terisi",
  reserved: "Reservasi",
  "waiting-order": "Menunggu konfirmasi",
  "waiting-payment": "Menunggu pembayaran",
};

/** The service numbers of a table, as the app writes them. */
export function serviceMetrics(guests: number, orders: number, minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [
    { kind: "guests", label: `${guests} tamu`, text: String(guests) },
    { kind: "orders", label: `${orders} pesanan`, text: String(orders) },
    {
      kind: "duration",
      label: hours ? `${hours} jam ${rest} menit` : `${minutes} menit`,
      text: hours ? `${hours}j ${rest}m` : `${minutes}m`,
    },
  ] satisfies TableTileMetric[];
}
