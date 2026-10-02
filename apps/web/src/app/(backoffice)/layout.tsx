"use client";

import { type ReactNode } from "react";

import { BackofficeShell } from "@/shell/backoffice-shell";
import { SessionGate } from "@/shell/session-gate";

export default function BackofficeLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SessionGate>
      {({ signOut, user }) => (
        <BackofficeShell onSignOut={signOut} user={user}>
          {children}
        </BackofficeShell>
      )}
    </SessionGate>
  );
}
