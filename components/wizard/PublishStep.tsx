"use client";

import { Button, LinkButton } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";

type PublishStepProps = {
  canPublish: boolean;
  isPublishing: boolean;
  onPublish: () => void;
  publicUrl: string | null;
};

export function PublishStep({ canPublish, isPublishing, onPublish, publicUrl }: PublishStepProps) {
  const isPublished = Boolean(publicUrl);

  return (
    <Panel>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Publish frozen survey version</h3>
          <p className="mt-1 text-sm text-slate-600">Publishing binds the public URL to this validated schema version.</p>
        </div>
        {!isPublished ? (
          <Button disabled={!canPublish || isPublishing} onClick={onPublish} type="button">
            {isPublishing ? "Publishing..." : "Publish survey"}
          </Button>
        ) : null}
        {publicUrl ? (
          <div className="flex flex-wrap items-center gap-3 rounded bg-blue-50 p-3">
            <a className="break-all text-sm font-medium text-blue-700" href={publicUrl}>
              {publicUrl}
            </a>
            <CopyButton label="Copy URL" text={publicUrl} />
            <LinkButton href={publicUrl} rel="noreferrer" target="_blank" variant="secondary">
              Open
            </LinkButton>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
