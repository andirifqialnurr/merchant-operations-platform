import type { FileUploadTicket } from "@merchant/contracts";

/** The storage refused or could not be reached. The status is 0 when nothing answered. */
export class UploadError extends Error {
  constructor(readonly status: number) {
    super(`Upload failed with status ${status}.`);
    this.name = "UploadError";
  }
}

/**
 * Sends one file straight to the object storage with the ticket the API gave.
 * `fetch` cannot report upload progress, so this uses XMLHttpRequest.
 */
export function uploadWithTicket(
  ticket: FileUploadTicket,
  body: Blob,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(ticket.method, ticket.uploadUrl);
    for (const [name, value] of Object.entries(ticket.headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new UploadError(request.status));
    };
    request.onerror = () => reject(new UploadError(0));
    request.onabort = () => reject(new UploadError(0));
    request.send(body);
  });
}
