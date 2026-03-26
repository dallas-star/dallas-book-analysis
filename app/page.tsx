"use client";

import { useEffect, useState, useMemo } from "react";

type Responsiveness = "Yes" | "Sometimes" | "No" | "";

interface Account {
  id: string;
  company: string;
  lastReview: string;
  renewalDate: string;
  csHealth: string;
  redFlag: string;
  city: string;
  pos: string;
  status: string;
  launchDate: string;
  suggestedSpend: number | null;
}

interface AccountData extends Account {
  monthlySpend: string;
  locations: string;
  responsiveness: Responsiveness;
  inContract: boolean;
  highTouch: boolean;
}

type Tier = "Tier 1" | "Tier 2" | "Tier 3" | "—";

function getTier(spend: string): Tier {
  const n = parseFloat(spend);
  if (isNaN(n) || spend === "") return "—";
  if (n >= 500) return "Tier 1";
  if (n >= 350) return "Tier 2";
  return "Tier 3";
}

const TIER_COLORS: Record<Tier, string> = {
  "Tier 1": "bg-emerald-100 text-emerald-700 border border-emerald-300",
  "Tier 2": "bg-blue-100 text-blue-700 border border-blue-300",
  "Tier 3": "bg-orange-100 text-orange-700 border border-orange-300",
  "—": "bg-slate-100 text-slate-400",
};

const HEALTH_COLORS: Record<string, string> = {
  Great: "text-emerald-600 font-medium",
  Good: "text-green-600 font-medium",
  Decent: "text-amber-600 font-medium",
  Activation: "text-blue-600 font-medium",
  "At Risk": "text-red-600 font-medium",
  "": "text-slate-400",
};

const RESP_COLORS: Record<string, string> = {
  Yes: "text-emerald-600",
  Sometimes: "text-amber-600",
  No: "text-red-600",
  "": "text-slate-400",
};

const STORAGE_KEY = "book-analysis-data";
const DELETED_KEY = "book-analysis-deleted";
const CUSTOM_KEY = "book-analysis-custom";
const CONTRACT_KEY = "book-analysis-contract";
const HIGH_TOUCH_KEY = "book-analysis-high-touch";

