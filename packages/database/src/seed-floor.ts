/**
 * Lays out two floors of tables in every outlet of a development workspace,
 * so the table screens have something to show. Development only: it writes
 * straight to the floor tables without audit entries.
 *
 * Usage: pnpm db:seed:floor [tenant-slug]
 * Safe to run again: floors, areas, and tables already there are kept.
 */
import { createPrismaClient } from "./client.ts";

type Shape = "RECTANGLE" | "ROUND" | "SQUARE";
type Size = "LARGE" | "MEDIUM" | "SMALL";

/**
 * Footprints follow apps/api/src/modules/floor/domain/layout.ts: a table's
 * shape and size decide its cells, a quarter turn swaps width and height.
 */
const FOOTPRINT: Record<Shape, Record<Size, readonly [w: number, h: number]>> = {
  RECTANGLE: { LARGE: [6, 3], MEDIUM: [4, 2], SMALL: [3, 2] },
  ROUND: { LARGE: [4, 4], MEDIUM: [3, 3], SMALL: [2, 2] },
  SQUARE: { LARGE: [4, 4], MEDIUM: [3, 3], SMALL: [2, 2] },
};

type TableSeed = {
  at?: readonly [x: number, y: number];
  capacity: number;
  label: string;
  rotation?: 0 | 90;
  shape: Shape;
  size: Size;
};

const LAYOUT: ReadonlyArray<{
  areas: ReadonlyArray<{ name: string; tables: readonly TableSeed[] }>;
  name: string;
}> = [
  {
    areas: [
      {
        name: "Main Area",
        tables: [
          { at: [1, 1], capacity: 2, label: "T1", shape: "SQUARE", size: "SMALL" },
          { at: [4, 1], capacity: 2, label: "T2", shape: "SQUARE", size: "SMALL" },
          { at: [7, 1], capacity: 4, label: "T3", shape: "ROUND", size: "MEDIUM" },
          { at: [11, 1], capacity: 4, label: "T4", shape: "RECTANGLE", size: "MEDIUM" },
          { at: [1, 5], capacity: 8, label: "T5", shape: "RECTANGLE", size: "LARGE" },
          { at: [8, 5], capacity: 2, label: "T6", shape: "ROUND", size: "SMALL" },
        ],
      },
      {
        name: "Teras",
        tables: [
          { at: [14, 9], capacity: 2, label: "T7", shape: "ROUND", size: "SMALL" },
          { at: [17, 9], capacity: 2, label: "T8", shape: "ROUND", size: "SMALL" },
          { at: [20, 9], capacity: 4, label: "T9", shape: "SQUARE", size: "MEDIUM" },
        ],
      },
    ],
    name: "Main Floor",
  },
  {
    areas: [
      {
        name: "Main Area",
        tables: [
          { at: [1, 1], capacity: 4, label: "L2-1", shape: "SQUARE", size: "MEDIUM" },
          { at: [5, 1], capacity: 4, label: "L2-2", shape: "SQUARE", size: "MEDIUM" },
          {
            at: [9, 1],
            capacity: 3,
            label: "L2-3",
            rotation: 90,
            shape: "RECTANGLE",
            size: "SMALL",
          },
        ],
      },
      {
        name: "Ruang Rapat",
        tables: [
          { at: [1, 8], capacity: 10, label: "L2-4", shape: "RECTANGLE", size: "LARGE" },
          // Not placed yet: waits in the tray.
          { capacity: 6, label: "L2-5", shape: "ROUND", size: "LARGE" },
        ],
      },
    ],
    name: "Lantai 2",
  },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The floor seed is for development databases only.");
  }
  const prisma = createPrismaClient();
  const slug = process.argv[2];
  const tenant = slug
    ? await prisma.tenant.findUnique({ where: { slug } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) throw new Error(`Tenant ${slug ?? "(first)"} was not found.`);
  const tenantId = tenant.id;
  const outlets = await prisma.outlet.findMany({ where: { status: "ACTIVE", tenantId } });
  const counts = { areas: 0, floors: 0, tables: 0 };

  for (const outlet of outlets) {
    for (const [floorOrder, floorSeed] of LAYOUT.entries()) {
      const where = { tenantId, outletId: outlet.id, name: floorSeed.name };
      let floor = await prisma.floorFloor.findFirst({ where });
      if (!floor) {
        floor = await prisma.floorFloor.create({ data: { ...where, displayOrder: floorOrder } });
        counts.floors += 1;
      }
      for (const [areaOrder, areaSeed] of floorSeed.areas.entries()) {
        const areaWhere = { floorId: floor.id, name: areaSeed.name, tenantId };
        let area = await prisma.floorArea.findFirst({ where: areaWhere });
        if (!area) {
          area = await prisma.floorArea.create({
            data: { ...areaWhere, displayOrder: areaOrder, outletId: outlet.id },
          });
          counts.areas += 1;
        }
        for (const table of areaSeed.tables) {
          const taken = await prisma.floorServiceTable.findFirst({
            where: { label: table.label, outletId: outlet.id, tenantId },
          });
          if (taken) continue;
          const [w, h] = FOOTPRINT[table.shape][table.size];
          const turned = table.rotation === 90;
          await prisma.floorServiceTable.create({
            data: {
              areaId: area.id,
              capacity: table.capacity,
              gridH: turned ? w : h,
              gridW: turned ? h : w,
              gridX: table.at?.[0] ?? null,
              gridY: table.at?.[1] ?? null,
              label: table.label,
              outletId: outlet.id,
              rotation: table.rotation ?? 0,
              shape: table.shape,
              tenantId,
              visualSize: table.size,
            },
          });
          counts.tables += 1;
        }
      }
    }
  }

  console.log(
    `${tenant.name}: added ${counts.floors} floors, ${counts.areas} areas, ` +
      `${counts.tables} tables across ${outlets.length} outlets.`,
  );
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
