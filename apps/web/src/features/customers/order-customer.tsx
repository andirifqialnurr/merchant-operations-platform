"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type FormEvent, useDeferredValue, useId, useState } from "react";

import {
  customerPhoneSchema,
  PERMISSIONS,
  type CreateCustomer,
  type Customer,
} from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { CustomerBasicProfile } from "@merchant/ui/customer-basic-profile";
import { FormField, Input } from "@merchant/ui/form-field";
import { MoneyDisplay } from "@merchant/ui/money-display";
import { Textarea } from "@merchant/ui/textarea";

import { useWorkspace } from "@/features/workspace";
import { merchantApi } from "@/lib/api-client";
import { useErrorMessage, useFormat } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";

const customerKeys = {
  detail: (tenantId: string, id: string) => ["customers", tenantId, "detail", id] as const,
  ofOrder: (tenantId: string, orderId: string) =>
    ["customers", tenantId, "order", orderId] as const,
  search: (tenantId: string, q: string) => ["customers", tenantId, "search", q] as const,
};

/** How a customer is named on screen: their name, else the end of their number. */
function useCustomerName() {
  const t = useTranslations("customers");
  return (customer: Customer) =>
    customer.name ??
    (customer.phoneEnding ? t("phoneEnding", { digits: customer.phoneEnding }) : t("unnamed"));
}

/** The phone as the reader may see it: the number, or only its last digits. */
function useContactLabel() {
  const t = useTranslations("customers");
  return (customer: Customer) =>
    customer.phone ??
    (customer.phoneEnding ? t("phoneEnding", { digits: customer.phoneEnding }) : undefined);
}

