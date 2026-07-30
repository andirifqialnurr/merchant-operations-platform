import { test, expect } from "@playwright/test";

test("renders the foundation AppIcon story", async ({ page }) => {
  await page.goto("/iframe.html?id=foundation-appicon--default&viewMode=story");

  await expect(page.getByRole("img", { name: "Merchant outlet" })).toBeVisible();
});

test("renders the story contract states", async ({ page }) => {
  await page.goto("/iframe.html?id=foundation-story-contract--template&viewMode=story");

  await expect(page.getByRole("button", { name: "Default" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disabled" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Menyimpan perubahan..." })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Perubahan belum tersimpan");
});

test("renders the Button contract story", async ({ page }) => {
  await page.goto("/iframe.html?id=primitives-button--states&viewMode=story");

  await expect(page.getByRole("button", { name: "Simpan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disabled" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Menyimpan perubahan..." })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Hapus produk" })).toBeVisible();
});

test("validates the POS modifier picker interaction and mobile reflow", async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(
    "/iframe.html?id=domain-pos-modifier-picker--required-and-optional-groups&viewMode=story",
  );

  const dialog = page.getByRole("dialog", { name: "Sesuaikan pesanan" });
  const submit = page.getByRole("button", { name: "Tambahkan ke keranjang" });
  await expect(dialog).toBeVisible();
  await expect(page.getByText("Belum lengkap")).toHaveCount(2);
  await expect(submit).toBeDisabled();

  await page.getByRole("radio", { name: "Regular" }).press("Space");
  await page.getByRole("radio", { name: "Normal" }).press("Space");
  await expect(submit).toBeEnabled();

  await page.getByRole("checkbox", { name: /Extra espresso shot/ }).press("Space");
  await page.getByRole("checkbox", { name: /Coffee jelly/ }).press("Space");
  await expect(page.getByRole("checkbox", { name: /Whipped cream/ })).toBeDisabled();

  const note = page.getByRole("textbox", { name: "Catatan item" });
  await note.fill("Es sedikit, tanpa sedotan");
  await expect(note).toHaveValue("Es sedikit, tanpa sedotan");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates the POS cart detail, quantity, and mobile reflow", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-pos-cart--mobile-reflow&viewMode=story");

  const item = page.getByRole("article");
  await expect(item).toBeVisible();
  await expect(page.getByText(/Oat milk dengan nama modifier panjang/)).toHaveCount(0);
  await page.getByRole("button", { name: "Lihat detail (+2)" }).click();
  await expect(page.getByText(/Oat milk dengan nama modifier panjang/)).toBeVisible();

  await page.getByRole("button", { name: /Tambah Es kopi susu gula aren signature/ }).click();
  await expect(item.getByText("Rp105.000")).toBeVisible();
  await expect(page.getByRole("region", { name: "Ringkasan keranjang" })).toContainText("Rp75.900");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates Money Display states, exact values, and mobile reflow", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-shared-money-display--mobile-reflow&viewMode=story");

  await expect(page.getByText("Rp900.719.925.474.099.312.345")).toBeVisible();
  await expect(page.getByText("Total belum tersedia")).toBeAttached();
  await expect(page.locator(".ui-money-display--unavailable")).toHaveText("-Total belum tersedia");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates Finance Basic summary light dark and mobile read-only data guard", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/iframe.html?id=domain-finance-basic-summary--default&viewMode=story");

  await expect(page.getByRole("region", { name: "Ringkasan Finance Basic" })).toBeVisible();
  await expect(page.getByText("Sales")).toBeVisible();
  await expect(page.getByText("Expense")).toBeVisible();
  await expect(page.getByText("Other income")).toBeVisible();
  await expect(page.getByText("Cashbook")).toBeVisible();
  await expect(page.getByText("Mutasi kas")).toBeVisible();
  await expect(page.getByText("Rp4.850.000")).toBeVisible();
  await expect(page.getByText("Rp925.000")).toBeVisible();
  await expect(page.getByText("Rp300.000")).toBeVisible();
  await expect(page.getByText("Rp4.250.000")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByText(
      /payment|customer|phone|telepon|ledger|journal|invoice|receipt|token|hpp|cogs|profit|margin|reconciliation/i,
    ),
  ).toHaveCount(0);

  await page.goto("/iframe.html?id=domain-finance-basic-summary--theme-comparison&viewMode=story");
  await expect(
    page.locator('section[data-theme-preview="light"] .ui-finance-basic-summary'),
  ).toBeVisible();
  await expect(
    page.locator('section[data-theme-preview="dark"] .ui-finance-basic-summary'),
  ).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-finance-basic-summary--mobile&viewMode=story");
  await expect(page.getByRole("region", { name: "Ringkasan Finance Basic" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates Finance reconciliation summary and shift snapshot data guard", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/iframe.html?id=domain-finance-reconciliation-summary--default&viewMode=story");

  await expect(page.getByRole("region", { name: "Ringkasan rekonsiliasi Finance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tunai" })).toBeVisible();
  await expect(page.getByText("QRIS merchant").first()).toBeVisible();
  await expect(page.getByText("Transfer bank").first()).toBeVisible();
  await expect(page.getByText("-Rp15.000")).toBeVisible();
  await expect(page.getByText("Shift Summary")).toBeVisible();
  await expect(page.getByText("Kas fisik dihitung")).toBeVisible();
  await expect(page.getByText("Selisih kas")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByText(
      /payment|customer|phone|telepon|ledger|journal|invoice|receipt|token|hpp|cogs|profit|margin|refund|webhook|attachment/i,
    ),
  ).toHaveCount(0);

  await page.goto(
    "/iframe.html?id=domain-finance-reconciliation-summary--theme-comparison&viewMode=story",
  );
  await expect(
    page.locator('section[data-theme-preview="light"] .ui-finance-reconciliation'),
  ).toBeVisible();
  await expect(
    page.locator('section[data-theme-preview="dark"] .ui-finance-reconciliation'),
  ).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-finance-reconciliation-summary--mobile&viewMode=story");
  await expect(page.getByRole("region", { name: "Ringkasan rekonsiliasi Finance" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates Finance profit estimate light dark and unavailable HPP data guard", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/iframe.html?id=domain-finance-profit-estimate--default&viewMode=story");

  await expect(
    page.getByRole("region", { name: "Ringkasan estimasi profit Finance" }),
  ).toBeVisible();
  await expect(page.getByText("HPP estimate", { exact: true })).toBeVisible();
  await expect(page.getByText("Gross profit", { exact: true })).toBeVisible();
  await expect(page.getByText("Operating profit", { exact: true })).toBeVisible();
  await expect(page.getByText("Rp1.550.000")).toBeVisible();
  await expect(page.getByText("Rp3.300.000")).toBeVisible();
  await expect(page.getByText("Rp2.675.000")).toBeVisible();
  await expect(page.getByText("Estimasi operasional")).toHaveCount(3);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByText(
      /payment|customer|phone|telepon|ledger|journal|invoice|receipt|token|vendor|supplier|ingredient|raw|chart|reconciliation/i,
    ),
  ).toHaveCount(0);

  await page.goto(
    "/iframe.html?id=domain-finance-profit-estimate--inventory-unavailable&viewMode=story",
  );
  await expect(page.getByText("HPP belum tersedia")).toBeVisible();
  await expect(page.getByText("Gross profit belum tersedia")).toBeVisible();
  await expect(page.getByText("Operating profit belum tersedia")).toBeVisible();
  await expect(page.getByText("Rp0")).toHaveCount(0);

  await page.goto(
    "/iframe.html?id=domain-finance-profit-estimate--theme-comparison&viewMode=story",
  );
  await expect(
    page.locator('section[data-theme-preview="light"] .ui-finance-profit'),
  ).toBeVisible();
  await expect(page.locator('section[data-theme-preview="dark"] .ui-finance-profit')).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-finance-profit-estimate--mobile&viewMode=story");
  await expect(
    page.getByRole("region", { name: "Ringkasan estimasi profit Finance" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates Finance report table and chart only render validated metrics", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/iframe.html?id=domain-finance-validated-report--default&viewMode=story");

  await expect(page.getByRole("region", { name: "Report Finance tervalidasi" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Trend metrik tervalidasi" })).toBeVisible();
  const validatedReportTable = page.getByRole("region", { name: "Tabel metrik tervalidasi" });
  await expect(validatedReportTable).toBeVisible();
  await expect(page.locator(".apexcharts-svg").first()).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Sales Dari transaksi valid" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Expense Expense operasional" })).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "Gross profit Sales revenue dikurangi HPP estimate" }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "Operating profit Gross profit dikurangi expense" }),
  ).toBeVisible();
  await expect(page.getByText("Rp4.850.000")).toBeVisible();
  await expect(page.getByText("Rp925.000")).toBeVisible();
  await expect(page.getByText("Rp3.300.000")).toBeVisible();
  await expect(page.getByText("Rp2.675.000")).toBeVisible();
  await expect(validatedReportTable.getByText("Tervalidasi", { exact: true })).toHaveCount(4);
  await expect(page.getByText(/Draft|Belum valid|Pending/)).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByText(
      /payment|customer|phone|telepon|ledger|journal|invoice|receipt|token|vendor|supplier|ingredient|raw|reconciliation|webhook|attachment/i,
    ),
  ).toHaveCount(0);

  await page.goto(
    "/iframe.html?id=domain-finance-validated-report--trend-unavailable&viewMode=story",
  );
  await expect(page.getByText("Data chart belum tersedia")).toBeVisible();
  await expect(page.getByText("Belum ada titik trend tervalidasi untuk chart.")).toBeVisible();
  await expect(page.getByText("Rp0")).toHaveCount(0);

  await page.goto(
    "/iframe.html?id=domain-finance-validated-report--theme-comparison&viewMode=story",
  );
  await expect(
    page.locator('section[data-theme-preview="light"] .ui-finance-report'),
  ).toBeVisible();
  await expect(page.locator('section[data-theme-preview="dark"] .ui-finance-report')).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-finance-validated-report--mobile&viewMode=story");
  await expect(page.getByRole("region", { name: "Report Finance tervalidasi" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates payment selection, cash presets, keypad targets, and mobile reflow", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-pos-payment--mobile-reflow&viewMode=story");

  await expect(page.getByRole("radio", { name: /Tunai/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Kartu EDC/ })).toBeDisabled();
  const numericKeys = page.getByRole("group", { name: "Angka nominal tunai" }).getByRole("button");
  await expect
    .poll(async () =>
      Math.min(
        ...(await numericKeys.evaluateAll((keys) =>
          keys.map((key) => key.getBoundingClientRect().height),
        )),
      ),
    )
    .toBeGreaterThanOrEqual(56);

  await page.getByRole("button", { name: "Rp80.000" }).click();
  await expect(page.getByText("Rp4.100")).toBeVisible();
  await page.getByRole("radio", { name: /QRIS merchant/ }).press("Space");
  await expect(page.getByRole("region", { name: "Keypad pembayaran tunai" })).toHaveCount(0);
  await expect(page.getByText("Keypad tunai tidak digunakan untuk metode QRIS.")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates table layout tools interaction and mobile reflow", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(
    "/iframe.html?id=domain-table-layout-table-layout-tools--toolbar-and-property-panel&viewMode=story",
  );

  await expect(page.getByRole("complementary", { name: "Properti meja terpilih" })).toBeVisible();
  await expect(page.getByText("Meja 02")).toBeVisible();
  await expect(page.getByText("table-02")).toHaveCount(0);

  await page.getByRole("radio", { name: /Preview/ }).click();
  await expect(page.getByRole("radio", { name: /Preview/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: "Geser meja" }).click();
  await expect(page.getByRole("button", { name: "Geser meja" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("checkbox", { name: /Snap grid/ }).press("Space");
  await expect(page.getByRole("checkbox", { name: /Snap grid/ })).not.toBeChecked();
  await page.getByLabel("Kolom").fill("6");
  await expect(page.getByLabel("Kolom")).toHaveValue("6");

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-table-layout-table-layout-tools--mobile&viewMode=story");
  await expect(page.getByRole("toolbar")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates unplaced table tray interaction and mobile reflow", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(
    "/iframe.html?id=domain-table-layout-unplaced-table-tray--default&viewMode=story",
  );

  await expect(page.getByRole("region", { name: "Meja belum ditempatkan" })).toBeVisible();
  await expect(page.getByText("4 meja")).toBeVisible();
  await expect(page.getByText("3 siap ditempatkan")).toBeVisible();
  await expect(page.getByText("table-12")).toHaveCount(0);
  await page.getByRole("button", { name: "Tempatkan Meja 11" }).click();
  await expect(page.getByRole("button", { name: "Tempatkan Meja 11" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Meja Servis, Belum aktif" })).toBeDisabled();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-table-layout-unplaced-table-tray--mobile&viewMode=story");
  await expect(page.getByRole("region", { name: "Meja belum ditempatkan" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates table layout bounds, overlap, and keyboard movement", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(
    "/iframe.html?id=domain-table-layout-table-layout-canvas--bounds-overlap-and-keyboard&viewMode=story",
  );

  await expect(page.getByRole("status", { name: "Validasi layout meja" })).toContainText(
    "Meja A bertumpuk dengan Meja B.",
  );
  await expect(page.getByText("table-a")).toHaveCount(0);
  await page.getByRole("button", { name: "Pindahkan meja ke kanan" }).click();
  await expect(page.getByRole("button", { name: /Meja B, posisi kolom 3, baris 2/ })).toBeVisible();
  await page.getByRole("button", { name: /Meja B, posisi kolom 3, baris 2/ }).press("ArrowDown");
  await expect(page.getByRole("button", { name: /Meja B, posisi kolom 3, baris 3/ })).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(
    "/iframe.html?id=domain-table-layout-table-layout-canvas--bounds-overlap-and-keyboard&viewMode=story",
  );
  await expect(page.getByRole("group", { name: "Canvas layout meja" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates table QR actions and mobile reflow", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/iframe.html?id=domain-table-layout-table-qr--active&viewMode=story");

  await expect(page.getByRole("region", { name: "QR meja Meja 01" })).toBeVisible();
  await expect(page.getByText("Aktif")).toBeVisible();
  await expect(page.getByText("table-01")).toHaveCount(0);

  await page.getByRole("button", { name: "Cetak QR" }).click();
  await expect(page.getByText("QR dikirim ke antrian cetak.")).toBeVisible();
  await page.getByRole("button", { name: "Rotasi QR" }).click();
  await expect(page.getByText("QR dirotasi dan preview diperbarui.")).toBeVisible();
  await page.getByRole("button", { name: "Cabut QR" }).click();
  await expect(page.locator(".ui-table-qr__status")).toHaveText("Dicabut");
  await expect(page.getByRole("button", { name: "Buat QR" })).toBeEnabled();
  await page.getByRole("button", { name: "Buat QR" }).click();
  await expect(page.getByText("QR baru dibuat dan siap dicetak.")).toBeVisible();

  await page.goto("/iframe.html?id=domain-table-layout-table-qr--theme-comparison&viewMode=story");
  await expect(page.locator('section[data-theme-preview="light"] .ui-table-qr')).toBeVisible();
  await expect(page.locator('section[data-theme-preview="dark"] .ui-table-qr')).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-table-layout-table-qr--mobile&viewMode=story");
  await expect(page.getByRole("region", { name: "QR meja Meja 01" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates Customer Basic profile selection and privacy guard", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/iframe.html?id=domain-customer-basic-profile--default&viewMode=story");

  const customerBasic = page.locator(".ui-customer-basic").first();
  await expect(page.getByRole("region", { name: "Customer Basic" })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Customer Ayu Prameswari" })).toBeVisible();
  await expect(page.getByText("WA **** 1890")).toBeVisible();
  await expect(page.getByText("Kontak boleh dipakai untuk struk")).toBeVisible();
  await expect(page.getByText("Regular")).toBeVisible();
  await expect(page.getByText("120 poin")).toBeVisible();
  await expect
    .poll(() =>
      customerBasic.evaluate((element) =>
        /cust-safe|phone|telepon|email asli|address|alamat|order-|payment|token|audit|internal|session|cart-/i.test(
          element.textContent ?? "",
        ),
      ),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Bersihkan" }).click();
  await expect(page.getByText("Belum ada customer dipilih")).toBeVisible();
  await page.getByRole("button", { name: "Pilih" }).first().click();
  await expect(page.getByText("1 customer dipilih")).toBeVisible();

  await page.goto("/iframe.html?id=domain-customer-basic-profile--empty&viewMode=story");
  await expect(page.getByText("Customer belum tersedia.")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);

  await page.goto("/iframe.html?id=domain-customer-basic-profile--theme-comparison&viewMode=story");
  await expect(
    page.locator('section[data-theme-preview="light"] .ui-customer-basic'),
  ).toBeVisible();
  await expect(page.locator('section[data-theme-preview="dark"] .ui-customer-basic')).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-customer-basic-profile--mobile&viewMode=story");
  await expect(page.getByRole("region", { name: "Customer Basic" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates customer product cart and order status surface", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/iframe.html?id=domain-customer-order-surface--default&viewMode=story");

  const customerOrder = page.locator(".ui-customer-order").first();
  await expect(
    page.getByRole("region", { name: "Customer product cart dan order status" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Produk customer" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Cart customer" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Status order customer" })).toBeVisible();
  await expect(page.getByText("Kopi Senja - Cabang Meruya - Meja 05")).toBeVisible();
  await expect(page.getByText("Rp65.160")).toBeVisible();
  await expect(page.getByText("Belum dikirim")).toBeVisible();
  await expect
    .poll(() =>
      customerOrder.evaluate((element) =>
        /product-safe|cart-safe|phone|telepon|email|address|alamat|payment|token|audit|internal|session|cart-/i.test(
          element.textContent ?? "",
        ),
      ),
    )
    .toBe(false);

  await page.getByRole("button", { name: "Kirim pesanan" }).click();
  await expect(page.getByText("Order A-014")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Status order customer" })
      .getByText("Disiapkan", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Makanan\s*1 produk/ }).click();
  await expect(page.getByRole("button", { name: /Croissant/ })).toBeVisible();
  await page.getByRole("button", { name: "Hapus Kopi susu signature" }).click();
  await expect(page.getByText("Cart masih kosong.")).toBeVisible();

  await page.goto("/iframe.html?id=domain-customer-order-surface--empty-draft&viewMode=story");
  await expect(page.getByText("Produk kategori ini belum tersedia.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kirim pesanan" })).toBeDisabled();

  await page.goto("/iframe.html?id=domain-customer-order-surface--theme-comparison&viewMode=story");
  await expect(
    page.locator('section[data-theme-preview="light"] .ui-customer-order'),
  ).toBeVisible();
  await expect(page.locator('section[data-theme-preview="dark"] .ui-customer-order')).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-customer-order-surface--mobile&viewMode=story");
  await expect(
    page.getByRole("region", { name: "Customer product cart dan order status" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates platform tenant subscription master actions and data guard", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(
    "/iframe.html?id=domain-platform-tenant-subscription-master--default&viewMode=story",
  );

  const platformMaster = page.locator(".ui-platform-master").first();
  await expect(
    page.getByRole("region", { name: "Platform tenant subscription master" }),
  ).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Daftar tenant platform" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Subscription tenant platform" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Entitlement module platform" })).toBeVisible();
  await expect(page.getByText("Kopi Senja")).toBeVisible();
  await expect(page.getByText("Cafe Operations")).toBeVisible();
  await expect(page.getByText("3 aktif dari 4 modul")).toBeVisible();
  await expect
    .poll(() =>
      platformMaster.evaluate((element) =>
        /tenant-safe|CORE_|KDS|POS_BASIC|payment|billing|invoice|token|audit|actor|timestamp|outlet|customer|order/i.test(
          element.textContent ?? "",
        ),
      ),
    )
    .toBe(false);

  await page.getByRole("button", { name: /Roti Pagi/ }).click();
  await expect(page.getByRole("button", { name: /Roti Pagi/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("radio", { name: "Ditahan" }).click();
  await expect(page.getByRole("radio", { name: "Ditahan" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("switch", { name: "Nonaktif" }).press("Space");
  await expect(page.getByText("4 aktif dari 4 modul")).toBeVisible();
  await page.getByRole("button", { name: "Refresh master platform" }).click();
  await expect(page.getByText("Snapshot baru")).toBeVisible();

  await page.goto(
    "/iframe.html?id=domain-platform-tenant-subscription-master--empty-subscription&viewMode=story",
  );
  await expect(page.getByText("Subscription tenant belum tersedia.")).toBeVisible();
  await expect(page.getByText("Entitlement module belum tersedia.")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);

  await page.goto(
    "/iframe.html?id=domain-platform-tenant-subscription-master--theme-comparison&viewMode=story",
  );
  await expect(
    page.locator('section[data-theme-preview="light"] .ui-platform-master'),
  ).toBeVisible();
  await expect(
    page.locator('section[data-theme-preview="dark"] .ui-platform-master'),
  ).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(
    "/iframe.html?id=domain-platform-tenant-subscription-master--mobile&viewMode=story",
  );
  await expect(
    page.getByRole("region", { name: "Platform tenant subscription master" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates platform entitlement matrix actions and data guard", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/iframe.html?id=domain-platform-entitlement-matrix--default&viewMode=story");

  const matrix = page.locator(".ui-platform-entitlement-matrix").first();
  await expect(page.getByRole("region", { name: "Platform Entitlement Matrix" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Plan Entitlement Matrix" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Matrix module entitlement" })).toBeVisible();
  await expect(page.getByText("Cafe Operations")).toBeVisible();
  await expect(page.getByText("Kitchen Display")).toBeVisible();
  await expect(page.getByText("3").first()).toBeVisible();
  await expect
    .poll(() =>
      matrix.evaluate((element) =>
        /CAFE_OPS|POS_BASIC|CORE_|KITCHEN_DISPLAY|payment|billing|invoice|token|audit|actor|timestamp|customer|order|outlet/i.test(
          element.textContent ?? "",
        ),
      ),
    )
    .toBe(false);

  await page.getByRole("switch", { name: "Nonaktif" }).press("Space");
  await expect(page.getByText("4").first()).toBeVisible();
  await page.getByRole("button", { name: /POS Basic/ }).click();
  await expect(page.getByRole("button", { name: /POS Basic/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Refresh Entitlement Matrix" }).click();
  await expect(page.getByText("Matrix baru")).toBeVisible();

  await page.goto(
    "/iframe.html?id=domain-platform-entitlement-matrix--empty-modules&viewMode=story",
  );
  await expect(page.getByText("Module entitlement belum tersedia.")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);

  await page.goto(
    "/iframe.html?id=domain-platform-entitlement-matrix--theme-comparison&viewMode=story",
  );
  await expect(
    page.locator('section[data-theme-preview="light"] .ui-platform-entitlement-matrix'),
  ).toBeVisible();
  await expect(
    page.locator('section[data-theme-preview="dark"] .ui-platform-entitlement-matrix'),
  ).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-platform-entitlement-matrix--mobile&viewMode=story");
  await expect(page.getByRole("region", { name: "Platform Entitlement Matrix" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates customer QR resolution context and mobile reflow", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/iframe.html?id=domain-qr-self-order-customer-qr-context--ready&viewMode=story");

  await expect(page.getByRole("region", { name: "Konteks pesanan QR" })).toBeVisible();
  await expect(page.getByText("Kopi Senja")).toBeVisible();
  await expect(page.getByText("Cabang Meruya")).toBeVisible();
  await expect(page.getByText("Meja 05")).toBeVisible();
  await expect(page.getByText("Siap pesan")).toBeVisible();
  await expect(page.getByText(/table-|grid|token|session|floor|internal/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Mulai pesanan" }).click();
  await expect(page.getByText("Menu siap dibuka untuk meja ini.")).toBeVisible();

  await page.goto(
    "/iframe.html?id=domain-qr-self-order-customer-qr-context--invalid&viewMode=story",
  );
  await expect(page.getByRole("button", { name: "Coba lagi" })).toBeEnabled();
  await expect(page.locator(".ui-customer-qr__context")).toHaveCount(0);

  await page.goto(
    "/iframe.html?id=domain-qr-self-order-customer-qr-context--theme-comparison&viewMode=story",
  );
  await expect(page.locator('section[data-theme-preview="light"] .ui-customer-qr')).toBeVisible();
  await expect(page.locator('section[data-theme-preview="dark"] .ui-customer-qr')).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(
    "/iframe.html?id=domain-qr-self-order-customer-qr-context--mobile&viewMode=story",
  );
  await expect(page.getByRole("region", { name: "Konteks pesanan QR" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("validates KDS ticket states, actions, and mobile reflow", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/iframe.html?id=domain-kds-kitchen-ticket--default&viewMode=story");

  await expect(page.getByRole("article", { name: "Kitchen ticket Order A-014" })).toBeVisible();
  await expect(page.getByText("Order A-014")).toBeVisible();
  await expect(page.getByText("Meja 05")).toBeVisible();
  await expect(page.getByText("Pesanan baru")).toBeVisible();
  await expect(page.getByText("Nasi goreng kampung")).toBeVisible();
  await expect(page.getByText("Alergi kacang")).toBeVisible();
  await expect(
    page.getByText(
      /ticket-internal|Rp|harga|hpp|payment|telepon|customer|phone|price|cogs|cost|profit|invoice|receipt|token/i,
    ),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Terima" }).click();
  await expect(page.getByText("Diterima")).toBeVisible();
  await page.getByRole("button", { name: "Siap disajikan" }).click();
  await expect(page.getByText("Siap disajikan")).toBeVisible();

  await page.goto("/iframe.html?id=domain-kds-kitchen-ticket--sizes&viewMode=story");
  await expect(page.locator(".ui-kds-ticket--sm")).toBeVisible();
  await expect(page.locator(".ui-kds-ticket--md")).toBeVisible();
  await expect(page.locator(".ui-kds-ticket--lg")).toBeVisible();

  await page.goto("/iframe.html?id=domain-kds-kitchen-ticket--timer-and-sla&viewMode=story");
  await expect(page.getByText("Timer berjalan")).toHaveCount(2);
  await expect(page.getByText("Timer ditahan")).toBeVisible();
  await expect(page.getByText("Timer selesai")).toBeVisible();
  await expect(page.getByText("Sesuai SLA")).toHaveCount(2);
  await expect(page.getByText("Mendekati SLA")).toBeVisible();
  await expect(page.getByText("Lewat target pickup")).toBeVisible();
  await expect(
    page.getByText(
      /ticket-sla|threshold|deadline|hpp|payment|telepon|customer|phone|price|cogs|cost|profit|invoice|receipt|token/i,
    ),
  ).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);

  await page.goto("/iframe.html?id=domain-kds-kitchen-ticket--new-ticket-alert&viewMode=story");
  await expect(page.getByRole("status", { name: "Alert ticket baru KDS" }).first()).toBeVisible();
  await expect(page.getByText("3 ticket baru")).toBeVisible();
  await expect(page.getByText("Audio perlu izin perangkat")).toBeVisible();
  await expect(
    page.getByText(
      /alert-internal|audio-url|sound|ticket-|hpp|payment|telepon|customer|phone|price|cogs|cost|profit|invoice|receipt|token/i,
    ),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Aktifkan audio" }).click();
  await expect(page.getByText("Audio siap").first()).toBeVisible();
  await page.getByRole("button", { name: "Tandai dilihat" }).first().click();
  await expect(page.getByText("Alert sudah dilihat oleh operator dapur.")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);

  await page.goto("/iframe.html?id=domain-kds-kitchen-ticket--reconnect-refetch&viewMode=story");
  const connectionStatus = page.getByRole("region", { name: "Status koneksi KDS" }).first();
  await expect(connectionStatus).toBeVisible();
  await expect(connectionStatus.getByText("Terputus")).toBeVisible();
  await expect(page.getByText("2 ticket menunggu sinkron")).toBeVisible();
  await expect(
    page.getByText(
      /connection-internal|namespace|socket|event|token|hpp|payment|telepon|customer|phone|price|cogs|cost|profit|invoice|receipt/i,
    ),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reconnect" }).first()).toBeEnabled();
  await page.getByRole("button", { name: "Reconnect" }).first().click();
  await expect(page.getByText("Koneksi berhasil dipulihkan.")).toBeVisible();
  await expect(page.getByText("Tidak ada pending ticket").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh" }).first()).toBeEnabled();
  await page.getByRole("button", { name: "Simulasikan stale" }).click();
  await expect(page.getByText("Perlu refresh").first()).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).first().click();
  await expect(page.getByText("Snapshot ticket terbaru sudah diambil.")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);

  await page.goto("/iframe.html?id=domain-kds-kitchen-ticket--theme-comparison&viewMode=story");
  await expect(page.locator('section[data-theme-preview="light"] .ui-kds-ticket')).toBeVisible();
  await expect(page.locator('section[data-theme-preview="dark"] .ui-kds-ticket')).toBeVisible();
  await expect(
    page.locator('section[data-theme-preview="light"] .ui-kds-new-ticket-alert'),
  ).toBeVisible();
  await expect(
    page.locator('section[data-theme-preview="dark"] .ui-kds-new-ticket-alert'),
  ).toBeVisible();
  await expect(
    page.locator('section[data-theme-preview="light"] .ui-kds-connection-status'),
  ).toBeVisible();
  await expect(
    page.locator('section[data-theme-preview="dark"] .ui-kds-connection-status'),
  ).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/iframe.html?id=domain-kds-kitchen-ticket--mobile&viewMode=story");
  await expect(page.getByRole("article", { name: "Kitchen ticket Order A-014" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Alert ticket baru KDS" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Status koneksi KDS" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
