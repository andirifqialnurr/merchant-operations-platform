import { Injectable } from "@nestjs/common";

import type { CatalogRepository } from "../application/catalog.repository.js";
import * as category from "./prisma-category.js";
import * as productImage from "./prisma-product-image.js";
import * as productModifierGroup from "./prisma-product-modifier-group.js";
import * as productVariant from "./prisma-product-variant.js";
import * as modifier from "./prisma-modifier.js";
import * as outletProduct from "./prisma-outlet-product.js";
import * as product from "./prisma-product.js";
import * as workspace from "./prisma-workspace.js";

/**
 * The catalog on PostgreSQL. Each group of tables has its own file; this class
 * only gathers them behind the port.
 */
@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  findCategoryById = category.findCategoryById;
  findCategoryBySlug = category.findCategoryBySlug;
  createCategory = category.createCategory;
  updateCategory = category.updateCategory;

  findProductImageById = productImage.findProductImageById;
  findProductImageByObjectKey = productImage.findProductImageByObjectKey;
  createProductImage = productImage.createProductImage;
  updateProductImage = productImage.updateProductImage;

  findProductModifierGroupById = productModifierGroup.findProductModifierGroupById;
  findProductModifierGroup = productModifierGroup.findProductModifierGroup;
  createProductModifierGroup = productModifierGroup.createProductModifierGroup;
  updateProductModifierGroup = productModifierGroup.updateProductModifierGroup;

  findProductVariantById = productVariant.findProductVariantById;
  createProductVariant = productVariant.createProductVariant;
  updateProductVariant = productVariant.updateProductVariant;

  findModifierGroupById = modifier.findModifierGroupById;
  findModifierGroupByName = modifier.findModifierGroupByName;
  createModifierGroup = modifier.createModifierGroup;
  updateModifierGroup = modifier.updateModifierGroup;
  findModifierOptionById = modifier.findModifierOptionById;
  findModifierOptionByName = modifier.findModifierOptionByName;
  createModifierOption = modifier.createModifierOption;
  updateModifierOption = modifier.updateModifierOption;

  findOutlet = outletProduct.findOutlet;
  findOutletProductById = outletProduct.findOutletProductById;
  findOutletProduct = outletProduct.findOutletProduct;
  createOutletProduct = outletProduct.createOutletProduct;
  updateOutletProduct = outletProduct.updateOutletProduct;

  findProductById = product.findProductById;
  findProductBySlug = product.findProductBySlug;
  createProduct = product.createProduct;
  updateProduct = product.updateProduct;

  findTenant = workspace.findTenant;
  getSnapshot = workspace.getSnapshot;
}
