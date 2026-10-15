import * as z from "zod";

import { moneyMinorSchema } from "./money.ts";
import { orderStatusSchema } from "./orders.ts";

/** Floors, areas, and tables can be set aside without being deleted. */
export const floorRecordStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const floorTableShapeSchema = z.enum(["SQUARE", "RECTANGLE", "ROUND"]);

export const floorTableSizeSchema = z.enum(["SMALL", "MEDIUM", "LARGE"]);

const floorNameSchema = z.string().trim().min(1).max(80);

export const floorAreaSchema = z
  .object({
    displayOrder: z.number().int().min(0),
    floorId: z.uuid(),
    id: z.uuid(),
    name: floorNameSchema,
    status: floorRecordStatusSchema,
  })
  .strict();

/** A floor of one outlet with its areas, in the order staff see them. */
export const floorSchema = z
  .object({
    areas: z.array(floorAreaSchema),
    displayOrder: z.number().int().min(0),
    /** The layout grid, in logical cells. */
    gridCols: z.number().int().min(8).max(60),
    gridRows: z.number().int().min(8).max(60),
    id: z.uuid(),
    name: floorNameSchema,
    outletId: z.uuid(),
    status: floorRecordStatusSchema,
  })
  .strict();

export const floorListSchema = z.object({ floors: z.array(floorSchema) }).strict();

export const createFloorSchema = z.object({ name: floorNameSchema }).strict();

/** Rename, set aside, or bring back. At least one of the two. */
export const updateFloorSchema = z
  .object({ name: floorNameSchema.optional(), status: floorRecordStatusSchema.optional() })
  .strict()
  .refine((value) => value.name !== undefined || value.status !== undefined, {
    message: "Nothing to change.",
  });

export const createFloorAreaSchema = createFloorSchema;

export const updateFloorAreaSchema = updateFloorSchema;

/** Every floor of the outlet, or every area of the floor, in the new order. */
export const reorderFloorItemsSchema = z
  .object({ ids: z.array(z.uuid()).min(1).max(100) })
  .strict()
  .refine((value) => new Set(value.ids).size === value.ids.length, {
    message: "An item is listed twice.",
    path: ["ids"],
  });

export type CreateFloor = z.infer<typeof createFloorSchema>;

export type CreateFloorArea = z.infer<typeof createFloorAreaSchema>;

export type Floor = z.infer<typeof floorSchema>;

export type FloorArea = z.infer<typeof floorAreaSchema>;

export type FloorList = z.infer<typeof floorListSchema>;

export type FloorRecordStatus = z.infer<typeof floorRecordStatusSchema>;

export type FloorTableShape = z.infer<typeof floorTableShapeSchema>;

export type FloorTableSize = z.infer<typeof floorTableSizeSchema>;

export type ReorderFloorItems = z.infer<typeof reorderFloorItemsSchema>;

export type UpdateFloor = z.infer<typeof updateFloorSchema>;

export type UpdateFloorArea = z.infer<typeof updateFloorAreaSchema>;

export const floorTableRotationSchema = z.union([z.literal(0), z.literal(90)]);

export type FloorTableFootprint = { gridH: number; gridW: number };

/**
 * How many grid cells a table takes. In Basic the footprint follows from its
 * shape and size; free resizing is a Pro capability (`floor.layout.advanced`).
 * A quarter turn swaps width and height.
 */
const FLOOR_TABLE_FOOTPRINTS: Record<
  FloorTableShape,
  Record<FloorTableSize, FloorTableFootprint>
> = {
  RECTANGLE: {
    LARGE: { gridH: 3, gridW: 6 },
    MEDIUM: { gridH: 2, gridW: 4 },
    SMALL: { gridH: 2, gridW: 3 },
  },
  ROUND: {
    LARGE: { gridH: 4, gridW: 4 },
    MEDIUM: { gridH: 3, gridW: 3 },
    SMALL: { gridH: 2, gridW: 2 },
  },
  SQUARE: {
    LARGE: { gridH: 4, gridW: 4 },
    MEDIUM: { gridH: 3, gridW: 3 },
    SMALL: { gridH: 2, gridW: 2 },
  },
};

