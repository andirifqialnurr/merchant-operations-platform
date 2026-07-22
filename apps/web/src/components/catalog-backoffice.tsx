"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, LayoutDashboard, LogOut, Package, RefreshCw, Store } from "lucide-react";

import {
  PERMISSIONS,
  type AuthSession,
  type CatalogOutletSnapshot,
  type CatalogSnapshot,
  type WorkspaceContext,
} from "@merchant/contracts";
import { AppIcon } from "@merchant/ui/app-icon";
import { Alert, Badge, EmptyState, ErrorState, Skeleton } from "@merchant/ui/feedback";
import { Button } from "@merchant/ui/button";
import { Card, DataTable, MetricCard } from "@merchant/ui/data-display";
import { FormField, Input, Textarea } from "@merchant/ui/form-field";
import { Breadcrumb, Sidebar, Tabs, TopBar } from "@merchant/ui/navigation";
import { NumericInput } from "@merchant/ui/numeric-date";
import { Select } from "@merchant/ui/select";

import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { ApiClientError, merchantApi, nextCatalogStatus } from "@/lib/api-client";

type View = "master" | "composition" | "outlet";
type FormState = Record<string, string>;

const rupiah = new Intl.NumberFormat("id-ID", {
  currency: "IDR",
  maximumFractionDigits: 0,
  style: "currency",
});

function messageFrom(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan yang tidak dapat dikenali.";
}

function formatMinor(value: string) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? rupiah.format(amount) : `${value} IDR`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function StatusBadge({ status }: { status: "ACTIVE" | "INACTIVE" }) {
  return <Badge tone={status === "ACTIVE" ? "success" : "warning"}>{status}</Badge>;
}

function Login({ onLoggedIn }: { onLoggedIn: (session: AuthSession) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await onLoggedIn(await merchantApi.login({ email, password }));
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="catalog-login">
      <Card size="lg">
        <div className="catalog-login__brand">
          <span>
            <AppIcon icon={Store} label="Merchant Operations" size="lg" />
          </span>
          <div>
            <p>Merchant Operations</p>
            <h1>Masuk ke Backoffice</h1>
          </div>
        </div>
        <p className="catalog-login__intro">
          Gunakan akun merchant aktif. Tenant, outlet, permission, dan entitlement dipilih dari
          konteks sesi yang tervalidasi server.
        </p>
        {error ? (
          <Alert title="Tidak dapat masuk" tone="danger">
            {error}
          </Alert>
        ) : null}
        <form className="catalog-form" onSubmit={submit}>
          <FormField htmlFor="login-email" label="Email" required>
            <Input
              autoComplete="email"
              id="login-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@merchant.id"
              value={email}
            />
          </FormField>
          <FormField htmlFor="login-password" label="Kata sandi" required>
            <Input
              autoComplete="current-password"
              id="login-password"
              onChange={(event) => setPassword(event.target.value)}
              value={password}
              variant="password"
            />
          </FormField>
          <Button fullWidth loading={busy} loadingLabel="Memverifikasi sesi..." type="submit">
            Masuk
          </Button>
        </form>
      </Card>
    </main>
  );
}

function LabeledSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly { label: string; value: string; description?: string }[];
  value?: string | undefined;
}) {
  return (
    <label className="catalog-select-field">
      <span>{label}</span>
      <Select
        label={label}
        onValueChange={onChange}
        options={options}
        {...(value ? { value } : {})}
      />
    </label>
  );
}

type CatalogChildProps = {
  busy: boolean;
  canManage: boolean;
  onMutate: (action: () => Promise<unknown>, success: string) => Promise<void>;
  snapshot: CatalogSnapshot;
  tenantId: string;
};

