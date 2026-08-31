/**
 * AUTHOR MODE IS A GITHUB IDENTITY, NOT A PASSWORD.
 *
 * Christopher, 2026-08-28: *"Replace the fixed AUTHOR_CODE_HASH / btoa() author-code comparison
 * with GitHub-backed identity authorization … Revoking and recreating the GitHub credential for
 * the same authorized account should not require changing FDMC source code."* And the reason:
 * *"anything that ship into the app is decodeable if someone is determined enough."*
 *
 * He is right, and the old gate was worse than it looked. `AUTHOR_CODE_HASH` was `btoa(code)` —
 * base64, not a hash — compiled into a bundle that ships to every table. One `atob` recovered the
 * code, and rotating it meant editing source and redeploying.
 *
 * ── WHAT IS COMPILED IN, AND WHY THAT IS FINE ───────────────────────────────────────────────
 *
 * Only IDENTITY: a GitHub numeric user id and the repository that must be reachable. Neither is a
 * secret — both are public — and knowing them grants nothing, because the check is whether the
 * CALLER can prove they are that account. A credential is never in the source, so revoking and
 * reissuing a token changes nothing here: paste the new one and it works.
 *
 * ⚠ THE ID, NOT THE LOGIN. A GitHub login can be changed or, once released, taken by somebody
 * else. The numeric id is permanent and cannot be re-registered, so it is the thing that names the
 * account. The login is carried only to say who signed in.
 *
 * ⚠ AND PUSH ACCESS, NOT MERE VISIBILITY. A public repository answers 200 to anyone with any valid
 * token, so reading it proves nothing. `permissions.push` is what distinguishes the author from a
 * stranger holding their own account's token.
 *
 * ── WHAT THIS STILL IS NOT ──────────────────────────────────────────────────────────────────
 *
 * ⚠ IT AUTHORISES A UI, NOT A REPOSITORY. Author mode decides what is SHOWN. The token itself is
 * what GitHub enforces on a push, and a token that cannot write cannot publish however this
 * resolves. That was always the real boundary; this makes the visible half agree with it instead
 * of guarding it with a decodable string.
 */

import { loadPublishConfig } from "./publishToGitHub";

/**
 * The accounts allowed to author this campaign, by permanent GitHub user id.
 *
 * `fdmcadmin` is 291101236 — public, and looked up rather than assumed. Add an id here to add an
 * author; nothing else in the app needs to change, and no credential is involved.
 */
export const AUTHORIZED_AUTHOR_IDS: readonly number[] = [291101236];

export type AuthorIdentity = { login: string; id: number };

export type AuthorCheck =
  | { ok: true; identity: AuthorIdentity }
  | { ok: false; reason: string };

type GitHubUser = { login?: string; id?: number };
type GitHubRepo = { permissions?: { push?: boolean } };

/**
 * Ask GitHub who this credential belongs to, and whether they may write the campaign repository.
 *
 * ⚠ EVERY FAILURE SAYS WHICH STEP FAILED. "Not accepted" sent Christopher to generate a new key for
 * a gate no key could ever satisfy — the old comparison could not be passed by anything except one
 * compiled string, and it never said so. A refusal that does not name its reason costs more time
 * than the check saves.
 */
export async function verifyAuthorIdentity(token: string): Promise<AuthorCheck> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, reason: "No token entered." };

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${trimmed}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  let user: GitHubUser;
  try {
    const res = await fetch("https://api.github.com/user", { headers });
    if (res.status === 401) return { ok: false, reason: "GitHub rejected the token — expired, revoked, or mistyped." };
    if (!res.ok) return { ok: false, reason: `GitHub answered ${res.status} for the account lookup.` };
    user = (await res.json()) as GitHubUser;
  } catch {
    // ⚠ A NETWORK FAILURE IS NOT A REFUSAL, and must not read like one.
    return { ok: false, reason: "Could not reach GitHub. Check the connection and try again." };
  }

  if (typeof user.id !== "number") return { ok: false, reason: "GitHub returned no account id." };
  if (!AUTHORIZED_AUTHOR_IDS.includes(user.id)) {
    return { ok: false, reason: `Signed in as ${user.login ?? "an account"} (id ${user.id}), which is not an authorised author.` };
  }

  const { owner, repo } = loadPublishConfig();
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (res.status === 404) return { ok: false, reason: `The token cannot see ${owner}/${repo} — it may lack repository scope.` };
    if (!res.ok) return { ok: false, reason: `GitHub answered ${res.status} for ${owner}/${repo}.` };
    const meta = (await res.json()) as GitHubRepo;
    if (meta.permissions?.push !== true) {
      return { ok: false, reason: `That token can read ${owner}/${repo} but not write it. Author mode needs push access.` };
    }
  } catch {
    return { ok: false, reason: "Could not reach GitHub to check repository access." };
  }

  return { ok: true, identity: { login: user.login ?? String(user.id), id: user.id } };
}
