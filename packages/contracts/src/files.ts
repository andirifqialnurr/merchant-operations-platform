import * as z from "zod";

/** What an uploaded file is for. It decides who may upload, which types, and how large. */
export const filePurposeSchema = z.enum(["CATALOG_PRODUCT_IMAGE"]);

/** Bytes. The limit per purpose is enforced by the API; this only bounds the number. */
export const fileSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(100 * 1024 * 1024);

export const fileUploadRequestSchema = z.object({
  /** As the browser reports it; the API checks the file itself after the upload. */
  contentType: z.string().trim().toLowerCase().min(3).max(100),
  purpose: filePurposeSchema,
  sizeBytes: fileSizeSchema,
});

/** Where and how to upload one file. The URL works for one file, for a few minutes. */
export const fileUploadTicketSchema = z.object({
  expiresAt: z.iso.datetime(),
  /** Headers the upload request must send, exactly as given. */
  headers: z.record(z.string(), z.string()),
  method: z.literal("PUT"),
  /** The name the file will have in storage; pass it on when attaching the file. */
  objectKey: z.string().min(3).max(512),
  uploadUrl: z.url(),
});

export type FilePurpose = z.infer<typeof filePurposeSchema>;

export type FileUploadRequest = z.infer<typeof fileUploadRequestSchema>;

export type FileUploadTicket = z.infer<typeof fileUploadTicketSchema>;
