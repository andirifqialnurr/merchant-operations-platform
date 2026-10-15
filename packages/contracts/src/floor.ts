import * as z from "zod";

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
