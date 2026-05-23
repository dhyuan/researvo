"use client";

import { Save, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/Button";

type SchemaEditorProps = {
  value: string;
  parseError: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onValidate: () => void;
};

export function SchemaEditor({ value, parseError, onChange, onSave, onValidate }: SchemaEditorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[var(--hs-text)]" htmlFor="schema-json-editor">
        Schema JSON
      </label>
      <textarea
        id="schema-json-editor"
        className="min-h-[520px] w-full resize-y rounded-lg border border-[var(--hs-border)] bg-white p-4 font-mono text-sm leading-6 text-[var(--hs-text)] outline-none transition-colors focus:border-[var(--hs-primary)] focus:ring-3 focus:ring-[var(--hs-primary)]/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />
      {parseError ? <p className="text-sm text-[var(--hs-error)]">{parseError}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave}>
          <Save />
          Save draft
        </Button>
        <Button variant="secondary" onClick={onValidate}>
          <ShieldCheck />
          Validate
        </Button>
      </div>
    </div>
  );
}
