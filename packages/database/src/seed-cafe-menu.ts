/**
 * Fills a development workspace with a small cafe menu so the cashier screen
 * has something to sell. Development only: it writes straight to the catalog
 * tables without audit entries or outbox events.
 *
 * Usage: pnpm db:seed:menu [tenant-slug]
 * Safe to run again: existing categories, products, and modifiers are kept.
 */
import { createPrismaClient } from "./client.ts";

type ProductSeed = {
  description: string;
  groups?: readonly string[];
  name: string;
  price: number;
  variants?: readonly (readonly [name: string, priceDelta: number])[];
};

const HOT_OR_ICED = [
  ["Panas", 0],
  ["Dingin", 3_000],
] as const;

const MODIFIER_GROUPS = [
  {
    max: 1,
    min: 1,
    name: "Ukuran",
    options: [
      ["Regular", 0],
      ["Large", 6_000],
    ],
    type: "SINGLE",
  },
  {
    max: 1,
    min: 0,
    name: "Tingkat Gula",
    options: [
      ["Normal", 0],
      ["Sedikit gula", 0],
      ["Tanpa gula", 0],
    ],
    type: "SINGLE",
  },
  {
    max: 3,
    min: 0,
    name: "Tambahan Minuman",
    options: [
      ["Extra shot espresso", 6_000],
      ["Susu oat", 8_000],
      ["Sirup karamel", 4_000],
    ],
    type: "MULTIPLE",
  },
  {
    max: 2,
    min: 0,
    name: "Tambahan Makanan",
    options: [
      ["Telur mata sapi", 5_000],
      ["Keju parut", 5_000],
    ],
    type: "MULTIPLE",
  },
] as const;

const DRINK_GROUPS = ["Ukuran", "Tingkat Gula", "Tambahan Minuman"] as const;