function MasterCatalog({ busy, canManage, onMutate, snapshot, tenantId }: CatalogChildProps) {
  const [category, setCategory] = useState<FormState>({ name: "", slug: "", order: "0" });
  const [product, setProduct] = useState<FormState>({
    categoryId: "",
    description: "",
    name: "",
    price: "",
    slug: "",
  });
  const categoryOptions = snapshot.categories
    .filter((item) => item.status === "ACTIVE")
    .map((item) => ({ label: item.name, value: item.id }));

  return (
    <div className="catalog-view-stack">
      <section className="catalog-section">
        <div className="catalog-section__heading">
          <div>
            <p>Master</p>
            <h2>Kategori</h2>
          </div>
          <span>{snapshot.categories.length} kategori</span>
        </div>
        {canManage ? (
          <form
            className="catalog-inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onMutate(
                () =>
                  merchantApi.createCategory(tenantId, {
                    displayOrder: Number(category.order),
                    name: category.name ?? "",
                    slug: category.slug || slugify(category.name ?? ""),
                  }),
                "Kategori berhasil ditambahkan.",
              ).then(() => setCategory({ name: "", slug: "", order: "0" }));
            }}
          >
            <FormField htmlFor="category-name" label="Nama kategori" required>
              <Input
                id="category-name"
                onChange={(event) => setCategory({ ...category, name: event.target.value })}
                value={category.name}
              />
            </FormField>
            <FormField
              helperText="Kosongkan untuk membuat slug otomatis."
              htmlFor="category-slug"
              label="Slug"
            >
              <Input
                id="category-slug"
                onChange={(event) => setCategory({ ...category, slug: event.target.value })}
                value={category.slug}
              />
            </FormField>
            <FormField htmlFor="category-order" label="Urutan">
              <NumericInput
                id="category-order"
                min="0"
                onValueChange={(value) => setCategory({ ...category, order: value })}
                value={category.order}
              />
            </FormField>
            <Button disabled={busy} type="submit">
              Tambah kategori
            </Button>
          </form>
        ) : null}
        {snapshot.categories.length ? (
          <DataTable
            columns={["Kategori", "Slug", "Urutan", "Status", "Tindakan"]}
            rows={snapshot.categories.map((item) => [
              item.name,
              <code key={`${item.id}-slug`}>{item.slug}</code>,
              item.displayOrder,
              <StatusBadge key={`${item.id}-status`} status={item.status} />,
              canManage ? (
                <Button
                  disabled={busy}
                  key={`${item.id}-action`}
                  onClick={() =>
                    void onMutate(
                      () =>
                        merchantApi.updateCategory(tenantId, item.id, {
                          status: nextCatalogStatus(item.status),
                        }),
                      "Status kategori diperbarui.",
                    )
                  }
                  size="xs"
                  variant="ghost"
                >
                  {item.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              ) : (
                "Baca saja"
              ),
            ])}
          />
        ) : (
          <EmptyState
            description="Tambahkan kategori sebelum membuat produk."
            title="Kategori belum tersedia"
          />
        )}
      </section>

      <section className="catalog-section">
        <div className="catalog-section__heading">
          <div>
            <p>Master</p>
            <h2>Produk</h2>
          </div>
          <span>{snapshot.products.length} produk</span>
        </div>
        {canManage ? (
          <form
            className="catalog-product-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onMutate(
                () =>
                  merchantApi.createProduct(tenantId, {
                    basePriceMinor: product.price ?? "",
                    categoryId: product.categoryId ?? "",
                    currency: "IDR",
                    availability: "AVAILABLE",
                    description: product.description?.trim() || null,
                    name: product.name ?? "",
                    slug: product.slug || slugify(product.name ?? ""),
                  }),
                "Produk berhasil ditambahkan.",
              ).then(() =>
                setProduct({
                  categoryId: product.categoryId ?? "",
                  description: "",
                  name: "",
                  price: "",
                  slug: "",
                }),
              );
            }}
          >
            <LabeledSelect
              label="Kategori"
              onChange={(value) => setProduct({ ...product, categoryId: value })}
              options={categoryOptions}
              value={product.categoryId}
            />
            <FormField htmlFor="product-name" label="Nama produk" required>
              <Input
                id="product-name"
                onChange={(event) => setProduct({ ...product, name: event.target.value })}
                value={product.name}
              />
            </FormField>
            <FormField
              helperText="Rp25.000 ditulis 25000."
              htmlFor="product-price"
              label="Harga dasar"
              required
            >
              <NumericInput
                id="product-price"
                min="0"
                onValueChange={(value) => setProduct({ ...product, price: value })}
                value={product.price}
              />
            </FormField>
            <FormField
              helperText="Kosongkan untuk membuat slug otomatis."
              htmlFor="product-slug"
              label="Slug"
            >
              <Input
                id="product-slug"
                onChange={(event) => setProduct({ ...product, slug: event.target.value })}
                value={product.slug}
              />
            </FormField>
            <FormField htmlFor="product-description" label="Deskripsi">
              <Textarea
                id="product-description"
                onChange={(event) => setProduct({ ...product, description: event.target.value })}
                value={product.description}
              />
            </FormField>
            <Button disabled={busy || !categoryOptions.length} type="submit">
              Tambah produk
            </Button>
          </form>
        ) : null}
        {snapshot.products.length ? (
          <DataTable
            columns={["Produk", "Kategori", "Harga", "Jual", "Status", "Tindakan"]}
            rows={snapshot.products.map((item) => [
              <div key={`${item.id}-name`}>
                <strong>{item.name}</strong>
                <small>{item.slug}</small>
              </div>,
              snapshot.categories.find((categoryItem) => categoryItem.id === item.categoryId)
                ?.name ?? "-",
              formatMinor(item.basePriceMinor),
              <Badge
                key={`${item.id}-availability`}
                tone={item.availability === "AVAILABLE" ? "success" : "warning"}
              >
                {item.availability}
              </Badge>,
              <StatusBadge key={`${item.id}-status`} status={item.status} />,
              canManage ? (
                <div className="catalog-row-actions" key={`${item.id}-actions`}>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void onMutate(
                        () =>
                          merchantApi.updateProduct(tenantId, item.id, {
                            availability:
                              item.availability === "AVAILABLE" ? "SOLD_OUT" : "AVAILABLE",
                          }),
                        "Ketersediaan produk diperbarui.",
                      )
                    }
                    size="xs"
                    variant="ghost"
                  >
                    {item.availability === "AVAILABLE" ? "Sold out" : "Tersedia"}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void onMutate(
                        () =>
                          merchantApi.updateProduct(tenantId, item.id, {
                            status: nextCatalogStatus(item.status),
                          }),
                        "Status produk diperbarui.",
                      )
                    }
                    size="xs"
                    variant="ghost"
                  >
                    {item.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              ) : (
                "Baca saja"
              ),
            ])}
          />
        ) : (
          <EmptyState
            description="Produk baru akan muncul di sini setelah dibuat."
            title="Produk belum tersedia"
          />
        )}
      </section>
    </div>
  );
}