export function floorTableFootprint(
  shape: FloorTableShape,
  size: FloorTableSize,
  rotation: FloorTableRotation,
): FloorTableFootprint {
  const base = FLOOR_TABLE_FOOTPRINTS[shape][size];
  return rotation === 90 ? { gridH: base.gridW, gridW: base.gridH } : base;
}

const tableLabelSchema = z.string().trim().min(1).max(20);
const capacitySchema = z.number().int().min(1).max(50);
const gridCellSchema = z.number().int().min(0).max(59);

/** A table as staff see it. The footprint is derived, never typed in. */
export const floorTableSchema = z
  .object({
    areaId: z.uuid(),
    capacity: capacitySchema,
    gridH: z.number().int().min(1).max(12),
    gridW: z.number().int().min(1).max(12),
    /** Both empty while the table waits in the "not placed" tray. */
    gridX: gridCellSchema.nullable(),
    gridY: gridCellSchema.nullable(),
    id: z.uuid(),
    label: tableLabelSchema,
    qrOrdering: z.boolean(),
    rotation: floorTableRotationSchema,
    shape: floorTableShapeSchema,
    status: floorRecordStatusSchema,
    visualSize: floorTableSizeSchema,
  })
  .strict();

export const floorTableListSchema = z.object({ tables: z.array(floorTableSchema) }).strict();

/** A new table starts in the tray of its area's floor. */
export const createFloorTableSchema = z
  .object({
    areaId: z.uuid(),
    capacity: capacitySchema,
    label: tableLabelSchema,
    shape: floorTableShapeSchema,
    visualSize: floorTableSizeSchema,
  })
  .strict();

/** One table as the editor leaves it: where it stands and what it is. */
export const floorTableLayoutSchema = z
  .object({
    areaId: z.uuid(),
    capacity: capacitySchema,
    gridX: gridCellSchema.nullable(),
    gridY: gridCellSchema.nullable(),
    id: z.uuid(),
    label: tableLabelSchema,
    qrOrdering: z.boolean(),
    rotation: floorTableRotationSchema,
    shape: floorTableShapeSchema,
    status: floorRecordStatusSchema,
    visualSize: floorTableSizeSchema,
  })
  .strict()
  .refine((value) => (value.gridX === null) === (value.gridY === null), {
    message: "A table is either placed or in the tray.",
    path: ["gridX"],
  });

/** The tables of one floor that changed in the editor; the others stay as they are. */
export const saveFloorLayoutSchema = z
  .object({ tables: z.array(floorTableLayoutSchema).min(1).max(200) })
  .strict()
  .refine((value) => new Set(value.tables.map((table) => table.id)).size === value.tables.length, {
    message: "A table is listed twice.",
    path: ["tables"],
  });

export type CreateFloorTable = z.infer<typeof createFloorTableSchema>;

export type FloorTable = z.infer<typeof floorTableSchema>;

export type FloorTableLayout = z.infer<typeof floorTableLayoutSchema>;

export type FloorTableList = z.infer<typeof floorTableListSchema>;

export type FloorTableRotation = z.infer<typeof floorTableRotationSchema>;

export type SaveFloorLayout = z.infer<typeof saveFloorLayoutSchema>;

/**
 * Whether guests can be seated, worked out from the table's sessions and
 * settings; never stored or typed in.
 */
export const floorTableStatusSchema = z.enum([
  "AVAILABLE",
  "OCCUPIED",
  "CLOSING",
  "CLEANING",
  "INACTIVE",
]);

export const tableSessionStatusSchema = z.enum(["OPEN", "CLOSING", "CLOSED"]);

/** One party's visit, as staff see it. */
export const tableSessionSchema = z
  .object({
    displayNumber: z.number().int().min(1),
    guestCount: z.number().int().min(1).max(99),
    id: z.uuid(),
    openedAt: z.iso.datetime(),
    status: tableSessionStatusSchema,
    /** The tables it holds, the primary one first; none once a closed visit let them go. */
    tableIds: z.array(z.uuid()),
  })
  .strict();

/** What guests at a table ask for from its QR. */
export const serviceRequestTypeSchema = z.enum(["WAITER", "BILL"]);

/** A guest's request that staff have not marked done yet. */
export const serviceRequestSchema = z
  .object({
    id: z.uuid(),
    requestedAt: z.iso.datetime(),
    sessionId: z.uuid(),
    type: serviceRequestTypeSchema,
  })
  .strict();

