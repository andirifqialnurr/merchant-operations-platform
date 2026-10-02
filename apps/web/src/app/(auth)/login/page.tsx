"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { LoginForm } from "@/features/auth";

/** Only same-origin paths are accepted so the redirect cannot leave the app. */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/catalog";
}

function Login() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  return <LoginForm onSignedIn={() => router.replace(next)} />;
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-lg border border-line-default bg-surface p-6">
        <Suspense>
          <Login />
        </Suspense>
      </div>
    </main>
  );
}