const MENU: readonly { category: string; products: readonly ProductSeed[] }[] = [
  {
    category: "Kopi",
    products: [
      {
        description: "Espresso dengan susu segar dan gula aren.",
        groups: DRINK_GROUPS,
        name: "Kopi Susu Gula Aren",
        price: 22_000,
        variants: HOT_OR_ICED,
      },
      {
        description: "Espresso dengan air panas, ringan dan bersih.",
        groups: DRINK_GROUPS,
        name: "Americano",
        price: 20_000,
        variants: HOT_OR_ICED,
      },
      {
        description: "Espresso dengan susu steam dan busa tipis.",
        groups: DRINK_GROUPS,
        name: "Caffe Latte",
        price: 26_000,
        variants: HOT_OR_ICED,
      },
      {
        description: "Espresso, susu steam, dan busa tebal.",
        groups: DRINK_GROUPS,
        name: "Cappuccino",
        price: 26_000,
        variants: HOT_OR_ICED,
      },
      {
        description: "Seduh manual V60, biji pilihan minggu ini.",
        name: "V60 Single Origin",
        price: 30_000,
      },
    ],
  },
  {
    category: "Non-Kopi",
    products: [
      {
        description: "Matcha dengan susu segar.",
        groups: DRINK_GROUPS,
        name: "Matcha Latte",
        price: 28_000,
        variants: HOT_OR_ICED,
      },
      {
        description: "Cokelat pekat dengan susu segar.",
        groups: DRINK_GROUPS,
        name: "Cokelat",
        price: 25_000,
        variants: HOT_OR_ICED,
      },
      {
        description: "Teh hitam dengan perasan lemon.",
        groups: ["Tingkat Gula"],
        name: "Es Lemon Tea",
        price: 18_000,
      },
      { description: "Air mineral botol 600 ml.", name: "Air Mineral", price: 8_000 },
    ],
  },
  {
    category: "Makanan",
    products: [
      {
        description: "Nasi goreng dengan ayam suwir dan kerupuk.",
        groups: ["Tambahan Makanan"],
        name: "Nasi Goreng Kampung",
        price: 32_000,
      },
      {
        description: "Mi goreng dengan sayur dan bakso.",
        groups: ["Tambahan Makanan"],
        name: "Mi Goreng Jawa",
        price: 30_000,
      },
      {
        description: "Roti panggang isi ayam, keju, dan selada.",
        name: "Chicken Sandwich",
        price: 35_000,
      },
    ],
  },
  {
    category: "Camilan",
    products: [
      { description: "Kentang goreng dengan saus sambal.", name: "Kentang Goreng", price: 20_000 },
      {
        description: "Pisang goreng dengan taburan keju.",
        name: "Pisang Goreng Keju",
        price: 18_000,
      },
      {
        description: "Croissant mentega, dipanggang setiap pagi.",
        name: "Croissant Butter",
        price: 22_000,
      },
      {
        description: "Roti bakar dengan selai cokelat.",
        name: "Roti Bakar Cokelat",
        price: 18_000,
      },
    ],
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The menu seed is for development databases only.");
  }
  const prisma = createPrismaClient();
  const slug = process.argv[2];
  const tenant = slug
    ? await prisma.tenant.findUnique({ where: { slug } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) throw new Error(`Tenant ${slug ?? "(first)"} was not found.`);
  const tenantId = tenant.id;
  const outlets = await prisma.outlet.findMany({ where: { tenantId } });

  const counts = { assignments: 0, categories: 0, groups: 0, products: 0 };
  await prisma.$transaction(async (transaction) => {
    const groupIds = new Map<string, string>();
    for (const [displayOrder, group] of MODIFIER_GROUPS.entries()) {
      let record = await transaction.catalogModifierGroup.findFirst({
        where: { name: group.name, tenantId },
      });
      if (!record) {
        record = await transaction.catalogModifierGroup.create({
          data: {
            displayOrder,
            maxSelections: group.max,
            minSelections: group.min,
            name: group.name,
            selectionType: group.type,
            tenantId,
          },
        });
        await transaction.catalogModifierOption.createMany({
          data: group.options.map(([name, priceDelta], optionOrder) => ({
            displayOrder: optionOrder,
            groupId: record!.id,
            name,
            priceDeltaMinor: BigInt(priceDelta),
            tenantId,
          })),
        });
        counts.groups += 1;
      }
      groupIds.set(group.name, record.id);
    }

    for (const [categoryOrder, entry] of MENU.entries()) {
      const categorySlug = slugify(entry.category);
      let category = await transaction.catalogCategory.findFirst({
        where: { slug: categorySlug, tenantId },
      });
      if (!category) {
        category = await transaction.catalogCategory.create({
          data: { displayOrder: categoryOrder, name: entry.category, slug: categorySlug, tenantId },
        });
        counts.categories += 1;
      }

      for (const [productOrder, seed] of entry.products.entries()) {
        const productSlug = slugify(seed.name);
        let product = await transaction.catalogProduct.findFirst({
          where: { slug: productSlug, tenantId },
        });
        if (!product) {
          product = await transaction.catalogProduct.create({
            data: {
              basePriceMinor: BigInt(seed.price),
              categoryId: category.id,
              description: seed.description,
              name: seed.name,
              slug: productSlug,
              tenantId,
            },
          });
          if (seed.variants) {
            await transaction.catalogProductVariant.createMany({
              data: seed.variants.map(([name, priceDelta], displayOrder) => ({
                displayOrder,
                name,
                priceDeltaMinor: BigInt(priceDelta),
                productId: product!.id,
                tenantId,
              })),
            });
          }
          if (seed.groups) {
            await transaction.catalogProductModifierGroup.createMany({
              data: seed.groups.map((name, displayOrder) => ({
                displayOrder,
                modifierGroupId: groupIds.get(name)!,
                productId: product!.id,
                tenantId,
              })),
            });
          }
          counts.products += 1;
        }

        for (const outlet of outlets) {
          const assigned = await transaction.catalogOutletProduct.findFirst({
            where: { outletId: outlet.id, productId: product.id, tenantId },
          });
          if (assigned) continue;
          await transaction.catalogOutletProduct.create({
            data: {
              displayOrder: categoryOrder * 100 + productOrder,
              outletId: outlet.id,
              productId: product.id,
              tenantId,
            },
          });
          counts.assignments += 1;
        }
      }
    }
  });

  console.log(
    `${tenant.name}: added ${counts.categories} categories, ${counts.products} products, ` +
      `${counts.groups} modifier groups, ${counts.assignments} outlet assignments ` +
      `across ${outlets.length} outlets.`,
  );
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
