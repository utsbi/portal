import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// AssemblyAI REST endpoints. The Authorization header is the raw API key
// (no "Bearer" prefix) per AssemblyAI's contract.
const AAI_BASE = "https://api.assemblyai.com/v2";
const UPLOAD_URL = `${AAI_BASE}/upload`;
const TRANSCRIPT_URL = `${AAI_BASE}/transcript`;

// Reject oversized uploads early — voice notes from the composer are short.
const MAX_BYTES = 25 * 1024 * 1024; // ~25 MB

// Polling cadence and ceiling. Stay comfortably under maxDuration (60s).
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 50_000;

function jsonError(status: number, detail: string) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonOk(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  // Auth: only authenticated portal users may transcribe (the route owns the
  // AssemblyAI key, so this gate protects spend + the upstream credential).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError(401, "Unauthorized");

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    // Graceful degradation: the UI disables the mic on 501.
    return jsonError(501, "Transcription is not configured");
  }

  // The client sends raw audio bytes as the request body.
  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0) {
    return jsonError(400, "No audio received");
  }
  if (audio.byteLength > MAX_BYTES) {
    return jsonError(413, "Audio file is too large");
  }

  // Per-user rate limit (Supabase-backed counter, so it works across isolated
  // serverless instances without an in-memory store). AssemblyAI is billed per
  // audio duration, so this caps burst spend from a compromised/looping client.
  // 10/min is generous for the voice composer. Pair with an AssemblyAI account
  // budget cap (set out-of-band) as the catastrophic-cost backstop.
  const { data: allowed, error: rlErr } = await supabase.rpc(
    "consume_rate_token",
    { _bucket: "transcribe", _limit: 10, _window: "1 minute" },
  );
  if (rlErr) {
    // Fail open: best-effort cost guardrail, not a security gate. Don't break
    // the mic on a transient limiter error; the budget cap is the hard backstop.
    console.error(
      "[transcribe] rate-limit check failed (allowing)",
      rlErr.message,
    );
  } else if (allowed === false) {
    return jsonError(
      429,
      "Too many transcription requests. Please wait a moment.",
    );
  }

  try {
    // 1. Upload the raw audio bytes to AssemblyAI's temporary store.
    const uploadRes = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/octet-stream",
      },
      body: audio,
    });
    if (!uploadRes.ok) {
      console.error(
        "[transcribe] upload failed",
        uploadRes.status,
        await uploadRes.text().catch(() => ""),
      );
      return jsonError(502, "Transcription failed");
    }
    const { upload_url } = (await uploadRes.json()) as { upload_url?: string };
    if (!upload_url) {
      console.error("[transcribe] upload returned no upload_url");
      return jsonError(502, "Transcription failed");
    }

    // 2. Submit the transcript job.
    const submitRes = await fetch(TRANSCRIPT_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speech_model: "universal",
      }),
    });
    if (!submitRes.ok) {
      console.error(
        "[transcribe] submit failed",
        submitRes.status,
        await submitRes.text().catch(() => ""),
      );
      return jsonError(502, "Transcription failed");
    }
    const { id } = (await submitRes.json()) as { id?: string };
    if (!id) {
      console.error("[transcribe] submit returned no id");
      return jsonError(502, "Transcription failed");
    }

    // 3. Poll until completion, error, or our time budget runs out.
    const pollUrl = `${TRANSCRIPT_URL}/${id}`;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const pollRes = await fetch(pollUrl, {
        method: "GET",
        headers: { Authorization: apiKey },
      });
      if (!pollRes.ok) {
        console.error(
          "[transcribe] poll failed",
          pollRes.status,
          await pollRes.text().catch(() => ""),
        );
        return jsonError(502, "Transcription failed");
      }
      const result = (await pollRes.json()) as {
        status?: string;
        text?: string | null;
        error?: string | null;
      };

      if (result.status === "completed") {
        return jsonOk({ text: result.text ?? "" });
      }
      if (result.status === "error") {
        // Log the real upstream reason; never leak it to the client.
        console.error("[transcribe] upstream error", result.error);
        return jsonError(502, "Transcription failed");
      }
      // "queued" / "processing" — keep polling.
    }

    return jsonError(504, "Transcription timed out");
  } catch (err) {
    console.error("[transcribe] unexpected error", err);
    return jsonError(502, "Transcription failed");
  }
}
