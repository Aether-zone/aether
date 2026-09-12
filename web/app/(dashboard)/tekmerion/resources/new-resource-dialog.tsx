'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Label,
  Select,
  Text,
  Textarea,
} from '@aether-zone/kosmos';
import { RESOURCE_TYPES, type UserDTO } from '@aether/contract';
import { useState, useTransition, type FormEvent } from 'react';

import { PersonAutocomplete } from '@/components/person-autocomplete';

import {
  addResourceAction,
  markUploadedAction,
  presignUploadAction,
} from './actions';
import { KINDS } from './kinds';

/**
 * Filing one.
 *
 * The kind is the only required field, so the fast path is: pick it, paste the
 * thing, done. A title is offered but not asked for — most resources arrive
 * without one, and the list derives a name from the first line of the content
 * rather than making somebody invent one at the door.
 */
export function NewResourceDialog({
  people,
  open,
  onOpenChange,
}: {
  people: UserDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [type, setType] = useState<string>('NOTE');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [involves, setInvolves] = useState<string[]>([]);
  const [chosen, setChosen] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const wantsFile = type === 'FILE';

  /*
   * A file resource needs a file; everything else needs something to show. The
   * two conditions differ because a `FILE` with only a title is a record of
   * nothing, where a note with only a title is a perfectly good note.
   */
  const fileable = wantsFile
    ? chosen !== null
    : content.trim() !== '' || title.trim() !== '' || url.trim() !== '';

  function close() {
    setType('NOTE');
    setTitle('');
    setContent('');
    setUrl('');
    setTags('');
    setInvolves([]);
    setChosen(null);
    setUploading(false);
    setError(null);
    onOpenChange(false);
  }

  function file(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fileable) {
      return;
    }

    setError(null);

    startTransition(async () => {
      /*
       * Three steps, in this order, and each can fail on its own.
       *
       * 1. Ask aether where the bytes may go. It writes a row expecting them
       *    and hands back a URL and a `fileId`.
       * 2. PUT the bytes at the URL — straight to the store, not through
       *    aether, which is the entire reason for presigning.
       * 3. Tell aether they arrived, then file the resource against the id.
       *
       * Stopping between 1 and 3 leaves a file row at `INITIAL` and no
       * resource. That is the honest record of an upload that did not finish,
       * and it is why the status exists.
       */
      let fileId: string | undefined;

      if (wantsFile && chosen) {
        setUploading(true);

        const prepared = await presignUploadAction({
          fileName: chosen.name,
          // Browsers leave this empty for types they do not recognise, and an
          // empty content type fails the contract's media-type check.
          contentType: chosen.type || 'application/octet-stream',
          size: chosen.size,
        });

        if (prepared.error || !prepared.prepared) {
          setUploading(false);
          setError(prepared.error ?? 'The upload could not start.');

          return;
        }

        const put = await fetch(prepared.prepared.uploadUrl, {
          method: 'PUT',
          body: chosen,
          headers: {
            'content-type': chosen.type || 'application/octet-stream',
          },
        }).catch(() => null);

        setUploading(false);

        if (!put?.ok) {
          setError(
            'The file could not be uploaded to the store. Nothing was filed.',
          );

          return;
        }

        const claimed = await markUploadedAction(prepared.prepared.fileId);

        if (claimed.error) {
          setError(claimed.error);

          return;
        }

        fileId = prepared.prepared.fileId;
      }

      const result = await addResourceAction({
        type,
        // A file with no title of its own is named after the file.
        ...(title.trim()
          ? { title: title.trim() }
          : chosen
            ? { title: chosen.name }
            : {}),
        ...(fileId ? { fileId } : {}),
        ...(content.trim() ? { content } : {}),
        ...(url.trim() ? { url: url.trim() } : {}),
        /*
         * Split on commas, not spaces. A tag is a label somebody chose and
         * "personal knowledge" is one of them — splitting on whitespace would
         * quietly turn it into two that nobody meant.
         */
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        involves,
        source: { type: 'console', name: 'Typed into the console' },
      });

      if (result.error || result.fieldErrors) {
        setError(
          result.error ??
            Object.values(result.fieldErrors ?? {})[0] ??
            'That could not be filed.',
        );

        return;
      }

      close();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <form onSubmit={file} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New resource</DialogTitle>
            <DialogDescription>
              The artefact itself. What it means is arachni&rsquo;s business and
              what it says is mneme&rsquo;s.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Text tone="destructive" size="body-small">
              {error}
            </Text>
          )}

          <div className="flex flex-wrap gap-4">
            <Field className="w-44">
              <Label htmlFor="new-resource-type">Kind</Label>
              <Select
                id="new-resource-type"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {RESOURCE_TYPES.map((kind) => (
                  <option key={kind} value={kind}>
                    {KINDS[kind].label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field className="min-w-48 flex-1">
              <Label htmlFor="new-resource-title">Title</Label>
              <Input
                id="new-resource-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>

          {wantsFile && (
            <Field>
              <Label htmlFor="new-resource-file">File</Label>
              <input
                id="new-resource-file"
                type="file"
                onChange={(event) => setChosen(event.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:border-muted-foreground/40"
              />
              <Text tone="muted" size="body-small">
                {chosen
                  ? `${chosen.name} · ${Math.ceil(chosen.size / 1024)} KB`
                  : 'Uploaded straight to the store — the bytes do not pass through aether.'}
              </Text>
            </Field>
          )}

          <Field>
            <Label htmlFor="new-resource-url">Address</Label>
            <Input
              id="new-resource-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Optional. Where it came from."
            />
          </Field>

          <Field>
            <Label htmlFor="new-resource-content">Content</Label>
            <Textarea
              id="new-resource-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              placeholder="Paste or write the thing itself…"
            />
          </Field>

          <Field>
            <Label htmlFor="new-resource-tags">Tags</Label>
            <Input
              id="new-resource-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="graph, modelling, reference"
            />
            <Text tone="muted" size="body-small">
              Separated by commas. Lowercased, so one word is one label.
            </Text>
          </Field>

          <Field>
            <Label htmlFor="new-resource-involves">About</Label>
            <PersonAutocomplete
              id="new-resource-involves"
              people={people}
              selected={involves}
              onChange={setInvolves}
              disabled={pending}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !fileable}>
              {uploading ? 'Uploading…' : 'File it'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
