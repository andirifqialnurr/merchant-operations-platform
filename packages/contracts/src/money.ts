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