function CompositionCatalog({ busy, canManage, onMutate, snapshot, tenantId }: CatalogChildProps) {
  const [variant, setVariant] = useState<FormState>({ name: "", price: "0", productId: "" });
  const [group, setGroup] = useState<FormState>({ max: "1", min: "0", name: "", type: "SINGLE" });
  const [option, setOption] = useState<FormState>({ groupId: "", name: "", price: "0" });
  const [assignment, setAssignment] = useState<FormState>({ groupId: "", productId: "" });
  const [image, setImage] = useState<FormState>({
    alt: "",
    contentType: "image/webp",
    objectKey: "",
    productId: "",
  });
  const productOptions = snapshot.products
    .filter((item) => item.status === "ACTIVE")
    .map((item) => ({ label: item.name, value: item.id }));
  const groupOptions = snapshot.modifierGroups
    .filter((item) => item.status === "ACTIVE")
    .map((item) => ({ label: item.name, value: item.id }));

  if (!canManage)
    return (
      <Alert title="Akses baca" tone="info">
        Perubahan composition memerlukan permission catalog.manage.
      </Alert>
    );
  const forms = [
    {
      title: "Variant produk",
      content: (
        <>
          <LabeledSelect
            label="Produk"
            onChange={(value) => setVariant({ ...variant, productId: value })}
            options={productOptions}
            value={variant.productId}
          />
          <FormField htmlFor="variant-name" label="Nama variant" required>
            <Input
              id="variant-name"
              onChange={(event) => setVariant({ ...variant, name: event.target.value })}
              value={variant.name}
            />
          </FormField>
          <FormField htmlFor="variant-price" label="Tambahan harga">
            <NumericInput
              id="variant-price"
              onValueChange={(value) => setVariant({ ...variant, price: value })}
              value={variant.price}
            />
          </FormField>
          <Button
            disabled={busy}
            onClick={() =>
              void onMutate(
                () =>
                  merchantApi.createVariant(tenantId, {
                    availability: "AVAILABLE",
                    displayOrder: 0,
                    name: variant.name ?? "",
                    priceDeltaMinor: variant.price ?? "0",
                    productId: variant.productId ?? "",
                  }),
                "Variant berhasil ditambahkan.",
              )
            }
            type="button"
          >
            Tambah variant
          </Button>
        </>
      ),
    },
    {
      title: "Modifier group",
      content: (
        <>
          <FormField htmlFor="group-name" label="Nama group" required>
            <Input
              id="group-name"
              onChange={(event) => setGroup({ ...group, name: event.target.value })}
              value={group.name}
            />
          </FormField>
          <LabeledSelect
            label="Tipe pilihan"
            onChange={(value) =>
              setGroup({
                ...group,
                type: value,
                max: value === "SINGLE" ? "1" : (group.max ?? "1"),
              })
            }
            options={[
              { label: "Satu pilihan", value: "SINGLE" },
              { label: "Banyak pilihan", value: "MULTIPLE" },
            ]}
            value={group.type}
          />
          <div className="catalog-form-pair">
            <FormField htmlFor="group-min" label="Minimum">
              <NumericInput
                id="group-min"
                onValueChange={(value) => setGroup({ ...group, min: value })}
                value={group.min}
              />
            </FormField>
            <FormField htmlFor="group-max" label="Maksimum">
              <NumericInput
                id="group-max"
                onValueChange={(value) => setGroup({ ...group, max: value })}
                value={group.max}
              />
            </FormField>
          </div>
          <Button
            disabled={busy}
            onClick={() =>
              void onMutate(
                () =>
                  merchantApi.createModifierGroup(tenantId, {
                    displayOrder: 0,
                    maxSelections: Number(group.max),
                    minSelections: Number(group.min),
                    name: group.name ?? "",
                    selectionType: group.type as "SINGLE" | "MULTIPLE",
                  }),
                "Modifier group berhasil ditambahkan.",
              )
            }
            type="button"
          >
            Tambah group
          </Button>
        </>
      ),
    },
    {
      title: "Modifier option",
      content: (
        <>
          <LabeledSelect
            label="Modifier group"
            onChange={(value) => setOption({ ...option, groupId: value })}
            options={groupOptions}
            value={option.groupId}
          />
          <FormField htmlFor="option-name" label="Nama opsi" required>
            <Input
              id="option-name"
              onChange={(event) => setOption({ ...option, name: event.target.value })}
              value={option.name}
            />
          </FormField>
          <FormField htmlFor="option-price" label="Tambahan harga">
            <NumericInput
              id="option-price"
              onValueChange={(value) => setOption({ ...option, price: value })}
              value={option.price}
            />
          </FormField>
          <Button
            disabled={busy}
            onClick={() =>
              void onMutate(
                () =>
                  merchantApi.createModifierOption(tenantId, {
                    availability: "AVAILABLE",
                    displayOrder: 0,
                    groupId: option.groupId ?? "",
                    name: option.name ?? "",
                    priceDeltaMinor: option.price ?? "0",
                  }),
                "Modifier option berhasil ditambahkan.",
              )
            }
            type="button"
          >
            Tambah opsi
          </Button>
        </>
      ),
    },
    {
      title: "Pasang modifier ke produk",
      content: (
        <>
          <LabeledSelect
            label="Produk"
            onChange={(value) => setAssignment({ ...assignment, productId: value })}
            options={productOptions}
            value={assignment.productId}
          />
          <LabeledSelect
            label="Modifier group"
            onChange={(value) => setAssignment({ ...assignment, groupId: value })}
            options={groupOptions}
            value={assignment.groupId}
          />
          <Button
            disabled={busy}
            onClick={() =>
              void onMutate(
                () =>
                  merchantApi.createProductModifierGroup(tenantId, {
                    displayOrder: 0,
                    modifierGroupId: assignment.groupId ?? "",
                    productId: assignment.productId ?? "",
                  }),
                "Modifier dipasang ke produk.",
              )
            }
            type="button"
          >
            Pasang modifier
          </Button>
        </>
      ),
    },
    {
      title: "Metadata gambar produk",
      content: (
        <>
          <LabeledSelect
            label="Produk"
            onChange={(value) => setImage({ ...image, productId: value })}
            options={productOptions}
            value={image.productId}
          />
          <FormField
            helperText="Object key storage; bukan URL publik."
            htmlFor="image-key"
            label="Object key"
            required
          >
            <Input
              id="image-key"
              onChange={(event) => setImage({ ...image, objectKey: event.target.value })}
              value={image.objectKey}
            />
          </FormField>
          <LabeledSelect
            label="Content type"
            onChange={(value) => setImage({ ...image, contentType: value })}
            options={["image/webp", "image/jpeg", "image/png", "image/avif"].map((value) => ({
              label: value,
              value,
            }))}
            value={image.contentType}
          />
          <FormField htmlFor="image-alt" label="Alt text">
            <Input
              id="image-alt"
              onChange={(event) => setImage({ ...image, alt: event.target.value })}
              value={image.alt}
            />
          </FormField>
          <Button
            disabled={busy}
            onClick={() =>
              void onMutate(
                () =>
                  merchantApi.createProductImage(tenantId, {
                    altText: image.alt?.trim() || null,
                    contentType: image.contentType as "image/webp",
                    displayOrder: 0,
                    isPrimary: false,
                    objectKey: image.objectKey ?? "",
                    productId: image.productId ?? "",
                  }),
                "Metadata gambar berhasil ditambahkan.",
              )
            }
            type="button"
          >
            Tambah metadata
          </Button>
        </>
      ),
    },
  ];
  return (
    <div className="catalog-view-stack">
      <section className="catalog-composition-grid">
        {forms.map((form) => (
          <Card key={form.title}>
            <h2>{form.title}</h2>
            <div className="catalog-form">{form.content}</div>
          </Card>
        ))}
      </section>
      <section className="catalog-section">
        <div className="catalog-section__heading">
          <div>
            <p>Ringkasan</p>
            <h2>Composition aktif</h2>
          </div>
        </div>
        <DataTable
          columns={["Jenis", "Jumlah", "Catatan"]}
          rows={[
            ["Variant", snapshot.productVariants.length, "Pilihan per produk"],
            [
              "Modifier group",
              snapshot.modifierGroups.length,
              `${snapshot.modifierOptions.length} opsi`,
            ],
            ["Assignment", snapshot.productModifierGroups.length, "Product ke modifier group"],
            ["Gambar", snapshot.productImages.length, "Metadata object storage"],
          ]}
        />
      </section>
    </div>
  );
}

