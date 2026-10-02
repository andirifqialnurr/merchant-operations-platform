"use client";

import { type ReactNode } from "react";

import { PosShell } from "@/shell/pos-shell";
import { SessionGate } from "@/shell/session-gate";

export default function PosLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SessionGate toastPlacement="top-center">
      {({ signOut, user }) => (
        <PosShell onSignOut={signOut} user={user}>
          {children}
        </PosShell>
      )}
    </SessionGate>
  );
}
