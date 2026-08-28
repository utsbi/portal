"use client";

import { useActionState } from "react";
import { type AuthContinueState, continueAuthAction } from "./actions";

const initialState: AuthContinueState = { error: null };

export function ContinueForm({
  tokenHash,
  type,
}: {
  tokenHash: string;
  type: string;
}) {
  const [state, formAction, isPending] = useActionState(
    continueAuthAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      {state.error && (
        <p className="text-sm text-red-300" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center border border-sbi-green/30 bg-sbi-green/10 px-6 py-4 text-sm font-medium uppercase tracking-[0.16em] text-sbi-green transition-colors hover:bg-sbi-green hover:text-sbi-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Opening…" : "Continue to SBI Portal"}
      </button>
    </form>
  );
}