function OutletCatalog({
  busy,
  canManage,
  master,
  onMutate,
  outlet,
  outletId,
  tenantId,
}: {
  busy: boolean;
  canManage: boolean;
  master?: CatalogSnapshot | undefined;
  onMutate: CatalogChildProps["onMutate"];
  outlet: CatalogOutletSnapshot;
  outletId: string;
  tenantId: string;
}) {
  const [form, setForm] = useState<FormState>({
    availability: "INHERIT",
    price: "",
    productId: "",
  });
  const assigned = new Set(outlet.items.map((item) => item.product.id));
  const availableProducts = (master?.products ?? []).filter(
    (item) => item.status === "ACTIVE" && !assigned.has(item.id),
  );
  return (
    <div className="catalog-view-stack">
      {canManage && master ? (
        <section className="catalog-section">
          <div className="catalog-section__heading">
            <div>
              <p>Outlet assignment</p>
              <h2>Tambahkan produk ke outlet</h2>
            </div>
          </div>
          <form
            className="catalog-inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onMutate(
                () =>
                  merchantApi.createOutletProduct(tenantId, outletId, {
                    availabilityOverride:
                      form.availability === "INHERIT"
                        ? null
                        : (form.availability as "AVAILABLE" | "SOLD_OUT"),
                    displayOrder: 0,
                    priceOverrideMinor: form.price || null,
                    productId: form.productId ?? "",
                  }),
                "Produk berhasil ditambahkan ke outlet.",
              );
            }}
          >
            <LabeledSelect
              label="Produk"
              onChange={(value) => setForm({ ...form, productId: value })}
              options={availableProducts.map((item) => ({
                description: formatMinor(item.basePriceMinor),
                label: item.name,
                value: item.id,
              }))}
              value={form.productId}
            />
            <FormField
              helperText="Kosong berarti mengikuti master."
              htmlFor="outlet-price"
              label="Override harga"
            >
              <NumericInput
                id="outlet-price"
                onValueChange={(value) => setForm({ ...form, price: value })}
                value={form.price}
              />
            </FormField>
            <LabeledSelect
              label="Override ketersediaan"
              onChange={(value) => setForm({ ...form, availability: value })}
              options={[
                { label: "Ikuti master", value: "INHERIT" },
                { label: "Tersedia", value: "AVAILABLE" },
                { label: "Sold out", value: "SOLD_OUT" },
              ]}
              value={form.availability}
            />
            <Button disabled={busy || !availableProducts.length} type="submit">
              Tambahkan ke outlet
            </Button>
          </form>
        </section>
      ) : null}
      <section className="catalog-section">
        <div className="catalog-section__heading">
          <div>
            <p>Effective catalog</p>
            <h2>Produk outlet</h2>
          </div>
          <span>{outlet.items.length} produk</span>
        </div>
        {outlet.items.length ? (
          <DataTable
            columns={["Produk", "Harga efektif", "Ketersediaan", "Sumber", "Status", "Tindakan"]}
            rows={outlet.items.map((item) => [
              item.product.name,
              formatMinor(item.effectivePriceMinor),
              <Badge
                key={`${item.assignment.id}-availability`}
                tone={item.effectiveAvailability === "AVAILABLE" ? "success" : "warning"}
              >
                {item.effectiveAvailability}
              </Badge>,
              `${item.inheritsPrice ? "Harga master" : "Harga outlet"} · ${item.inheritsAvailability ? "status master" : "status outlet"}`,
              <StatusBadge key={`${item.assignment.id}-status`} status={item.assignment.status} />,
              canManage ? (
                <div className="catalog-row-actions" key={`${item.assignment.id}-actions`}>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void onMutate(
                        () =>
                          merchantApi.updateOutletProduct(tenantId, outletId, item.assignment.id, {
                            availabilityOverride:
                              item.assignment.availabilityOverride === "SOLD_OUT"
                                ? null
                                : "SOLD_OUT",
                          }),
                        "Ketersediaan outlet diperbarui.",
                      )
                    }
                    size="xs"
                    variant="ghost"
                  >
                    {item.assignment.availabilityOverride === "SOLD_OUT"
                      ? "Ikuti master"
                      : "Sold out"}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void onMutate(
                        () =>
                          merchantApi.updateOutletProduct(tenantId, outletId, item.assignment.id, {
                            status: nextCatalogStatus(item.assignment.status),
                          }),
                        "Status assignment diperbarui.",
                      )
                    }
                    size="xs"
                    variant="ghost"
                  >
                    {item.assignment.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              ) : (
                "Baca saja"
              ),
            ])}
          />
        ) : (
          <EmptyState
            description="Belum ada produk yang ditugaskan ke outlet ini."
            title="Catalog outlet kosong"
          />
        )}
      </section>
    </div>
  );
}

