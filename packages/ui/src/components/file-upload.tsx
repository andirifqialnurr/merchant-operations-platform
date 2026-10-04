"use client";

import { type DragEvent, useId, useRef, useState } from "react";
import { IconPhoto } from "@tabler/icons-react";

import { AppIcon } from "./app-icon";
import { Button } from "./button";
import { Progress } from "./feedback";

export type FileUploadProps = {
  /** Types the file dialog offers, e.g. "image/jpeg,image/png". */
  accept: string;
  /** Words of the button while nothing is chosen, e.g. "Pilih gambar". */
  chooseLabel: string;
  disabled?: boolean;
  /** Why the last file was not accepted or could not be uploaded. */
  error?: string;
  /** What may be uploaded, e.g. "JPG, PNG, WebP, atau AVIF. Maksimal 5 MB." */
  hint: string;
  /** Name of the field, e.g. "Gambar produk". */
  label: string;
  /** Called when the person removes the current file. Leave out when it cannot be removed. */
  onRemove?: () => void;
  /** Called with the file chosen in the dialog or dropped on the field. */
  onSelect: (file: File) => void;
  /** What the picture shows, for people who cannot see it. */
  previewAlt?: string;
  /** Address of the picture to show: the uploaded file, or a local preview while it uploads. */
  previewUrl?: string;
  /** 0 to 100 while a file is on its way; leave out otherwise. */
  progress?: number;
  /** The progress in words, e.g. "Mengunggah 40%". Required while `progress` is set. */
  progressLabel?: string;
  removeLabel?: string;
  /** Words of the button once there is a file, e.g. "Ganti". */
  replaceLabel: string;
};

/**
 * One file, usually a picture: choose or drop it, see it, watch it upload,
 * replace or remove it. The component only shows what it is told; choosing a
 * file hands it to `onSelect`, and the caller checks and uploads it.
 */
export function FileUpload({
  accept,
  chooseLabel,
  disabled = false,
  error,
  hint,
  label,
  onRemove,
  onSelect,
  previewAlt = "",
  previewUrl,
  progress,
  progressLabel,
  removeLabel,
  replaceLabel,
}: FileUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const [dragging, setDragging] = useState(false);
  const uploading = progress !== undefined;
  const locked = disabled || uploading;

  function take(files: FileList | null) {
    const file = files?.[0];
    if (file && !locked) onSelect(file);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    take(event.dataTransfer.files);
  }

  return (
    <div
      aria-describedby={error ? `${hintId} ${errorId}` : hintId}
      aria-labelledby={labelId}
      className="ui-file-upload"
      data-dragging={dragging ? "true" : undefined}
      data-invalid={error ? "true" : undefined}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => {
        if (locked) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDrop={drop}
      role="group"
    >
      <span className="ui-file-upload__label" id={labelId}>
        {label}
      </span>
      <div className="ui-file-upload__body">
        <div className="ui-file-upload__preview">
          {previewUrl ? (
            // The address is a signed or local URL, so the framework's image pipeline does not apply.
            <img alt={previewAlt} src={previewUrl} />
          ) : (
            <AppIcon icon={IconPhoto} size="xl" />
          )}
        </div>
        <div className="ui-file-upload__controls">
          <div className="ui-file-upload__actions">
            <Button
              disabled={locked}
              onClick={() => input.current?.click()}
              size="sm"
              variant="secondary"
            >
              {previewUrl ? replaceLabel : chooseLabel}
            </Button>
            {previewUrl && onRemove && removeLabel ? (
              <Button disabled={locked} onClick={onRemove} size="sm" variant="ghost">
                {removeLabel}
              </Button>
            ) : null}
          </div>
          {uploading ? (
            <div className="ui-file-upload__progress">
              <Progress label={progressLabel ?? label} value={progress} />
              {progressLabel ? <span aria-hidden="true">{progressLabel}</span> : null}
            </div>
          ) : null}
          <p className="ui-file-upload__hint" id={hintId}>
            {hint}
          </p>
          {error ? (
            <p className="ui-file-upload__error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <input
        accept={accept}
        aria-labelledby={labelId}
        className="ui-visually-hidden"
        disabled={locked}
        onChange={(event) => {
          take(event.target.files);
          // Choosing the same file again must count as a new choice.
          event.target.value = "";
        }}
        ref={input}
        tabIndex={-1}
        type="file"
      />
    </div>
  );
}
