'use client';

import { Button, Text } from '@aether-zone/kosmos';
import type { FileDTO } from '@aether/contract';
import { useState, useTransition } from 'react';
import { IoCloudDownloadOutline, IoWarningOutline } from 'react-icons/io5';

import { downloadAction } from '../actions';

/**
 * "4 KB", "1.2 MB", "2.4 GB" — bytes are not a thing anyone reads.
 *
 * The unit is chosen *after* rounding, not before. Rounding first and
 * comparing second is what stops 1,048,575 bytes rendering as "1024 KB" — a
 * number that is correct, reads as wrong, and would have made somebody check.
 */
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];

  let size = bytes;
  let unit = 0;

  while (unit < units.length - 1) {
    // One decimal place for anything above bytes, so the comparison has to be
    // made against the value as it will actually be shown.
    const shown = unit === 0 ? size : Number(size.toFixed(1));

    if (shown < 1024) {
      break;
    }

    size /= 1024;
    unit += 1;
  }

  return unit === 0
    ? `${size} B`
    : `${size.toFixed(1).replace(/\.0$/, '')} ${units[unit]}`;
}

/**
 * The stored object behind a resource, and the way to read it back.
 *
 * The URL is minted when the button is pressed, not when the page renders.
 * Presigned links expire, so one created with the page would stop working
 * while somebody was still looking at it — which is also why `FileDTO` carries
 * no URL of its own.
 *
 * An upload that never finished gets no button. The row exists and the bytes
 * do not, and a link to nothing is worse than an explanation.
 */
export function FileCard({ file }: { file: FileDTO }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const arrived = file.status === 'UPLOADED';

  function download() {
    setError(null);

    startTransition(async () => {
      const result = await downloadAction(file.id);

      if (result.error || !result.url) {
        setError(result.error ?? 'That file could not be fetched.');

        return;
      }

      /*
       * A real anchor, clicked. `window.open` is treated as a popup when it
       * does not come straight from a gesture, and this URL arrives one await
       * later — which is exactly the case a blocker stops. `download` asks the
       * browser to save rather than navigate, and the store's
       * `content-disposition` has the final say.
       */
      const link = document.createElement('a');

      link.href = result.url;
      link.download = file.originalName;
      link.rel = 'noreferrer';
      document.body.append(link);
      link.click();
      link.remove();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground">
            {file.originalName}
          </span>
          <Text tone="muted" size="body-small">
            {file.mimeType} · {formatSize(file.size)}
          </Text>
        </div>

        {arrived ? (
          <Button type="button" disabled={pending} onClick={download}>
            <IoCloudDownloadOutline className="size-4" aria-hidden />
            {pending ? 'Preparing…' : 'Download'}
          </Button>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <IoWarningOutline className="size-4 text-warning" aria-hidden />
            Upload never finished
          </span>
        )}
      </div>

      {!arrived && (
        <Text tone="muted" size="body-small">
          A link to put this file was issued, but the bytes never arrived — the
          upload was interrupted or abandoned. Filing the resource again will
          replace it.
        </Text>
      )}

      {error && (
        <Text tone="destructive" size="body-small">
          {error}
        </Text>
      )}
    </div>
  );
}
