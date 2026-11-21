// Hastings Daily: the accountability page's charts, filters and sortable table.
// The table, MP figures and named votes are in the page already; this adds the councillor
// charts (drawn from the same rows), filtering, sorting and the shared tooltip.
(() => {
  const root = document.querySelector(".acc");
  if (!root) return;
  const dataEl = document.getElementById("acc-data");
  const base = document.body.dataset.base || "";
  const MIN = 3;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const pct = (p, e) => (e >= MIN ? Math.round((100 * p) / e) : null);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

  // ------------------------------------------------------------ tooltip (hover and focus)
  const tip = root.querySelector(".acc-tip");
  function showTip(target, x, y) {
    const text = target.dataset.tip;
    if (!text || !tip) return;
    tip.replaceChildren();
    const [lead, ...rest] = text.split("\n");
    tip.append(el("strong", null, lead));
    rest.forEach((line) => tip.append(el("span", null, line)));
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
    const top = y - r.height - 12 < 8 ? y + 18 : y - r.height - 12;
    tip.style.left = `${left + window.scrollX}px`;
    tip.style.top = `${top + window.scrollY}px`;
  }
  const hideTip = () => { if (tip) tip.hidden = true; };
  root.addEventListener("pointermove", (e) => {
    const t = e.target.closest("[data-tip]");
    t ? showTip(t, e.clientX, e.clientY) : hideTip();
  });
  root.addEventListener("pointerleave", hideTip);
  root.addEventListener("focusin", (e) => {
    const t = e.target.closest("[data-tip]");
    if (!t) return;
    const r = t.getBoundingClientRect();
    showTip(t, r.left + r.width / 2, r.top);
  });
  root.addEventListener("focusout", hideTip);
  window.addEventListener("scroll", hideTip, { passive: true });

  // static segmented bars: hide share labels that don't fit
  root.querySelectorAll(".seg-tall .seg-label").forEach((l) => {
    l.hidden = l.scrollWidth + 12 > l.parentElement.clientWidth;
  });
  if (!dataEl) return;   // a page with only static charts (weekly records)
  let rows;
  try { rows = JSON.parse(dataEl.textContent); } catch { return; }

  // ------------------------------------------------------------ filters
  const filters = { council: "", area: "" };
  const filterBox = root.querySelector(".acc-filters");
  const charts = root.querySelector("[data-acc-charts]");
  filterBox.hidden = false;
  charts.hidden = false;
  filterBox.querySelectorAll("select").forEach((s) => {
    s.addEventListener("change", () => { filters[s.dataset.filter] = s.value; render(); });
  });
  const visible = () => rows.filter((r) => (!filters.council || r.council === filters.council)
    && (!filters.area || (r.areas || []).includes(filters.area)));

  function group(list, keyFn) {
    const g = new Map();
    for (const r of list) {
      for (const k of [].concat(keyFn(r))) {
        if (!g.has(k)) g.set(k, { name: k, n: 0, expected: 0, present: 0, apologies: 0, absent: 0 });
        const x = g.get(k);
        x.n += 1; x.expected += r.expected; x.present += r.present; x.apologies += r.apologies; x.absent += r.absent;
      }
    }
    return [...g.values()].map((x) => ({ ...x, rate: pct(x.present, x.expected) }));
  }

  // ------------------------------------------------------------ charts
  function tiles(list) {
    const box = root.querySelector("[data-tiles]");
    const t = list.reduce((a, r) => ({ e: a.e + r.expected, p: a.p + r.present, ap: a.ap + r.apologies,
      ab: a.ab + r.absent, d: a.d + r.declarations }), { e: 0, p: 0, ap: 0, ab: 0, d: 0 });
    const rate = pct(t.p, t.e);
    const items = [
      [String(list.length), "councillors"],
      [rate == null ? "–" : `${rate}%`, `attendance (${t.p} of ${t.e} meetings)`],
      [String(t.ap), "apologies sent"],
      [String(t.ab), "absent without apologies"],
      [String(t.d), "meetings with an interest declared"],
    ];
    box.replaceChildren(...items.map(([v, l]) => { const li = el("li"); li.append(el("strong", null, v), l); return li; }));
  }

  function barRow(label, rate, n, tipText, extra) {
    const row = el("div", "acc-bar-row");
    row.tabIndex = 0;
    row.dataset.tip = tipText;
    const lab = el("span", "acc-bar-label", label);
    if (extra) lab.append(" ", el("span", "muted", extra));
    const track = el("span", "acc-bar-track");
    const bar = el("span", "acc-bar");
    bar.style.width = rate == null ? "0" : `${rate}%`;
    track.append(bar, el("span", "acc-bar-val", rate == null ? "–" : `${rate}%`));
    row.append(lab, track);
    return row;
  }

  function partyBars(list) {
    const box = root.querySelector('[data-chart="party"]');
    const gs = group(list, (r) => r.party).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    box.replaceChildren(...gs.map((g) => barRow(g.name, g.rate, g.n,
      `${g.rate == null ? "Too few meetings for a rate" : g.rate + "% attendance"}\n${g.name}: ${plural(g.n, "councillor")}\n${g.present} of ${g.expected} expected meetings attended`,
      `(${g.n})`)));
  }

  function strip(list) {
    const box = root.querySelector('[data-chart="strip"]');
    const shown = list.filter((r) => r.rate != null);
    const parties = group(shown, (r) => r.party).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    const axis = el("div", "acc-strip-axis");
    for (const v of [0, 25, 50, 75, 100]) {
      const t = el("span", null, `${v}%`);
      t.style.left = `${v}%`;
      axis.append(t);
    }
    const out = [];
    for (const p of parties) {
      const row = el("div", "acc-strip-row");
      row.append(el("span", "acc-bar-label", p.name));
      const lane = el("span", "acc-strip-lane");
      const mine = shown.filter((r) => r.party === p.name).sort((a, b) => a.rate - b.rate);
      const seen = new Map();
      for (const r of mine) {
        const k = Math.round(r.rate / 3);
        const stack = seen.get(k) || 0;
        seen.set(k, stack + 1);
        const a = el("a", "acc-dot");
        a.href = base + r.url;
        a.style.left = `${r.rate}%`;
        a.style.setProperty("--stack", stack);
        a.dataset.tip = `${r.rate}% · ${r.name}\n${r.party}, ${r.ward}\n${r.council}\n${r.present} of ${r.expected} meetings attended`;
        a.setAttribute("aria-label", `${r.name}, ${r.party}: ${r.rate}% attendance, ${r.present} of ${r.expected} meetings`);
        lane.append(a);
      }
      lane.style.setProperty("--rows", Math.max(1, ...seen.values()));
      row.append(lane);
      out.push(row);
    }
    const lane = el("div", "acc-strip-row acc-strip-foot");
    lane.append(el("span"), axis);
    box.replaceChildren(...out, lane);
    if (!out.length) box.replaceChildren(el("p", "muted", "No councillors with enough recorded meetings in this selection."));
  }

  function split(list) {
    const box = root.querySelector('[data-chart="split"]');
    const gs = group(list, (r) => r.party).filter((g) => g.expected > 0)
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    box.replaceChildren(...gs.map((g) => {
      const row = el("div", "acc-vote-row");
      row.append(el("span", "acc-bar-label", g.name));
      const seg = el("span", "seg seg-tall");
      seg.setAttribute("role", "img");
      seg.setAttribute("aria-label", `${g.name}: of ${g.expected} expected meetings, ${g.present} attended, ${g.apologies} apologies, ${g.absent} absent`);
      [["present", "attended", "s1"], ["apologies", "apologies sent", "s2"], ["absent", "absent without apologies", "s3"]].forEach(([k, label, cls]) => {
        if (!g[k]) return;
        const share = Math.round((100 * g[k]) / g.expected);
        const part = el("span", `seg-part ${cls}`);
        part.style.flex = String(g[k]);
        part.tabIndex = 0;
        part.dataset.tip = `${g[k]} of ${g.expected} (${share}%)\n${g.name}: ${label}`;
        part.append(el("span", "seg-label", `${share}%`));
        seg.append(part);
      });
      row.append(seg);
      return row;
    }));
    // a share label prints only where it fits; the tooltip and the table carry it otherwise
    requestAnimationFrame(() => box.querySelectorAll(".seg-label").forEach((l) => {
      l.hidden = l.scrollWidth + 12 > l.parentElement.clientWidth;
    }));
  }

  function groupings(list) {
    const box = root.querySelector('[data-chart="groups"]');
    const sets = [
      ["Council", (r) => r.council.replace(/ Council$/, "")],
      ["Constituency", (r) => r.areas && r.areas.length ? r.areas : ["Other"]],
      ["Post", (r) => (r.keypost ? "Holds a leading post (leader, cabinet, chair...)" : "No leading post listed")],
      ["Time as a councillor", (r) => r.service],
    ];
    box.replaceChildren(...sets.map(([title, fn]) => {
      const fig = el("div", "acc-group");
      fig.append(el("h4", null, title));
      const bars = el("div", "acc-bars");
      group(list, fn).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).forEach((g) => bars.append(
        barRow(g.name, g.rate, g.n, `${g.rate == null ? "Too few meetings" : g.rate + "% attendance"}\n${g.name}: ${plural(g.n, "councillor")}\n${g.present} of ${g.expected} meetings attended`, `(${g.n})`)));
      fig.append(bars);
      return fig;
    }));
  }

  // ------------------------------------------------------------ table: filter and sort
  const table = root.querySelector("[data-table]");
  const tbody = table.tBodies[0];
  const trs = new Map([...tbody.rows].map((tr) => [tr.dataset.id, tr]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  let sortKey = "", sortDir = 1;
  root.querySelector("[data-sort-hint]").hidden = false;
  table.querySelectorAll("th[data-sort]").forEach((th) => {
    const btn = el("button", "acc-sort", th.textContent);
    btn.type = "button";
    th.replaceChildren(btn);
    btn.addEventListener("click", () => {
      const k = th.dataset.sort;
      sortDir = sortKey === k ? -sortDir : (["name", "party", "council"].includes(k) ? 1 : -1);
      sortKey = k;
      table.querySelectorAll("th").forEach((h) => h.removeAttribute("aria-sort"));
      th.setAttribute("aria-sort", sortDir === 1 ? "ascending" : "descending");
      renderTable();
    });
  });
  function renderTable() {
    const ids = new Set(visible().map((r) => r.id));
    const list = [...trs.keys()].filter((id) => ids.has(id));
    if (sortKey) {
      list.sort((a, b) => {
        const x = byId.get(a)[sortKey], y = byId.get(b)[sortKey];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (typeof x === "string" ? x.localeCompare(y) : x - y) * sortDir;
      });
    }
    trs.forEach((tr, id) => { tr.hidden = !ids.has(id); });
    list.forEach((id) => tbody.append(trs.get(id)));
  }

  function render() {
    const list = visible();
    tiles(list); partyBars(list); strip(list); split(list); groupings(list); renderTable();
  }
  render();

})();
