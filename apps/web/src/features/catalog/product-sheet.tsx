"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import type { CatalogOutletProduct, CatalogProduct, CatalogSnapshot } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { Divider } from "@merchant/ui/data-display";
import { FormField, Input, Textarea } from "@merchant/ui/form-field";
import { MoneyInput } from "@merchant/ui/numeric-date";
import { Sheet } from "@merchant/ui/overlay";
import { Select } from "@merchant/ui/select";
import { Switch } from "@merchant/ui/selection-control";

import { merchantApi, nextCatalogStatus, type ApiClientError } from "@/lib/api-client";
import { slugify } from "@/lib/format";
import { useFormat } from "@/lib/i18n";

import type { CatalogMutation } from "./api";
import { isLimitReached, LimitReachedState } from "@/shell/limit-reached-state";

import { ProductImageField } from "./product-image-field";

type Props = {
  canManage: boolean;
  mutation: CatalogMutation;
  onClose: () => void;
  /** Active outlet from the shell; outlet-specific settings apply to it. */
  outlet: { id: string; name: string } | undefined;
  /** Undefined creates a new product. */
  product: CatalogProduct | undefined;
  snapshot: CatalogSnapshot;
  tenantId: string;
};

type Errors = { category?: string; name?: string; price?: string };

function SectionTitle({ children }: Readonly<{ children: string }>) {
  return <h3 className="text-label text-foreground">{children}</h3>;
}