function History({ customer, tenantId }: Readonly<{ customer: Customer; tenantId: string }>) {
  const t = useTranslations("customers");
  const { date, locale } = useFormat();
  const nameOf = useCustomerName();
  const detail = useQuery({
    queryFn: () => merchantApi.customerDetail(tenantId, customer.id),
    queryKey: customerKeys.detail(tenantId, customer.id),
  });
  const visits = detail.data?.visits ?? [];
  return (
    <section aria-label={t("historyRegion", { name: nameOf(customer) })} className="grid gap-2">
      {detail.isSuccess && visits.length === 0 ? (
        <p className="m-0 text-body-sm text-foreground-secondary">{t("historyEmpty")}</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-line-subtle p-0">
          {visits.map((visit) => (
            <li className="flex items-baseline justify-between gap-3 py-2" key={visit.orderNumber}>
              <span className="text-body-sm">
                {t("visitLine", { date: date(visit.at), order: visit.orderNumber })}
              </span>
              {visit.totalMinor !== null ? (
                <MoneyDisplay
                  amountMinor={visit.totalMinor}
                  locale={locale}
                  {...(visit.currency ? { currency: visit.currency } : {})}
                />
              ) : (
                <span className="text-body-sm text-foreground-secondary">{t("unpaid")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewCustomerForm({
  busy,
  onCancel,
  onCreate,
}: Readonly<{ busy: boolean; onCancel: () => void; onCreate: (input: CreateCustomer) => void }>) {
  const t = useTranslations("customers");
  const nameId = useId();
  const phoneId = useId();
  const noteId = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<"identity" | "phone">();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() && !phone.trim()) return setError("identity");
    const parsedPhone = phone.trim() ? customerPhoneSchema.safeParse(phone) : undefined;
    if (parsedPhone && !parsedPhone.success) return setError("phone");
    onCreate({
      ...(name.trim() ? { name: name.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(parsedPhone?.success ? { phone: parsedPhone.data } : {}),
    });
  }

  return (
    <form className="grid gap-3" noValidate onSubmit={submit}>
      <FormField
        {...(error === "identity" ? { error: t("nameOrPhoneRequired") } : {})}
        htmlFor={nameId}
        label={t("name")}
      >
        <Input
          autoFocus
          id={nameId}
          maxLength={120}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
          value={name}
        />
      </FormField>
      <FormField
        {...(error === "phone" ? { error: t("phoneInvalid") } : {})}
        htmlFor={phoneId}
        label={t("phone")}
        optionalLabel={t("optional")}
      >
        <Input
          id={phoneId}
          inputMode="tel"
          maxLength={24}
          onChange={(event) => {
            setPhone(event.target.value);
            setError(undefined);
          }}

          value={phone}
        />
      </FormField>
      <FormField htmlFor={noteId} label={t("note")} optionalLabel={t("optional")}>
        <Textarea
          id={noteId}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          value={note}
        />
      </FormField>
      <div className="flex gap-2">
        <Button loading={busy} type="submit">
          {t("add")}
        </Button>
        <Button onClick={onCancel} type="button" variant="ghost">
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

/**
 * The customer of an order on the cashier's order sheet: who it is linked
 * to and their visits, or finding or adding someone to link it to. Shown
 * only where Customer Basic is part of the workspace and the person may see
 * customers.
 */
export function OrderCustomer({
  canLink,
  orderId,
  outletId,
  tenantId,
}: Readonly<{ canLink: boolean; orderId: string; outletId: string; tenantId: string }>) {
  const t = useTranslations("customers");
  const { can } = useWorkspace();
  const notify = useToast();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const nameOf = useCustomerName();
  const contactOf = useContactLabel();
  const allowed = can(PERMISSIONS.customerView);
  const [mode, setMode] = useState<"adding" | "history" | "idle" | "linking">("idle");
  const [query, setQuery] = useState("");
  const searched = useDeferredValue(query);
  const searchId = useId();

  const linked = useQuery({
    enabled: allowed,
    queryFn: () => merchantApi.orderCustomer(tenantId, orderId),
    queryKey: customerKeys.ofOrder(tenantId, orderId),
    retry: false,
  });
  const results = useQuery({
    enabled: allowed && mode === "linking",
    queryFn: () => merchantApi.searchCustomers(tenantId, searched),
    queryKey: customerKeys.search(tenantId, searched.trim()),
  });

  const link = useMutation({
    mutationFn: async (target: { create: CreateCustomer } | { id: string }) => {
      const customerId =
        "id" in target ? target.id : (await merchantApi.createCustomer(tenantId, target.create)).id;
      return merchantApi.linkCustomerOrder(tenantId, outletId, customerId, orderId);
    },
    onError: (error) => notify({ message: errorMessage(error), tone: "danger" }),
    onSuccess: async (detail) => {
      queryClient.setQueryData(customerKeys.ofOrder(tenantId, orderId), {
        customer: detail.customer,
      });
      queryClient.setQueryData(customerKeys.detail(tenantId, detail.customer.id), detail);
      await queryClient.invalidateQueries({ queryKey: ["customers", tenantId, "search"] });
      setMode("idle");
      notify({ message: t("linked", { name: nameOf(detail.customer) }), tone: "success" });
    },
  });

  // Not part of this workspace (not included, not installed) or not this
  // person's to see: the order sheet simply has no customer part.
  if (!allowed || linked.isPending || linked.isError) return null;
  const customer = linked.data?.customer ?? null;
  if (!customer && !canLink) return null;

  return (
    <section
      aria-labelledby={`${searchId}-title`}
      className="grid gap-3 border-t border-line-default pt-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h3 className="m-0 text-body-sm text-foreground-secondary" id={`${searchId}-title`}>
            {t("customer")}
          </h3>
          {customer ? (
            <>
              <p className="m-0 text-label font-semibold [overflow-wrap:anywhere]">
                {nameOf(customer)}
              </p>
              <p className="m-0 text-body-sm text-foreground-secondary">
                {[contactOf(customer), t("visits", { count: customer.visitCount })]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {customer.note ? (
                <p className="m-0 text-body-sm italic text-foreground-secondary">{customer.note}</p>
              ) : null}
            </>
          ) : null}
        </div>
        {customer ? (
          <Button
            onClick={() => setMode(mode === "history" ? "idle" : "history")}
            size="sm"
            variant="secondary"
          >
            {mode === "history" ? t("hideHistory") : t("history")}
          </Button>
        ) : mode === "idle" ? (
          <Button onClick={() => setMode("linking")} size="sm" variant="secondary">
            {t("link")}
          </Button>
        ) : null}
      </div>

      {customer && mode === "history" ? <History customer={customer} tenantId={tenantId} /> : null}

      {!customer && mode === "linking" ? (
        <div className="grid gap-2">
          <FormField htmlFor={searchId} label={t("search")}>
            <Input
              autoFocus
              id={searchId}
              maxLength={120}
              onChange={(event) => setQuery(event.target.value)}
              variant="search"
              value={query}
            />
          </FormField>
          <CustomerBasicProfile
            disabled={link.isPending}
            items={(results.data?.customers ?? []).map((item) => ({
              ...(contactOf(item) ? { contactLabel: contactOf(item)! } : {}),
              displayName: nameOf(item),
              id: item.id,
              ...(item.note ? { noteLabel: item.note } : {}),
              ...(item.visitCount > 0
                ? { visitLabel: t("visits", { count: item.visitCount }) }
                : {}),
            }))}
            labels={{
              empty: t("searchEmpty"),
              region: t("results"),
              select: t("select"),
              selected: t("selected"),
            }}
            onSelectCustomer={(id) => link.mutate({ id })}
          />
          <div className="flex flex-wrap gap-2">
            {can(PERMISSIONS.customerManage) ? (
              <Button onClick={() => setMode("adding")} size="sm" variant="secondary">
                {t("addNew")}
              </Button>
            ) : null}
            <Button onClick={() => setMode("idle")} size="sm" variant="ghost">
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {!customer && mode === "adding" ? (
        <NewCustomerForm
          busy={link.isPending}
          onCancel={() => setMode("linking")}
          onCreate={(create) => link.mutate({ create })}
        />
      ) : null}
    </section>
  );
}
