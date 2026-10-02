"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { Button } from "@merchant/ui/button";
import { Alert } from "@merchant/ui/feedback";
import { FormField, Input } from "@merchant/ui/form-field";

import { useErrorMessage } from "@/lib/i18n";

import { useLogin } from "./api";

export function LoginForm({ onSignedIn }: Readonly<{ onSignedIn: () => void }>) {
  const t = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password }, { onSuccess: onSignedIn });
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <h1 className="text-heading-lg">{t("title")}</h1>
      {login.error ? (
        <Alert title={t("failed")} tone="danger">
          {errorMessage(login.error)}
        </Alert>
      ) : null}
      <FormField htmlFor="login-email" label={t("email")}>
        <Input
          autoComplete="email"
          id="login-email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          size="lg"
          value={email}
        />
      </FormField>
      <FormField htmlFor="login-password" label={t("password")}>
        <Input
          autoComplete="current-password"
          hidePasswordLabel={t("hidePassword")}
          id="login-password"
          onChange={(event) => setPassword(event.target.value)}
          showPasswordLabel={t("showPassword")}
          size="lg"
          value={password}
          variant="password"
        />
      </FormField>
      <Button
        fullWidth
        loading={login.isPending}
        loadingLabel={t("signingIn")}
        size="lg"
        type="submit"
      >
        {t("signIn")}
      </Button>
    </form>
  );
}