export function CatalogBackoffice() {
  const [session, setSession] = useState<AuthSession | null>();
  const [workspaces, setWorkspaces] = useState<WorkspaceContext[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [outletId, setOutletId] = useState("");
  const [view, setView] = useState<View>("master");
  const [master, setMaster] = useState<CatalogSnapshot>();
  const [outlet, setOutlet] = useState<CatalogOutletSnapshot>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const workspace = workspaces.find((item) => item.tenant.id === tenantId);
  const canRead = workspace?.permissionKeys.includes(PERMISSIONS.catalogRead) ?? false;
  const canManage = workspace?.permissionKeys.includes(PERMISSIONS.catalogManage) ?? false;
  const canReadMaster = Boolean(workspace?.allOutlets && canRead);

  const loadWorkspaces = useCallback(async (activeSession: AuthSession) => {
    const contexts = await merchantApi.workspaces();
    setSession(activeSession);
    setWorkspaces(contexts);
    const selected = contexts[0];
    setTenantId(selected?.tenant.id ?? "");
    setOutletId(selected?.outlets[0]?.id ?? "");
    if (selected && !selected.allOutlets) setView("outlet");
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadWorkspaces(await merchantApi.session());
      } catch (cause) {
        if (cause instanceof ApiClientError && cause.status === 401) setSession(null);
        else setError(messageFrom(cause));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadWorkspaces]);

  const refresh = useCallback(async () => {
    if (!workspace || !canRead) return;
    setLoading(true);
    setError(undefined);
    try {
      const [nextMaster, nextOutlet] = await Promise.all([
        workspace.allOutlets
          ? merchantApi.catalog(workspace.tenant.id)
          : Promise.resolve(undefined),
        outletId
          ? merchantApi.outletCatalog(workspace.tenant.id, outletId)
          : Promise.resolve(undefined),
      ]);
      setMaster(nextMaster);
      setOutlet(nextOutlet);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setLoading(false);
    }
  }, [canRead, outletId, workspace]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function mutate(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await action();
      setNotice(success);
      await refresh();
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  }

  const tabs = useMemo(
    () => [
      { disabled: !canReadMaster, label: "Master", value: "master" },
      { disabled: !canReadMaster, label: "Composition", value: "composition" },
      { disabled: !outletId, label: "Outlet", value: "outlet" },
    ],
    [canReadMaster, outletId],
  );

  if (loading && session === undefined)
    return (
      <main className="catalog-boot">
        <Skeleton variant="metric-card" />
      </main>
    );
  if (session === null) return <Login onLoggedIn={loadWorkspaces} />;
  if (!session)
    return (
      <ErrorState
        action={<Button onClick={() => location.reload()}>Muat ulang</Button>}
        description={error ?? "Sesi tidak dapat diperiksa."}
        title="Backoffice tidak dapat dimuat"
      />
    );
  if (!workspaces.length)
    return (
      <main className="catalog-boot">
        <EmptyState
          description="Akun ini belum mempunyai membership tenant aktif."
          title="Workspace belum tersedia"
        />
      </main>
    );

  return (
    <div className="catalog-shell">
      <a className="catalog-skip-link" href="#catalog-content">
        Lewati navigasi
      </a>
      <aside className="catalog-shell__sidebar">
        <div className="catalog-shell__brand">
          <AppIcon icon={Store} size="lg" />
          <span>Merchant Ops</span>
        </div>
        <Sidebar
          items={[
            { icon: <AppIcon icon={LayoutDashboard} />, label: "Ringkasan" },
            {
              active: true,
              href: "/backoffice/catalog",
              icon: <AppIcon icon={Package} />,
              label: "Catalog",
            },
            { icon: <AppIcon icon={Building2} />, label: "Organisasi" },
          ]}
        />
      </aside>
      <div className="catalog-shell__main">
        <TopBar>
          <div className="catalog-topbar-context">
            <strong>{workspace?.tenant.name}</strong>
            <span>
              {workspace?.allOutlets
                ? "Akses semua outlet"
                : `${workspace?.outlets.length ?? 0} outlet ditugaskan`}
            </span>
          </div>
          <div className="catalog-topbar-actions">
            <ThemeSwitcher />
            <span className="catalog-user">
              <strong>{session.user.displayName}</strong>
              <small>{session.user.email}</small>
            </span>
            <Button
              iconLeft={LogOut}
              onClick={() => void merchantApi.logout().then(() => setSession(null))}
              size="sm"
              variant="ghost"
            >
              Keluar
            </Button>
          </div>
        </TopBar>
        <main className="catalog-content" id="catalog-content">
          <Breadcrumb items={[{ label: "Backoffice", href: "/" }, { label: "Catalog" }]} />
          <header className="catalog-page-header">
            <div>
              <p>CORE CATALOG</p>
              <h1>Catalog Control Center</h1>
              <span>Kelola master produk, composition, dan aturan jual per outlet.</span>
            </div>
            <Button
              iconLeft={RefreshCw}
              loading={loading}
              onClick={() => void refresh()}
              variant="outline"
            >
              Segarkan
            </Button>
          </header>
          <section className="catalog-context-bar">
            <LabeledSelect
              label="Tenant"
              onChange={(value) => {
                const next = workspaces.find((item) => item.tenant.id === value);
                setTenantId(value);
                setOutletId(next?.outlets[0]?.id ?? "");
                setView(next?.allOutlets ? "master" : "outlet");
              }}
              options={workspaces.map((item) => ({
                label: item.tenant.name,
                value: item.tenant.id,
              }))}
              value={tenantId}
            />
            <LabeledSelect
              label="Outlet"
              onChange={setOutletId}
              options={(workspace?.outlets ?? []).map((item) => ({
                description: item.code,
                label: item.name,
                value: item.id,
              }))}
              value={outletId}
            />
            <div className="catalog-context-badges">
              <Badge tone={canRead ? "success" : "danger"}>
                {canRead ? "catalog.read" : "Tanpa akses baca"}
              </Badge>
              <Badge tone={canManage ? "success" : "info"}>
                {canManage ? "catalog.manage" : "Read only"}
              </Badge>
            </div>
          </section>
          {error ? (
            <Alert onDismiss={() => setError(undefined)} title="Permintaan gagal" tone="danger">
              {error}
            </Alert>
          ) : null}
          {notice ? (
            <Alert
              onDismiss={() => setNotice(undefined)}
              title="Perubahan tersimpan"
              tone="success"
            >
              {notice}
            </Alert>
          ) : null}
          {!canRead ? (
            <ErrorState
              description="Role Anda tidak memiliki permission catalog.read pada tenant ini."
              title="Akses Catalog ditolak"
            />
          ) : (
            <>
              <section className="catalog-metrics">
                <MetricCard label="Kategori" value={master?.categories.length ?? "-"} />
                <MetricCard label="Produk master" value={master?.products.length ?? "-"} />
                <MetricCard label="Produk outlet" value={outlet?.items.length ?? "-"} />
                <MetricCard
                  label="Modifier"
                  value={
                    master ? master.modifierGroups.length + master.modifierOptions.length : "-"
                  }
                />
              </section>
              <Tabs items={tabs} onValueChange={(value) => setView(value as View)} value={view} />
              {loading ? (
                <div className="catalog-loading">
                  <Skeleton variant="table-row" />
                  <Skeleton variant="table-row" />
                  <Skeleton variant="table-row" />
                </div>
              ) : null}
              {!loading && view === "master" && master ? (
                <MasterCatalog
                  busy={busy}
                  canManage={canManage}
                  onMutate={mutate}
                  snapshot={master}
                  tenantId={tenantId}
                />
              ) : null}
              {!loading && view === "composition" && master ? (
                <CompositionCatalog
                  busy={busy}
                  canManage={canManage}
                  onMutate={mutate}
                  snapshot={master}
                  tenantId={tenantId}
                />
              ) : null}
              {!loading && view === "outlet" && outlet ? (
                <OutletCatalog
                  busy={busy}
                  canManage={canManage}
                  master={master}
                  onMutate={mutate}
                  outlet={outlet}
                  outletId={outletId}
                  tenantId={tenantId}
                />
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
