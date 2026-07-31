import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { PlatformSupportAudit, type PlatformSupportAuditProps } from "./platform-support-audit";

const supportAuditProps: PlatformSupportAuditProps = {
  contexts: [
    {
      channelLabel: "Support live",
      key: "SUPPORT_LIVE",
      label: "Live issue",
      priorityLabel: "Prioritas tinggi",
      scopeLabel: "Operasional platform",
      selected: true,
      state: "OPEN",
      summaryLabel: "Tim support sedang memantau dampak layanan.",
    },
    {
      channelLabel: "Policy review",
      key: "POLICY_REVIEW",
      label: "Policy follow-up",
      scopeLabel: "Kontrol internal",
      state: "WATCHING",
      summaryLabel: "Menunggu review owner platform.",
    },
    {
      channelLabel: "Support live",
      disabled: true,
      disabledReason: "Context selesai dan hanya tampil sebagai referensi.",
      key: "RESOLVED_CASE",
      label: "Resolved case",
      scopeLabel: "Riwayat operasional",
      state: "RESOLVED",
    },
  ],
  events: [
    {
      categoryLabel: "Access control",
      contextKey: "SUPPORT_LIVE",
      detailLabel: "Perubahan module ditahan sampai policy selesai diverifikasi.",
      key: "EVENT_POLICY_HOLD",
      resolutionLabel: "Menunggu persetujuan platform.",
      severity: "WARNING",
      sourceLabel: "System policy",
      stateLabel: "Perlu review",
      timeLabel: "Baru saja",
      title: "Entitlement hold",
    },
    {
      categoryLabel: "Support",
      contextKey: "SUPPORT_LIVE",
      detailLabel: "Support context dibuka dari alert operasional.",
      key: "EVENT_CONTEXT_OPENED",
      severity: "INFO",
      sourceLabel: "Support queue",
      stateLabel: "Tercatat",
      title: "Context opened",
    },
    {
      categoryLabel: "Access control",
      contextKey: "POLICY_REVIEW",
      detailLabel: "Policy review selesai tanpa perubahan module.",
      key: "EVENT_POLICY_CLEARED",
      resolutionLabel: "Tidak ada aksi lanjutan.",
      severity: "SUCCESS",
      sourceLabel: "System policy",
      stateLabel: "Selesai",
      title: "Policy cleared",
    },
  ],
  selectedContextKey: "SUPPORT_LIVE",
  sourceLabel: "Platform Owner",
  statusLabel: "Support tersinkron",
};

describe("PlatformSupportAudit", () => {
  it("renders support context and audit event labels without exposing hidden values or sensitive data", () => {
    render(<PlatformSupportAudit {...supportAuditProps} />);

    expect(screen.getByRole("region", { name: "Support context dan Audit Event" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "Daftar Support context" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Daftar Audit Event" })).toBeVisible();
    expect(screen.getAllByText("Live issue")).toHaveLength(2);
    expect(screen.getByText("Entitlement hold")).toBeVisible();
    expect(
      screen.getByText("Perubahan module ditahan sampai policy selesai diverifikasi."),
    ).toBeVisible();
    expect(screen.getByText("1")).toBeVisible();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.queryByText(
        /SUPPORT_LIVE|POLICY_REVIEW|EVENT_|tenant-|user-|customer|order|payment|billing|invoice|token|actor|timestamp|raw|payload|permission/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("calls actions with hidden context value only", async () => {
    const onRefresh = vi.fn();
    const onSelectContext = vi.fn();
    const user = userEvent.setup();

    render(
      <PlatformSupportAudit
        {...supportAuditProps}
        onRefresh={onRefresh}
        onSelectContext={onSelectContext}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Policy follow-up/ }));
    expect(onSelectContext).toHaveBeenCalledWith("POLICY_REVIEW");

    await user.click(screen.getByRole("button", { name: "Refresh Support Audit" }));
    expect(onRefresh).toHaveBeenCalledWith();
  });

  it("renders empty event state without fake event values", () => {
    render(<PlatformSupportAudit {...supportAuditProps} events={[]} />);

    expect(screen.getByText("Audit Event untuk context ini belum tersedia.")).toBeVisible();
    expect(screen.getByText("0")).toBeVisible();
    expect(screen.queryByText("Entitlement hold")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("rejects sensitive fields, unknown action props, and orphan events", () => {
    expect(() =>
      render(
        <PlatformSupportAudit
          {...({
            ...supportAuditProps,
            contexts: [{ ...supportAuditProps.contexts[0], tenantId: "tenant-01" }],
          } as unknown as PlatformSupportAuditProps)}
        />,
      ),
    ).toThrow(/tenantId/);

    expect(() =>
      render(
        <PlatformSupportAudit
          {...({
            ...supportAuditProps,
            events: [{ ...supportAuditProps.events[0], auditActor: "owner" }],
          } as unknown as PlatformSupportAuditProps)}
        />,
      ),
    ).toThrow(/auditActor/);

    expect(() =>
      render(
        <PlatformSupportAudit
          {...({
            ...supportAuditProps,
            rawPayload: {},
          } as unknown as PlatformSupportAuditProps)}
        />,
      ),
    ).toThrow(/rawPayload/);

    expect(() =>
      render(
        <PlatformSupportAudit
          {...({
            ...supportAuditProps,
            onResolveCase: () => undefined,
          } as PlatformSupportAuditProps & { onResolveCase: () => void })}
        />,
      ),
    ).toThrow(/onResolveCase/);

    expect(() =>
      render(
        <PlatformSupportAudit
          {...supportAuditProps}
          events={[{ ...supportAuditProps.events[0]!, contextKey: "MISSING_CONTEXT" }]}
        />,
      ),
    ).toThrow(/support context/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<PlatformSupportAudit {...supportAuditProps} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