export function ProductSheet({
  canManage,
  mutation,
  onClose,
  outlet,
  product,
  snapshot,
  tenantId,
}: Readonly<Props>) {
  const t = useTranslations("catalog");
  const { locale, money } = useFormat();
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [price, setPrice] = useState<number | undefined>(
    product ? Number(product.basePriceMinor) : undefined,
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [variantName, setVariantName] = useState("");
  const [variantPrice, setVariantPrice] = useState<number | undefined>();
  const [modifierId, setModifierId] = useState("");
  const [limitError, setLimitError] = useState<ApiClientError | undefined>();
  const busy = mutation.isPending;
  const readOnly = !canManage;

  const categories = snapshot.categories.filter(
    (item) => item.status === "ACTIVE" || item.id === product?.categoryId,
  );
  const variants = snapshot.productVariants.filter((item) => item.productId === product?.id);
  const links = snapshot.productModifierGroups.filter(
    (item) => item.productId === product?.id && item.status === "ACTIVE",
  );
  const linkedGroupIds = new Set(links.map((item) => item.modifierGroupId));
  const attachable = snapshot.modifierGroups.filter(
    (item) => item.status === "ACTIVE" && !linkedGroupIds.has(item.id),
  );
  const assignment: CatalogOutletProduct | undefined = outlet
    ? snapshot.outletProducts.find(
        (item) => item.productId === product?.id && item.outletId === outlet.id,
      )
    : undefined;
  const [outletPrice, setOutletPrice] = useState<number | undefined>(
    assignment?.priceOverrideMinor ? Number(assignment.priceOverrideMinor) : undefined,
  );

  function run(action: () => Promise<unknown>, success: string, onSuccess?: () => void) {
    mutation.mutate(
      { action, success },
      {
        onError: (error) => setLimitError(isLimitReached(error) ? error : undefined),
        ...(onSuccess ? { onSuccess } : {}),
      },
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Errors = {
      ...(name.trim().length < 2 ? { name: t("nameRequired") } : {}),
      ...(categoryId ? {} : { category: t("categoryRequired") }),
      ...(price === undefined ? { price: t("priceRequired") } : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || price === undefined) return;

    const fields = {
      basePriceMinor: String(price),
      categoryId,
      description: description.trim() || null,
      name: name.trim(),
    };
    if (product) {
      run(
        () => merchantApi.updateProduct(tenantId, product.id, fields),
        t("productUpdated"),
        onClose,
      );
    } else {
      run(
        () =>
          merchantApi.createProduct(tenantId, {
            ...fields,
            availability: "AVAILABLE",
            currency: "IDR",
            slug: slugify(fields.name),
          }),
        t("productCreated"),
        onClose,
      );
    }
  }

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      footer={
        canManage && !limitError ? (
          <>
            {product ? (
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      merchantApi.updateProduct(tenantId, product.id, {
                        status: nextCatalogStatus(product.status),
                      }),
                    t("productUpdated"),
                    onClose,
                  )
                }
                variant="secondary"
              >
                {product.status === "ACTIVE" ? t("deactivate") : t("activate")}
              </Button>
            ) : null}
            <Button form="product-form" loading={busy} loadingLabel={t("saving")} type="submit">
              {t("save")}
            </Button>
          </>
        ) : undefined
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={product?.name ?? t("newProduct")}
    >
      {limitError ? <LimitReachedState error={limitError} /> : null}
      <div className="grid gap-6" hidden={Boolean(limitError)}>
        <form className="grid gap-4" id="product-form" noValidate onSubmit={submit}>
          <FormField
            {...(errors.name ? { error: errors.name } : {})}
            htmlFor="product-name"
            label={t("productName")}
          >
            <Input
              id="product-name"
              onChange={(event) => setName(event.target.value)}
              readOnly={readOnly}
              value={name}
            />
          </FormField>
          <div className="grid gap-1.5">
            <span className="text-label">{t("category")}</span>
            <Select
              {...(errors.category ? { error: errors.category } : {})}
              {...(categoryId ? { value: categoryId } : {})}
              disabled={readOnly}
              emptyLabel={t("noCategoryYet")}
              label={t("category")}
              onValueChange={setCategoryId}
              options={categories.map((item) => ({ label: item.name, value: item.id }))}
              placeholder={t("selectCategory")}
            />
          </div>
          <FormField
            {...(errors.price ? { error: errors.price } : {})}
            htmlFor="product-price"
            label={t("price")}
          >
            <MoneyInput
              disabled={readOnly}
              id="product-price"
              locale={locale}
              onValueChange={setPrice}
              {...(price === undefined ? {} : { value: price })}
            />
          </FormField>
          <FormField
            htmlFor="product-description"
            label={t("description")}
            optionalLabel={t("optional")}
          >
            <Textarea
              autoGrow
              id="product-description"
              onChange={(event) => setDescription(event.target.value)}
              readOnly={readOnly}
              size="sm"
              value={description}
            />
          </FormField>
          {product && canManage ? (
            <Switch
              checked={product.availability === "SOLD_OUT"}
              disabled={busy}
              label={t("soldOutEverywhere")}
              onChange={() =>
                run(
                  () =>
                    merchantApi.updateProduct(tenantId, product.id, {
                      // Derived from the saved value: the input is controlled and only flips
                      // after the server confirms.
                      availability: product.availability === "SOLD_OUT" ? "AVAILABLE" : "SOLD_OUT",
                    }),
                  t("productUpdated"),
                )
              }
            />
          ) : null}
        </form>

        {product ? (
          <>
            <Divider />
            <ProductImageField
              canManage={canManage}
              mutation={mutation}
              product={product}
              snapshot={snapshot}
              tenantId={tenantId}
            />
            <Divider />
            <section className="grid gap-3">
              <SectionTitle>{t("variants")}</SectionTitle>
              {variants.map((variant) => (
                <div
                  className="flex items-center justify-between gap-3 text-label"
                  key={variant.id}
                >
                  <span
                    className={
                      variant.status === "ACTIVE" ? undefined : "text-foreground-muted line-through"
                    }
                  >
                    {variant.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="numeric-tabular text-foreground-secondary">
                      +{money(variant.priceDeltaMinor)}
                    </span>
                    {canManage ? (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              merchantApi.updateVariant(tenantId, variant.id, {
                                status: nextCatalogStatus(variant.status),
                              }),
                            t("productUpdated"),
                          )
                        }
                        size="xs"
                        variant="ghost"
                      >
                        {variant.status === "ACTIVE" ? t("deactivate") : t("activate")}
                      </Button>
                    ) : null}
                  </span>
                </div>
              ))}
              {canManage ? (
                <div className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
                  <Input
                    aria-label={t("variantName")}
                    onChange={(event) => setVariantName(event.target.value)}
                    placeholder={t("variantName")}
                    value={variantName}
                  />
                  <MoneyInput
                    aria-label={t("extraPrice")}
                    locale={locale}
                    onValueChange={setVariantPrice}
                    placeholder={t("extraPrice")}
                    {...(variantPrice === undefined ? {} : { value: variantPrice })}
                  />
                  <Button
                    disabled={busy || variantName.trim().length < 2}
                    onClick={() =>
                      run(
                        () =>
                          merchantApi.createVariant(tenantId, {
                            availability: "AVAILABLE",
                            displayOrder: variants.length,
                            name: variantName.trim(),
                            priceDeltaMinor: String(variantPrice ?? 0),
                            productId: product.id,
                          }),
                        t("productUpdated"),
                        () => {
                          setVariantName("");
                          setVariantPrice(undefined);
                        },
                      )
                    }
                    variant="secondary"
                  >
                    {t("add")}
                  </Button>
                </div>
              ) : null}
            </section>

            <Divider />
            <section className="grid gap-3">
              <SectionTitle>{t("modifiers")}</SectionTitle>
              {links.map((link) => (
                <div className="flex items-center justify-between gap-3 text-label" key={link.id}>
                  <span>
                    {snapshot.modifierGroups.find((item) => item.id === link.modifierGroupId)?.name}
                  </span>
                  {canManage ? (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            merchantApi.updateProductModifierGroup(tenantId, link.id, {
                              status: "INACTIVE",
                            }),
                          t("productUpdated"),
                        )
                      }
                      size="xs"
                      variant="ghost"
                    >
                      {t("detach")}
                    </Button>
                  ) : null}
                </div>
              ))}
              {canManage && attachable.length ? (
                <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                  <Select
                    {...(modifierId ? { value: modifierId } : {})}
                    emptyLabel={t("emptyOptions")}
                    label={t("modifiers")}
                    onValueChange={setModifierId}
                    options={attachable.map((item) => ({ label: item.name, value: item.id }))}
                    placeholder={t("selectModifier")}
                  />
                  <Button
                    disabled={busy || !modifierId}
                    onClick={() => {
                      const existing = snapshot.productModifierGroups.find(
                        (item) =>
                          item.productId === product.id && item.modifierGroupId === modifierId,
                      );
                      run(
                        () =>
                          existing
                            ? merchantApi.updateProductModifierGroup(tenantId, existing.id, {
                                status: "ACTIVE",
                              })
                            : merchantApi.createProductModifierGroup(tenantId, {
                                displayOrder: links.length,
                                modifierGroupId: modifierId,
                                productId: product.id,
                              }),
                        t("productUpdated"),
                        () => setModifierId(""),
                      );
                    }}
                    variant="secondary"
                  >
                    {t("attach")}
                  </Button>
                </div>
              ) : null}
            </section>

            {outlet ? (
              <>
                <Divider />
                <section className="grid gap-3">
                  <SectionTitle>{outlet.name}</SectionTitle>
                  <Switch
                    checked={assignment?.status === "ACTIVE"}
                    disabled={busy || readOnly}
                    label={t("outletSold")}
                    onChange={() =>
                      run(
                        () =>
                          assignment
                            ? merchantApi.updateOutletProduct(tenantId, outlet.id, assignment.id, {
                                status: nextCatalogStatus(assignment.status),
                              })
                            : merchantApi.createOutletProduct(tenantId, outlet.id, {
                                availabilityOverride: null,
                                displayOrder: 0,
                                priceOverrideMinor: null,
                                productId: product.id,
                              }),
                        t("outletUpdated"),
                      )
                    }
                  />
                  {assignment?.status === "ACTIVE" ? (
                    <>
                      <Switch
                        checked={assignment.availabilityOverride === "SOLD_OUT"}
                        disabled={busy || readOnly}
                        label={t("outletSoldOut")}
                        onChange={() =>
                          run(
                            () =>
                              merchantApi.updateOutletProduct(tenantId, outlet.id, assignment.id, {
                                availabilityOverride:
                                  assignment.availabilityOverride === "SOLD_OUT"
                                    ? null
                                    : "SOLD_OUT",
                              }),
                            t("outletUpdated"),
                          )
                        }
                      />
                      <FormField
                        helperText={t("outletFollowsProduct")}
                        htmlFor="outlet-price"
                        label={t("outletPrice")}
                      >
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <MoneyInput
                            disabled={readOnly}
                            id="outlet-price"
                            locale={locale}
                            onValueChange={setOutletPrice}
                            placeholder={money(product.basePriceMinor)}
                            {...(outletPrice === undefined ? {} : { value: outletPrice })}
                          />
                          {canManage ? (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () =>
                                    merchantApi.updateOutletProduct(
                                      tenantId,
                                      outlet.id,
                                      assignment.id,
                                      {
                                        priceOverrideMinor:
                                          outletPrice === undefined ? null : String(outletPrice),
                                      },
                                    ),
                                  t("outletUpdated"),
                                )
                              }
                              variant="secondary"
                            >
                              {t("save")}
                            </Button>
                          ) : null}
                        </div>
                      </FormField>
                    </>
                  ) : null}
                </section>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
