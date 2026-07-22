"use client";

import { type ButtonHTMLAttributes, type ReactNode, useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

import { AppIcon } from "./app-icon";

export type ProductTileVariant = "compact" | "default" | "touch" | "customer";
export type ProductTileSize = "sm" | "md" | "lg" | "customer";
export type ProductAvailability = "available" | "sold-out" | "unavailable";

export type ProductTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  availability?: ProductAvailability;
  description?: string;
  imageAlt?: string;
  imageLoading?: boolean;
  imageUrl?: string;
  lowStockLabel?: string;
  name: string;
  priceLabel: ReactNode;
  selected?: boolean;
  size?: ProductTileSize;
  unavailableLabel?: string;
  variant?: ProductTileVariant;
};

export type CategoryRailItem = {
  count?: number;
  disabled?: boolean;
  id: string;
  label: string;
};

export type CategoryRailProps = {
  activeId: string;
  ariaLabel?: string;
  categories: readonly CategoryRailItem[];
  className?: string;
  onSelect: (categoryId: string) => void;
  orientation?: "horizontal" | "vertical";
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ProductTile({
  availability = "available",
  className,
  description,
  disabled,
  imageAlt = "",
  imageLoading = false,
  imageUrl,
  lowStockLabel,
  name,
  priceLabel,
  selected = false,
  size,
  unavailableLabel = "Belum tersedia",
  variant = "default",
  ...props
}: ProductTileProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedSize = size ?? (variant === "customer" ? "customer" : "md");
  const hasImageArea = variant !== "compact";
  const isUnavailable = availability !== "available";
  const statusLabel = availability === "sold-out" ? "Habis" : unavailableLabel;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <button
      {...props}
      aria-busy={imageLoading || undefined}
      aria-pressed={selected}
      className={joinClasses(
        "ui-product-tile",
        `ui-product-tile--${variant}`,
        `ui-product-tile--${resolvedSize}`,
        selected && "is-selected",
        isUnavailable && "is-unavailable",
        className,
      )}
      disabled={disabled || isUnavailable || imageLoading}
      type={props.type ?? "button"}
    >
      {hasImageArea ? (
        <span className="ui-product-tile__media">
          {imageLoading ? (
            <span aria-hidden="true" className="ui-product-tile__image-loading" />
          ) : imageUrl && !imageFailed ? (
            <img alt={imageAlt} onError={() => setImageFailed(true)} src={imageUrl} />
          ) : (
            <span className="ui-product-tile__image-fallback">
              <AppIcon icon={ImageOff} size="lg" />
              <span>Gambar tidak tersedia</span>
            </span>
          )}
        </span>
      ) : null}

      <span className="ui-product-tile__content">
        <span className="ui-product-tile__heading">
          <strong className="ui-product-tile__name">{name}</strong>
          {isUnavailable ? (
            <span className="ui-product-tile__availability">{statusLabel}</span>
          ) : lowStockLabel ? (
            <span className="ui-product-tile__stock">{lowStockLabel}</span>
          ) : null}
        </span>
        {variant === "customer" && description ? (
          <span className="ui-product-tile__description">{description}</span>
        ) : null}
        <span className="ui-product-tile__price">{priceLabel}</span>
      </span>
    </button>
  );
}

export function CategoryRail({
  activeId,
  ariaLabel = "Kategori produk",
  categories,
  className,
  onSelect,
  orientation = "vertical",
}: CategoryRailProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={joinClasses("ui-category-rail", `ui-category-rail--${orientation}`, className)}
    >
      <ul>
        {categories.map((category) => {
          const active = category.id === activeId;

          return (
            <li key={category.id}>
              <button
                aria-current={active ? "page" : undefined}
                aria-pressed={active}
                className={joinClasses("ui-category-rail__item", active && "is-active")}
                disabled={category.disabled}
                onClick={() => onSelect(category.id)}
                type="button"
              >
                <span>{category.label}</span>
                {category.count !== undefined ? (
                  <span aria-label={`${category.count} produk`} className="ui-category-rail__count">
                    {category.count}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