export default function Home() {
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [scenarioTiers, setScenarioTiers] = useState<Set<Tier>>(new Set(["Tier 3"]));
  const [scenarioResp, setScenarioResp] = useState<Set<Responsiveness>>(new Set(["No"]));
  const [scenarioHighTouch, setScenarioHighTouch] = useState<"Any" | "Yes" | "No">("Any");
  const [filterTier, setFilterTier] = useState<string>("All");
  const [filterResp, setFilterResp] = useState<string>("All");
  const [filterHealth, setFilterHealth] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"company" | "monthlySpend" | "lastReview" | "tier">("monthlySpend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: AccountData[]) => {
        const saved: Record<string, { monthlySpend: string; locations: string; responsiveness: Responsiveness; customName?: string }> =
          JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        const deleted: string[] = JSON.parse(localStorage.getItem(DELETED_KEY) || "[]");
        const custom: AccountData[] = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
        const contractOverrides: Record<string, boolean> = JSON.parse(localStorage.getItem(CONTRACT_KEY) || "{}");
        const highTouchOverrides: Record<string, boolean> = JSON.parse(localStorage.getItem(HIGH_TOUCH_KEY) || "{}");

        const merged: AccountData[] = data
          .filter((a) => !deleted.includes(a.id))
          .map((a) => ({
            ...a,
            company: saved[a.id]?.customName ?? a.company,
            monthlySpend: (saved[a.id]?.monthlySpend !== undefined && saved[a.id].monthlySpend !== "")
              ? saved[a.id].monthlySpend
              : a.monthlySpend !== "" ? a.monthlySpend : (a.suggestedSpend !== null ? String(a.suggestedSpend) : ""),
            locations: saved[a.id]?.locations ?? a.locations ?? "",
            responsiveness: saved[a.id]?.responsiveness ?? a.responsiveness ?? "",
            inContract: a.id in contractOverrides ? contractOverrides[a.id] : a.inContract,
            highTouch: a.id in highTouchOverrides ? highTouchOverrides[a.id] : false,
          }));

        setAccounts([...merged, ...custom]);
        setLoading(false);
      });
  }, []);

  function persistAccounts(updated: AccountData[]) {
    const saved: Record<string, { monthlySpend: string; locations: string; responsiveness: Responsiveness; customName?: string }> = {};
    updated.forEach((a) => {
      saved[a.id] = { monthlySpend: a.monthlySpend, locations: a.locations, responsiveness: a.responsiveness, customName: a.company };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }

  function toggleInContract(id: string) {
    setAccounts((prev) => {
      const updated = prev.map((a) => a.id === id ? { ...a, inContract: !a.inContract } : a);
      const overrides: Record<string, boolean> = JSON.parse(localStorage.getItem(CONTRACT_KEY) || "{}");
      const account = updated.find((a) => a.id === id);
      if (account) overrides[id] = account.inContract;
      localStorage.setItem(CONTRACT_KEY, JSON.stringify(overrides));
      return updated;
    });
  }

  function toggleHighTouch(id: string) {
    setAccounts((prev) => {
      const updated = prev.map((a) => a.id === id ? { ...a, highTouch: !a.highTouch } : a);
      const overrides: Record<string, boolean> = JSON.parse(localStorage.getItem(HIGH_TOUCH_KEY) || "{}");
      const account = updated.find((a) => a.id === id);
      if (account) overrides[id] = account.highTouch;
      localStorage.setItem(HIGH_TOUCH_KEY, JSON.stringify(overrides));
      return updated;
    });
  }

  function updateAccount(id: string, field: "monthlySpend" | "locations" | "responsiveness", value: string) {
    setAccounts((prev) => {
      const updated = prev.map((a) => a.id === id ? { ...a, [field]: value } : a);
      persistAccounts(updated);
      return updated;
    });
  }

  function renameAccount(id: string, name: string) {
    if (!name.trim()) return;
    setAccounts((prev) => {
      const updated = prev.map((a) => a.id === id ? { ...a, company: name.trim() } : a);
      persistAccounts(updated);
      return updated;
    });
    setRenamingId(null);
  }

  function deleteAccount(id: string) {
    setAccounts((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      const deleted: string[] = JSON.parse(localStorage.getItem(DELETED_KEY) || "[]");
      if (!deleted.includes(id)) deleted.push(id);
      localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
      const custom: AccountData[] = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom.filter((a) => a.id !== id)));
      persistAccounts(updated);
      return updated;
    });
  }

  function addAccount(name: string) {
    if (!name.trim()) return;
    const newAccount: AccountData = {
      id: `custom-${Date.now()}`,
      company: name.trim(),
      lastReview: "", renewalDate: "", csHealth: "", redFlag: "",
      city: "", pos: "", status: "", launchDate: "",
      monthlySpend: "", locations: "", responsiveness: "", inContract: false, highTouch: false, suggestedSpend: null,
    };
    setAccounts((prev) => {
      const updated = [...prev, newAccount];
      const custom: AccountData[] = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
      custom.push(newAccount);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
      return updated;
    });
    setNewName("");
    setAddingNew(false);
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    return accounts
      .filter((a) => {
        const tier = getTier(a.monthlySpend);
        if (filterTier !== "All" && tier !== filterTier) return false;
        if (filterResp !== "All" && a.responsiveness !== filterResp) return false;
        if (filterHealth !== "All" && a.csHealth !== filterHealth) return false;
        if (search && !a.company.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        let av: string | number = "";
        let bv: string | number = "";
        if (sortField === "monthlySpend") {
          av = parseFloat(a.monthlySpend) || -1;
          bv = parseFloat(b.monthlySpend) || -1;
        } else if (sortField === "company") {
          av = a.company;
          bv = b.company;
        } else if (sortField === "lastReview") {
          av = a.lastReview;
          bv = b.lastReview;
        } else if (sortField === "tier") {
          const order: Record<Tier, number> = { "Tier 1": 1, "Tier 2": 2, "Tier 3": 3, "—": 4 };
          av = order[getTier(a.monthlySpend)];
          bv = order[getTier(b.monthlySpend)];
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [accounts, filterTier, filterResp, filterHealth, search, sortField, sortDir]);

  const stats = useMemo(() => {
    const all = accounts;
    const t1Accounts = all.filter((a) => getTier(a.monthlySpend) === "Tier 1");
    const t2Accounts = all.filter((a) => getTier(a.monthlySpend) === "Tier 2");
    const t3Accounts = all.filter((a) => getTier(a.monthlySpend) === "Tier 3");
    const t1 = t1Accounts.length;
    const t2 = t2Accounts.length;
    const t3 = t3Accounts.length;
    const unset = all.filter((a) => getTier(a.monthlySpend) === "—").length;
    const unresponsive = all.filter((a) => a.responsiveness === "No").length;
    const sometimes = all.filter((a) => a.responsiveness === "Sometimes").length;
    const responsive = all.filter((a) => a.responsiveness === "Yes").length;
    const filled = all.filter((a) => a.monthlySpend !== "").length;
    const respFilled = all.filter((a) => a.responsiveness !== "").length;

    function tierBreakdown(resp: string) {
      const group = all.filter((a) => a.responsiveness === resp);
      return {
        t1: group.filter((a) => getTier(a.monthlySpend) === "Tier 1").length,
        t2: group.filter((a) => getTier(a.monthlySpend) === "Tier 2").length,
        t3: group.filter((a) => getTier(a.monthlySpend) === "Tier 3").length,
      };
    }

    function htBreakdown(group: typeof all) {
      return { ht: group.filter((a) => a.highTouch).length, notHt: group.filter((a) => !a.highTouch).length };
    }

    return {
      t1, t2, t3, unset, unresponsive, sometimes, responsive, total: all.length, filled, respFilled,
      responsiveTiers: tierBreakdown("Yes"),
      sometimesTiers: tierBreakdown("Sometimes"),
      unresponsiveTiers: tierBreakdown("No"),
      t1HighTouch: htBreakdown(t1Accounts),
      t2HighTouch: htBreakdown(t2Accounts),
      t3HighTouch: htBreakdown(t3Accounts),
    };
  }, [accounts]);

  function SortIcon({ field }: { field: typeof sortField }) {
    if (sortField !== field) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <p className="text-slate-400 text-lg font-jakarta">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="font-fraunces text-3xl font-bold text-slate-900 mb-1">Book Analysis</h1>
          <p className="text-slate-500 text-sm">
            {stats.total} accounts · {stats.filled} spend entered ({stats.total - stats.filled} remaining) · {stats.respFilled} responsiveness entered
          </p>
        </div>
        <button
          onClick={() => { setAddingNew(true); setNewName(""); }}
          className="bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + Add Company
        </button>
        <button
          onClick={() => {
            const headers = ["Company", "Last Review", "In Contract", "High Touch", "Renewal Date", "Monthly Spend", "Locations", "$/Location", "Responsiveness", "Tier"];
            const rows = accounts.map((a) => {
              const tier = getTier(a.monthlySpend);
              const spend = parseFloat(a.monthlySpend);
              const locs = parseFloat(a.locations);
              const perLoc = spend && locs ? (spend / locs).toFixed(2) : "";
              return [
                `"${a.company.replace(/"/g, '""')}"`,
                a.lastReview,
                a.inContract ? "Y" : "N",
                a.highTouch ? "Y" : "N",
                a.renewalDate,
                a.monthlySpend,
                a.locations,
                perLoc,
                a.responsiveness,
                tier,
              ].join(",");
            });
            const csv = [headers.join(","), ...rows].join("\n");
            // Save to disk in the project folder
            fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
            // Also trigger browser download
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `book-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          Export CSV
        </button>
      </div>

      {/* Tier Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard label="Tier 1 — $500+" value={stats.t1} sub={stats.filled > 0 ? `${Math.round((stats.t1 / stats.total) * 100)}% of book` : "—"} color="emerald" highTouchBreakdown={stats.t1HighTouch} />
        <StatCard label="Tier 2 — $350–$499" value={stats.t2} sub={stats.filled > 0 ? `${Math.round((stats.t2 / stats.total) * 100)}% of book` : "—"} color="yellow" highTouchBreakdown={stats.t2HighTouch} />
        <StatCard label="Tier 3 — <$350" value={stats.t3} sub={stats.filled > 0 ? `${Math.round((stats.t3 / stats.total) * 100)}% of book` : "—"} color="red" highTouchBreakdown={stats.t3HighTouch} />
        <StatCard label="No Spend Entered" value={stats.unset} sub={`${stats.total - stats.unset} entered`} color="gray" />
      </div>

      {/* Responsiveness Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Responsive" value={stats.responsive} sub="responsiveness = Yes" color="emerald" tierBreakdown={stats.responsiveTiers} />
        <StatCard label="Sometimes" value={stats.sometimes} sub="responsiveness = Sometimes" color="yellow" tierBreakdown={stats.sometimesTiers} />
        <StatCard label="Unresponsive" value={stats.unresponsive} sub="responsiveness = No" color="red" tierBreakdown={stats.unresponsiveTiers} />
      </div>

      {/* Scenario Explorer */}
      {stats.filled > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8 shadow-sm">
          <p className="font-fraunces text-base font-semibold text-slate-800 mb-4">Scenario Explorer</p>
          <div className="flex flex-wrap gap-8 mb-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Tiers</p>
              <div className="flex gap-2">
                {(["Tier 1", "Tier 2", "Tier 3"] as Tier[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setScenarioTiers((prev) => {
                      const next = new Set(prev);
                      next.has(t) ? next.delete(t) : next.add(t);
                      return next;
                    })}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      scenarioTiers.has(t)
                        ? t === "Tier 1" ? "bg-emerald-100 border-emerald-400 text-emerald-700"
                          : t === "Tier 2" ? "bg-blue-100 border-blue-400 text-blue-700"
                          : "bg-orange-100 border-orange-400 text-orange-700"
                        : "bg-white border-slate-300 text-slate-400 hover:border-slate-400"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Responsiveness</p>
              <div className="flex gap-2">
                {(["Yes", "Sometimes", "No"] as Responsiveness[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setScenarioResp((prev) => {
                      const next = new Set(prev);
                      next.has(r) ? next.delete(r) : next.add(r);
                      return next;
                    })}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      scenarioResp.has(r)
                        ? r === "Yes" ? "bg-emerald-100 border-emerald-400 text-emerald-700"
                          : r === "Sometimes" ? "bg-amber-100 border-amber-400 text-amber-700"
                          : "bg-red-100 border-red-400 text-red-700"
                        : "bg-white border-slate-300 text-slate-400 hover:border-slate-400"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">High Touch</p>
              <div className="flex gap-2">
                {(["Any", "Yes", "No"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setScenarioHighTouch(v)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      scenarioHighTouch === v
                        ? v === "Yes" ? "bg-purple-100 border-purple-400 text-purple-700"
                          : v === "No" ? "bg-slate-200 border-slate-400 text-slate-600"
                          : "bg-blue-100 border-blue-400 text-blue-700"
                        : "bg-white border-slate-300 text-slate-400 hover:border-slate-400"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(() => {
            const noTiers = scenarioTiers.size === 0;
            const noResp = scenarioResp.size === 0;
            const noFilters = noTiers && noResp && scenarioHighTouch === "Any";
            const matched = accounts.filter((a) => {
              if (noFilters) return false;
              const tier = getTier(a.monthlySpend);
              const tierMatch = noTiers || scenarioTiers.has(tier);
              const respMatch = noResp || scenarioResp.has(a.responsiveness as Responsiveness);
              const htMatch = scenarioHighTouch === "Any" || (scenarioHighTouch === "Yes" ? a.highTouch : !a.highTouch);
              return tierMatch && respMatch && htMatch;
            });
            const label = [
              scenarioTiers.size > 0 ? `[${[...scenarioTiers].join(" or ")}]` : null,
              scenarioResp.size > 0 ? `[${[...scenarioResp].join(" or ")}]` : null,
              scenarioHighTouch !== "Any" ? `[High Touch = ${scenarioHighTouch}]` : null,
            ].filter(Boolean).join(" and ");
            return (
              <div className="flex flex-wrap gap-6 text-sm border-t border-slate-100 pt-4">
                <span className="text-slate-500">
                  Matching accounts:{" "}
                  <span className="text-slate-900 font-semibold">{matched.length}</span>
                  {label && <span className="text-slate-400 ml-2">({label})</span>}
                </span>
                <span className="text-slate-500">
                  Remaining if removed:{" "}
                  <span className="text-emerald-600 font-semibold">
                    {accounts.filter((a) => {
                      if (noFilters) return true;
                      const tier = getTier(a.monthlySpend);
                      const tierMatch = noTiers || scenarioTiers.has(tier);
                      const respMatch = noResp || scenarioResp.has(a.responsiveness as Responsiveness);
                      const htMatch = scenarioHighTouch === "Any" || (scenarioHighTouch === "Yes" ? a.highTouch : !a.highTouch);
                      const removed = tierMatch && respMatch && htMatch;
                      return !removed && tier !== "—";
                    }).length}
                  </span>
                  {" "}accounts with spend entered
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 w-48 shadow-sm"
        />
        <FilterSelect label="Tier" value={filterTier} onChange={setFilterTier} options={["All", "Tier 1", "Tier 2", "Tier 3", "—"]} />
        <FilterSelect label="Responsiveness" value={filterResp} onChange={setFilterResp} options={["All", "Yes", "Sometimes", "No", ""]} />
        <FilterSelect label="CS Health" value={filterHealth} onChange={setFilterHealth} options={["All", "Great", "Good", "Decent", "Activation", "At Risk", ""]} />
        <span className="text-slate-400 text-sm self-center">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-500 text-left border-b border-slate-200">
              <th className="px-4 py-3 cursor-pointer hover:text-slate-800 font-semibold text-xs uppercase tracking-wide" onClick={() => toggleSort("company")}>
                Company <SortIcon field="company" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-slate-800 font-semibold text-xs uppercase tracking-wide" onClick={() => toggleSort("lastReview")}>
                Last Review <SortIcon field="lastReview" />
              </th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">In Contract</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">High Touch</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Renewal Date</th>
              <th className="px-4 py-3 cursor-pointer hover:text-slate-800 font-semibold text-xs uppercase tracking-wide" onClick={() => toggleSort("monthlySpend")}>
                Monthly Spend <SortIcon field="monthlySpend" />
              </th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Locations</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Responsiveness</th>
              <th className="px-4 py-3 cursor-pointer hover:text-slate-800 font-semibold text-xs uppercase tracking-wide" onClick={() => toggleSort("tier")}>
                Tier <SortIcon field="tier" />
              </th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">$/Location</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {addingNew && (
              <tr className="border-b border-blue-200 bg-blue-50">
                <td className="px-4 py-2.5" colSpan={9}>
                  <form
                    onSubmit={(e) => { e.preventDefault(); addAccount(newName); }}
                    className="flex items-center gap-2"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Company name..."
                      className="bg-white border border-blue-400 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none w-64"
                    />
                    <button type="submit" className="bg-slate-900 hover:bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      Add
                    </button>
                    <button type="button" onClick={() => setAddingNew(false)} className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1.5">
                      Cancel
                    </button>
                  </form>
                </td>
              </tr>
            )}
            {filtered.map((a, i) => {
              const tier = getTier(a.monthlySpend);
              const isRenaming = renamingId === a.id;
              return (
                <tr
                  key={a.id}
                  className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-blue-50/40 transition-colors group`}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[220px]">
                    {isRenaming ? (
                      <form onSubmit={(e) => { e.preventDefault(); renameAccount(a.id, renameValue); }} className="flex items-center gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => renameAccount(a.id, renameValue || a.company)}
                          onKeyDown={(e) => e.key === "Escape" && setRenamingId(null)}
                          className="bg-white border border-blue-400 rounded px-2 py-0.5 text-sm text-slate-800 focus:outline-none w-48"
                        />
                      </form>
                    ) : (
                      <span
                        className="truncate block cursor-pointer hover:text-blue-600 transition-colors"
                        title={`${a.company} — click to rename`}
                        onClick={() => { setRenamingId(a.id); setRenameValue(a.company); }}
                      >
                        {a.company}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{a.lastReview || "—"}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleInContract(a.id)}
                      className={`px-3 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
                        a.inContract
                          ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                          : "bg-slate-100 border-slate-300 text-slate-400 hover:border-slate-400"
                      }`}
                    >
                      {a.inContract ? "Y" : "N"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleHighTouch(a.id)}
                      className={`px-3 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
                        a.highTouch
                          ? "bg-purple-100 border-purple-300 text-purple-700"
                          : "bg-slate-100 border-slate-300 text-slate-400 hover:border-slate-400"
                      }`}
                    >
                      {a.highTouch ? "Y" : "N"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{a.renewalDate || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">$</span>
                      <input
                        type="number"
                        value={a.monthlySpend}
                        onChange={(e) => updateAccount(a.id, "monthlySpend", e.target.value)}
                        placeholder="0"
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 w-24 text-slate-800 focus:outline-none focus:border-blue-400 text-sm shadow-sm"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      value={a.locations}
                      onChange={(e) => updateAccount(a.id, "locations", e.target.value)}
                      placeholder="0"
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 w-20 text-slate-800 focus:outline-none focus:border-blue-400 text-sm shadow-sm"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={a.responsiveness}
                      onChange={(e) => updateAccount(a.id, "responsiveness", e.target.value as Responsiveness)}
                      className={`bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400 shadow-sm font-medium ${RESP_COLORS[a.responsiveness]}`}
                    >
                      <option value="" className="text-slate-400">—</option>
                      <option value="Yes" className="text-emerald-600">Yes</option>
                      <option value="Sometimes" className="text-amber-600">Sometimes</option>
                      <option value="No" className="text-red-600">No</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_COLORS[tier]}`}>
                      {tier}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 font-medium">
                    {(() => {
                      const spend = parseFloat(a.monthlySpend);
                      const locs = parseFloat(a.locations);
                      if (!spend || !locs || locs === 0) return <span className="text-slate-300">—</span>;
                      return `$${(spend / locs).toFixed(2)}`;
                    })()}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => deleteAccount(a.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all text-sm"
                      title="Delete account"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, tierBreakdown, highTouchBreakdown }: {
  label: string;
  value: number;
  sub: string;
  color: string;
  tierBreakdown?: { t1: number; t2: number; t3: number };
  highTouchBreakdown?: { ht: number; notHt: number };
}) {
  const styles: Record<string, string> = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    blue:    "bg-blue-50 border-blue-200 text-blue-800",
    orange:  "bg-orange-50 border-orange-200 text-orange-800",
    gray:    "bg-slate-100 border-slate-200 text-slate-600",
    yellow:  "bg-amber-50 border-amber-200 text-amber-800",
    red:     "bg-red-50 border-red-200 text-red-800",
  };
  const subStyles: Record<string, string> = {
    emerald: "text-emerald-500",
    blue:    "text-blue-500",
    orange:  "text-orange-500",
    gray:    "text-slate-400",
    yellow:  "text-amber-500",
    red:     "text-red-500",
  };
  const s = styles[color] ?? styles.gray;
  const ss = subStyles[color] ?? subStyles.gray;
  return (
    <div className={`border rounded-xl p-4 shadow-sm ${s}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-3xl font-fraunces font-bold">{value}</p>
      <p className={`text-xs mt-1 ${highTouchBreakdown ? "mb-2" : "mb-3"} ${ss}`}>{sub}</p>
      {highTouchBreakdown && (
        <div className="flex gap-2 mb-3">
          <span className="flex items-center gap-1.5 bg-purple-100 border border-purple-300 text-purple-700 text-xs px-2 py-0.5 rounded-full">
            <span className="font-semibold opacity-60">HT</span>
            <span className="w-px h-3 bg-purple-300"></span>
            <span className="font-bold">{highTouchBreakdown.ht}</span>
          </span>
        </div>
      )}
      {tierBreakdown && (
        <div className="flex gap-2 mt-auto">
          <span className="flex items-center gap-1.5 bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
            <span className="font-semibold opacity-60">T1</span>
            <span className="w-px h-3 bg-emerald-300"></span>
            <span className="font-bold">{tierBreakdown.t1}</span>
          </span>
          <span className="flex items-center gap-1.5 bg-amber-100 border border-amber-300 text-amber-700 text-xs px-2 py-0.5 rounded-full">
            <span className="font-semibold opacity-60">T2</span>
            <span className="w-px h-3 bg-amber-300"></span>
            <span className="font-bold">{tierBreakdown.t2}</span>
          </span>
          <span className="flex items-center gap-1.5 bg-red-100 border border-red-300 text-red-700 text-xs px-2 py-0.5 rounded-full">
            <span className="font-semibold opacity-60">T3</span>
            <span className="w-px h-3 bg-red-300"></span>
            <span className="font-bold">{tierBreakdown.t3}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-sm font-medium">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-slate-400 shadow-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o === "" ? "(blank)" : o}</option>
        ))}
      </select>
    </div>
  );
}
