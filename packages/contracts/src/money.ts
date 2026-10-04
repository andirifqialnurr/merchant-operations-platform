import * as z from "zod";

export const moneyMinorSchema = z
  .string()
  .regex(/^(?:0|[1-9][0-9]{0,17})$/)
  .meta({ description: "Non-negative amount in currency minor units", example: "25000" });

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/)
  .meta({ example: "IDR" });

export const positiveMoneyMinorSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,17}$/)
  .meta({ description: "Positive amount in currency minor units", example: "50000" });

export const signedMoneyMinorSchema = z
  .string()
  .regex(/^(?:0|-?[1-9][0-9]{0,17})$/)
  .meta({ description: "Signed amount in currency minor units", example: "-5000" });

/** The currencies a workspace can run its business in (PRD Modular 6.5). */
export const WORKSPACE_CURRENCIES = ["IDR", "USD"] as const;

export const workspaceCurrencySchema = z.enum(WORKSPACE_CURRENCIES);

export type WorkspaceCurrency = z.infer<typeof workspaceCurrencySchema>;

/**
 * How many decimal places one minor unit stands for. Every stored amount is a
 * whole number of minor units: 25000 is Rp25.000 and 1025 is $10.25. The
 * numbers are fixed here, not read from the device, so an amount never changes
 * meaning between machines.
 */
export const CURRENCY_MINOR_DIGITS: Record<WorkspaceCurrency, number> = { IDR: 0, USD: 2 };