/** A table on the live view: where it is, and whether it is free. */
export const liveTableSchema = z
  .object({
    areaId: z.uuid(),
    capacity: capacitySchema,
    gridH: z.number().int().min(1).max(12),
    gridW: z.number().int().min(1).max(12),
    gridX: gridCellSchema.nullable(),
    gridY: gridCellSchema.nullable(),
    id: z.uuid(),
    label: tableLabelSchema,
    sessionId: z.uuid().nullable(),
    shape: floorTableShapeSchema,
    status: floorTableStatusSchema,
  })
  .strict();

export const floorPolicySchema = z
  .object({
    /** A closed table is "cleaning" until someone marks it free. */
    cleaningAfterClose: z.boolean(),
  })
  .strict();

/** Everything the cashier's table view shows, read at once. */
export const liveFloorSchema = z
  .object({
    /** Whether the package lets a visit take more tables (`floor.table_session.merge_split`, Pro). */
    canMergeTables: z.boolean(),
    floors: z.array(floorSchema),
    policy: floorPolicySchema,
    /** Open requests of guests still seated, oldest first. */
    requests: z.array(serviceRequestSchema),
    sessions: z.array(tableSessionSchema),
    tables: z.array(liveTableSchema),
  })
  .strict();

/** Where the guests move to; the visit, its orders, and its bill stay as they are. */
export const moveTableSessionSchema = z.object({ tableId: z.uuid() }).strict();

export const openTableSessionSchema = z
  .object({ guestCount: z.number().int().min(1).max(99), tableId: z.uuid() })
  .strict();

export type FloorPolicy = z.infer<typeof floorPolicySchema>;

export type FloorTableStatus = z.infer<typeof floorTableStatusSchema>;

export type LiveFloor = z.infer<typeof liveFloorSchema>;

export type LiveTable = z.infer<typeof liveTableSchema>;

export type MoveTableSession = z.infer<typeof moveTableSessionSchema>;

export type OpenTableSession = z.infer<typeof openTableSessionSchema>;

export type ServiceRequest = z.infer<typeof serviceRequestSchema>;

export type ServiceRequestType = z.infer<typeof serviceRequestTypeSchema>;

export type TableSession = z.infer<typeof tableSessionSchema>;

export type TableSessionStatus = z.infer<typeof tableSessionStatusSchema>;

/** One order of a table visit as the cashier sees it: what, how much, and whether paid. */
export const tableSessionOrderSchema = z
  .object({
    createdAt: z.iso.datetime(),
    id: z.uuid(),
    lines: z.array(
      z.object({ name: z.string().min(1), quantity: z.number().int().min(1) }).strict(),
    ),
    orderNumber: z.number().int().min(1),
    paid: z.boolean(),
    status: orderStatusSchema,
    /** With the outlet's tax and service: paid amount once paid, otherwise as of now. */
    totalMinor: moneyMinorSchema,
  })
  .strict();

/** A visit with its orders and what is still owed. */
export const tableSessionDetailSchema = z
  .object({
    /** What the guests still owe, canceled orders aside. */
    dueMinor: moneyMinorSchema,
    orders: z.array(tableSessionOrderSchema),
    session: tableSessionSchema,
    /** The label of the table the visit sits at. */
    tableLabel: z.string().nullable(),
  })
  .strict();

export type TableSessionDetail = z.infer<typeof tableSessionDetailSchema>;

export type TableSessionOrder = z.infer<typeof tableSessionOrderSchema>;

export const tableQrStatusSchema = z.enum(["NOT_GENERATED", "ACTIVE", "REVOKED"]);

/**
 * A table's QR as staff manage it. The address in it is only given to those
 * who may print it; it is never shown to guests any other way.
 */
export const tableQrSchema = z
  .object({
    status: tableQrStatusSchema,
    /** The address the QR opens, while it works. */
    url: z.url().nullable(),
    /** Goes up with every rotation; printed QR of an older version no longer work. */
    version: z.number().int().min(1).nullable(),
  })
  .strict();

export type TableQr = z.infer<typeof tableQrSchema>;

export type TableQrStatus = z.infer<typeof tableQrStatusSchema>;
