"use client";

import { type ReactNode } from "react";

import { KdsShell } from "@/shell/kds-shell";
import { SessionGate } from "@/shell/session-gate";

export default function KdsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SessionGate toastPlacement="top-center">
      {({ signOut, user }) => (
        <KdsShell onSignOut={signOut} user={user}>
          {children}
        </KdsShell>
      )}
    </SessionGate>
  );
}
