/**
 * PUBLISH — the author button writes straight to the repo, no download and no hand-off.
 *
 * Christopher: *"shouldn't the extension be connected to the github and it post to that since
 * this will be the way that only my author button sends changes… if small changes like moving
 * hp, moving ac, or even creating each creature for act 4 then handing them to you is what burns
 * usage."*
 *
 * The download was never the design, it was the only transport a browser had to a repo it cannot
 * write. GitHub's contents API is that transport. The payload is byte-for-byte the one the
 * download produced, so `fold-authoring` consumes it unchanged either way.
 *
 * ─── WHAT HAPPENS AFTER THE BUTTON ──────────────────────────────────────────────────────────
 *
 *   this file        PUT authoring/current.json on a branch
 *   fold-authoring   folds it, runs every gate, commits authored.generated.ts back
 *   gates            runs again on the merge to main
 *
 * The workflow is the reason this writes to a BRANCH and not to main. A payload that breaks a
 * check stops on a red run with nothing merged, which is the whole point of putting CI between
 * the author button and the release.
 *
 * ─── ⚠ THE TOKEN, PLAINLY ───────────────────────────────────────────────────────────────────
 *
 * A token used from a browser is readable by anyone who can open devtools on that page. There is
 * no way around that and no point pretending otherwise, so the exposure is bounded instead:
 *
 *   · it is entered by the DM and lives in this browser's storage — never in the bundle, never
 *     in the repo, never in a commit
 *   · it should be a FINE-GRAINED personal access token, scoped to this ONE repository, with
 *     `Contents: read and write` and nothing else
 *   · give it an expiry, and make the branch it writes to one that requires the gates to pass
 *
 * A classic token, or a fine-grained one scoped to all repositories, gives whoever reads it the
 * run of the account. Do not use one.
 */
import { safeStorage } from "../utils/safeStorage";
import { collectCampaignAuthoring } from "./authorExport";

const TOKEN_KEY = "fdmc.publish.token";
const CONFIG_KEY = "fdmc.publish.config";

/** Where the payload lands. `fold-authoring.yml` watches exactly this path. */
export const PAYLOAD_PATH = "authoring/current.json";

export type PublishConfig = {
  /** e.g. "fdmcadmin" */
  owner: string;
  /** e.g. "fdmc-forever-dm-combat" */
  repo: string;
  /**
   * The branch the author button writes to. NOT main: what reaches main is a merge that the
   * gates have passed. Defaults to a dedicated branch so an in-progress authoring session
   * cannot collide with hand-written commits.
   */
  branch: string;
};

const DEFAULT_CONFIG: PublishConfig = {
  owner: "fdmcadmin",
  repo: "fdmc-forever-dm-combat",
  branch: "authoring",
};

export function loadPublishConfig(): PublishConfig {
  try {
    const raw = safeStorage().getItem(CONFIG_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) as Partial<PublishConfig> } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function savePublishConfig(config: Partial<PublishConfig>): void {
  try {
    safeStorage().setItem(CONFIG_KEY, JSON.stringify({ ...loadPublishConfig(), ...config }));
  } catch { /* storage refused — the DM keeps the defaults for this session */ }
}

/** The token never leaves this browser except as an Authorization header to api.github.com. */
export function loadPublishToken(): string {
  try { return safeStorage().getItem(TOKEN_KEY) ?? ""; } catch { return ""; }
}

export function savePublishToken(token: string): void {
  try {
    if (token) safeStorage().setItem(TOKEN_KEY, token.trim());
    else safeStorage().removeItem(TOKEN_KEY);
  } catch { /* nothing to do — publishing will report the missing token */ }
}

export function hasPublishToken(): boolean {
  return loadPublishToken().length > 0;
}

/** UTF-8 safe base64 — `btoa` alone throws on any character above U+00FF, and creature prose has them. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

type GitHubError = { message?: string; status?: string };

async function gh(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

export type PublishResult = {
  ok: boolean;
  message: string;
  /** Set on success — where to watch the gates run. */
  url?: string;
};

/**
 * Write the current authoring payload to the repo.
 *
 * ⚠ THE SHA IS NOT OPTIONAL. GitHub's contents API refuses to overwrite a file unless you hand
 * back the sha of the version you are replacing. That is the concurrency guard, and it is why
 * this reads before it writes: two DMs publishing from two browsers cannot silently clobber each
 * other, the second one gets a 409 and is told to publish again.
 */
export async function publishCampaignAuthoring(): Promise<PublishResult> {
  const token = loadPublishToken();
  if (!token) {
    return { ok: false, message: "No GitHub token saved. Add a fine-grained token with Contents: read and write on this one repository." };
  }
  const { owner, repo, branch } = loadPublishConfig();

  let payload: ReturnType<typeof collectCampaignAuthoring>;
  try {
    payload = collectCampaignAuthoring();
  } catch (err) {
    return { ok: false, message: `Could not read the local library: ${(err as Error).message}` };
  }
  const total = payload.monsters.length + payload.equipment.length + payload.encounters.length;
  if (total === 0) {
    return { ok: false, message: "Nothing authored on this machine yet — no campaign creatures, encounters or custom equipment." };
  }

  const body = JSON.stringify(payload, null, 2);
  const base = `/repos/${owner}/${repo}/contents/${PAYLOAD_PATH}`;

  // Read the current sha, if the file is already there. A 404 means this is the first publish.
  let sha: string | undefined;
  try {
    const head = await gh(`${base}?ref=${encodeURIComponent(branch)}`, token);
    if (head.ok) sha = (await head.json() as { sha?: string }).sha;
    else if (head.status === 401 || head.status === 403) {
      return { ok: false, message: `GitHub refused the token (${head.status}). Check it has Contents: read and write on ${owner}/${repo} and has not expired.` };
    }
  } catch (err) {
    return { ok: false, message: `Could not reach GitHub: ${(err as Error).message}` };
  }

  try {
    const res = await gh(base, token, {
      method: "PUT",
      body: JSON.stringify({
        branch,
        message: `authoring: ${payload.monsters.length} creature(s), ${payload.encounters.length} encounter(s), ${payload.equipment.length} item(s) [${payload.digest}]`,
        content: toBase64(body),
        ...(sha ? { sha } : {}),
      }),
    });
    if (res.status === 409) {
      return { ok: false, message: "The payload changed on GitHub since this page loaded — publish again to pick up the newer version." };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as GitHubError;
      return { ok: false, message: `GitHub rejected the write (${res.status}): ${err.message ?? "no reason given"}` };
    }
    return {
      ok: true,
      url: `https://github.com/${owner}/${repo}/actions`,
      message: `Published ${payload.monsters.length} creature(s), ${payload.encounters.length} encounter(s) and ${payload.equipment.length} item(s) to ${branch}. The gates are running — nothing merges until they pass.`,
    };
  } catch (err) {
    return { ok: false, message: `Could not reach GitHub: ${(err as Error).message}` };
  }
}
