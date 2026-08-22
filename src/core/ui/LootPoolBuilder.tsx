/**
 * LOOT POOL BUILDER — name a pool, then tick the items that belong in it.
 *
 * Christopher: *"i want to be able to create a loot pool and then go in and tag the loot that
 * belongs there so i dont have to hunter for where each gift is located then edit it then add it
 * to the campaign and then svae, because this would be hopw i added the A4 convergence inputs to
 * the pool."*
 *
 * The old route was per-item and four steps deep: find the item wherever it had been filed, open
 * its editor, type the encounter name, save, repeat. Filing eight Gifts meant doing that eight
 * times and typing the same string eight times — which is also eight chances to typo the pool out
 * of existence, since a pool IS its name.
 *
 * ── WHAT A POOL IS ───────────────────────────────────────────────────────────────────────────
 * A pool is not a record. It is every item whose `sourceEncounter` (or one of its
 * `sourceEncounters`) matches a name. That is why this panel writes tags rather than creating
 * anything: the pool appears the moment something is tagged into it and vanishes when the last
 * item leaves, and nothing can be left pointing at a pool that no longer exists.
 *
 * ⚠ TAGGING AND PROMOTING ARE ONE ACTION HERE, deliberately. A Gift authored in My Library shows
 * up under its own act heading and NOT in the campaign loot, which reads as "it did not save".
 * Filing it into a campaign pool without moving the item is the same trap one step later.
 */

import { useMemo, useState } from "react";
import {
  loadEquipmentLibrary,
  saveEquipmentLibrary,
  type EquipmentItem,
} from "./EquipmentBagEditor";

type LootPoolBuilderProps = {
  /** Existing encounters, so a pool can be named by picking rather than typing. */
  encounterNames: string[];
  /** Called after a write so the library re-reads. */
  onChanged: () => void;
  onClose: () => void;
};

const input = { width: "100%", padding: "4px 7px", borderRadius: 3, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 } as const;

/**
 * ⚠ TWO GROUPS ARE NOT POOLS. "Convergence — Completed" is every item with
 * `convergence.role === "output"`, and "2024 Weapon Bases" is every mundane weapon with no act
 * and no encounter. Neither is a `sourceEncounter`, so tagging one does nothing — which is
 * exactly why adding to Convergence Completed appeared impossible.
 *
 * Selecting this pool name writes the ROLE instead of a tag.
 */
export const CONVERGENCE_POOL = "Convergence — Completed";

/** Every pool name an item currently claims — primary plus extras. */
function poolsOf(item: EquipmentItem): string[] {
  return [item.sourceEncounter, ...(item.sourceEncounters ?? [])]
    .map(s => s?.trim())
    .filter((s): s is string => Boolean(s));
}

/**
 * What an item's row should SAY it belongs to.
 *
 * "untagged" was shown for anything with no `sourceEncounter`, which made every convergence
 * output and every base weapon look unfiled when they are filed — just by role rather than by
 * pool. A row that lies about being untagged invites a DM to "fix" it by tagging it, which is
 * how a base weapon ends up in an act.
 */
function groupLabelOf(item: EquipmentItem): string {
  if (item.convergence?.role === "output") return CONVERGENCE_POOL;
  if (item.convergence?.role === "input") return `Convergence input${item.convergence.actLabel ? " · " + item.convergence.actLabel : ""}`;
  const pools = poolsOf(item);
  if (pools.length) return pools[0];
  if (item.type === "weapon" && !item.act?.trim()) return "2024 weapon base";
  return "untagged";
}

export function LootPoolBuilder({ encounterNames, onChanged, onClose }: LootPoolBuilderProps) {
  const campaign = useMemo(() => loadEquipmentLibrary("campaign"), []);
  const dm = useMemo(() => loadEquipmentLibrary("dm"), []);
  /**
   * Both stores, RESOLVED TO ONE ROW PER ID.
   *
   * ⚠ An id can exist in BOTH stores — unlocking a campaign item leaves a DM copy that wins by id.
   * Listing the stores end to end showed those twice ("Bonemarch Plate · campaign" directly above
   * "Bonemarch Plate · my library"), which is not a pool problem: it is the duplicate itself,
   * finally visible. The DM copy is what the app actually resolves, so that is the row shown, and
   * `repairEquipmentLibraries` drops the un-edited ones outright.
   */
  const all = useMemo(() => {
    const byId = new Map<string, { item: EquipmentItem; owner: "campaign" | "dm" }>();
    for (const i of campaign) byId.set(i.id, { item: i, owner: "campaign" });
    for (const i of dm) byId.set(i.id, { item: i, owner: "dm" });   // DM wins by id, as elsewhere
    return [...byId.values()];
  }, [campaign, dm]);

  const [pool, setPool] = useState("");
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  /** Move ticked items into the campaign store as well as tagging them. */
  const [promote, setPromote] = useState(true);
  /** Add as an EXTRA pool rather than replacing the primary — a choice item lives in several. */
  const [asExtra, setAsExtra] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const poolName = pool.trim();

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return all
      .filter(({ item }) => !f
        || item.name.toLowerCase().includes(f)
        || (item.type ?? "").toLowerCase().includes(f)
        || poolsOf(item).some(p => p.toLowerCase().includes(f))
        || (item.act ?? "").toLowerCase().includes(f))
      .sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [all, filter]);

  /** Items already in this pool — ticked on open so the panel shows the pool as it stands. */
  const inPool = useMemo(
    () => new Set(all.filter(({ item }) => poolName && (poolName === CONVERGENCE_POOL
      ? item.convergence?.role === "output"
      : poolsOf(item).includes(poolName))).map(({ item }) => item.id)),
    [all, poolName],
  );

  function toggle(id: string) {
    setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function apply() {
    if (!poolName || picked.size === 0) return;
    const campaignNext = [...campaign];
    const dmNext = [...dm];
    let tagged = 0, moved = 0;

    for (const { item, owner } of all) {
      if (!picked.has(item.id)) continue;

      /**
       * The convergence group is membership by ROLE. Writing `sourceEncounter` here would file the
       * item under a literal pool called "Convergence — Completed" that the library never reads,
       * and the item would still not appear in the group the DM was aiming at.
       */
      const next: EquipmentItem = poolName === CONVERGENCE_POOL
        ? { ...item, convergence: { ...(item.convergence ?? {}), role: "output", enabled: true } }
        : asExtra
        ? {
          ...item,
          // An extra membership never disturbs the primary — that is what makes it a CHOICE item.
          sourceEncounters: [...new Set([...(item.sourceEncounters ?? []), poolName])]
            .filter(p => p !== item.sourceEncounter),
        }
        : { ...item, sourceEncounter: poolName };
      tagged++;

      const target: "campaign" | "dm" = promote ? "campaign" : owner;
      if (target !== owner) moved++;

      // Remove from wherever it was, then place it where it belongs. Leaving a twin behind lets
      // the DM copy win by id and makes every later campaign edit look like it did nothing.
      const ci = campaignNext.findIndex(i => i.id === item.id);
      if (ci !== -1) campaignNext.splice(ci, 1);
      const di = dmNext.findIndex(i => i.id === item.id);
      if (di !== -1) dmNext.splice(di, 1);
      (target === "campaign" ? campaignNext : dmNext).push(next);
    }

    saveEquipmentLibrary(campaignNext, "campaign");
    saveEquipmentLibrary(dmNext, "dm");
    setResult(`${tagged} item${tagged === 1 ? "" : "s"} tagged into “${poolName}”${moved ? `, ${moved} moved into the campaign library` : ""}.`);
    setPicked(new Set());
    onChanged();
  }

  return (
    <div style={{ padding: "10px 12px", background: "#12101f", border: "1px solid #4b3f8f", borderRadius: 6, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ fontSize: 13, color: "#9d8cff" }}>Loot pool — tag items in bulk</strong>
        <button type="button" onClick={onClose}
          style={{ fontSize: 11, padding: "2px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>close</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <label style={{ fontSize: 11, color: "#888" }}>
          Pool name <span style={{ color: "#666" }}>— a pool IS its name</span>
          <input list="fdmc-pool-names" value={pool} onChange={e => { setPool(e.target.value); setPicked(new Set()); }}
            placeholder="Act 3 - Gate II: The Mirrors" style={input} />
          {/* Picking beats typing: a pool is matched by string, so a typo silently makes a new one. */}
          <datalist id="fdmc-pool-names">
            {[...new Set([CONVERGENCE_POOL, ...encounterNames, ...all.flatMap(({ item }) => poolsOf(item))])].sort().map(n => <option key={n} value={n} />)}
          </datalist>
        </label>
        <label style={{ fontSize: 11, color: "#888" }}>
          Filter items
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="gift, convergence, Act 3…" style={input} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
        <label style={{ fontSize: 11, color: "#9d8cff", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
          title="Move ticked items into the campaign library. An item in My Library shows under its own heading and never appears in the campaign loot — which reads as though it did not save.">
          <input type="checkbox" checked={promote} onChange={e => setPromote(e.target.checked)} />
          also move into the campaign library
        </label>
        <label style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
          title="Add this pool ALONGSIDE the item's existing one, instead of replacing it — a choice item offered at two gates belongs to both.">
          <input type="checkbox" checked={asExtra} onChange={e => setAsExtra(e.target.checked)}
            disabled={poolName === CONVERGENCE_POOL} />
          add as an extra pool (choice item)
        </label>
      </div>

      {poolName && (
        <p style={{ fontSize: 10, color: "#666", margin: "0 0 6px" }}>
          {inPool.size} item{inPool.size === 1 ? "" : "s"} already in this pool.
        </p>
      )}

      <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #262638", borderRadius: 4 }}>
        {shown.map(({ item, owner }) => {
          const here = inPool.has(item.id);
          return (
            <label key={item.id}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 7px", borderBottom: "1px solid #1c1c2a", cursor: "pointer", background: picked.has(item.id) ? "#1a1630" : "transparent" }}>
              <input type="checkbox" checked={picked.has(item.id)} onChange={() => toggle(item.id)} />
              <span style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.name}
              </span>
              {here && <span style={{ fontSize: 9, color: "#4caf50" }}>in pool</span>}
              <span style={{ fontSize: 9, color: owner === "campaign" ? "#9d8cff" : "#888", width: 62, textAlign: "right" }}>
                {owner === "campaign" ? "campaign" : "my library"}
              </span>
              <span style={{ fontSize: 9, color: "#555", width: 130, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {groupLabelOf(item)}
              </span>
            </label>
          );
        })}
        {shown.length === 0 && <p style={{ fontSize: 11, color: "#555", padding: 8, margin: 0 }}>No items match.</p>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button type="button" onClick={apply} disabled={!poolName || picked.size === 0}
          style={{
            fontSize: 12, padding: "5px 14px", borderRadius: 4, border: "none", fontWeight: 600,
            background: poolName && picked.size ? "#7b68ee" : "#2a2a3e",
            color: poolName && picked.size ? "#fff" : "#666",
            cursor: poolName && picked.size ? "pointer" : "not-allowed",
          }}>
          Tag {picked.size || ""} into pool
        </button>
        {result && <span style={{ fontSize: 11, color: "#4caf50" }}>{result}</span>}
      </div>
    </div>
  );
}
