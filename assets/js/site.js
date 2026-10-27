// Hastings Daily: audio player, search, share, copy.
(() => {
  const base = document.body.dataset.base || "";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  // ---------------------------------------------------------------- player
  const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 0.8];
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.2" fill="currentColor"/></svg>',
  };
  const players = [];

  function player(el) {
    const audio = el.querySelector("audio");
    if (!audio) return;
    audio.removeAttribute("controls");
    const total = Number(el.dataset.seconds) || 0;
    const key = "pos:" + audio.getAttribute("src");
    let saved = Number(store.get(key)) || 0;
    let pending = saved > 5 ? saved : 0;

    el.insertAdjacentHTML("beforeend", `
      <button class="pl-play" type="button" aria-label="Play">${ICON.play}</button>
      <div class="pl-main">
        <input class="pl-seek" type="range" min="0" max="${total || 1}" step="1" value="${pending}" aria-label="Position">
        <div class="pl-row">
          <span class="pl-time">${fmt(pending)} / ${fmt(total)}</span>
          <span class="pl-note"></span>
          <button type="button" class="pl-back" aria-label="Back 15 seconds">−15</button>
          <button type="button" class="pl-fwd" aria-label="Forward 30 seconds">+30</button>
          <button type="button" class="pl-speed" aria-label="Playback speed">1×</button>
        </div>
      </div>`);
    const play = el.querySelector(".pl-play");
    const seek = el.querySelector(".pl-seek");
    const time = el.querySelector(".pl-time");
    const note = el.querySelector(".pl-note");
    const speedBtn = el.querySelector(".pl-speed");
    if (pending) note.textContent = "· resumes where you left off";

    const duration = () => (isFinite(audio.duration) && audio.duration) || total;
    const setSpeed = (v) => {
      audio.playbackRate = v;
      speedBtn.textContent = `${v}×`;
    };
    setSpeed(Number(store.get("speed")) || 1);

    const render = () => {
      const t = audio.currentTime || pending;
      seek.max = Math.max(1, Math.round(duration()));
      if (!seek.matches(":active")) seek.value = Math.round(t);
      time.textContent = `${fmt(t)} / ${fmt(duration())}`;
    };
    const jump = (t) => {
      t = Math.min(Math.max(0, t), duration());
      if (audio.readyState >= 1) audio.currentTime = t; else pending = t;
      render();
    };

    audio.addEventListener("loadedmetadata", () => {
      if (pending) { audio.currentTime = pending; pending = 0; }
      setSpeed(Number(store.get("speed")) || 1);
      render();
    });
    let lastSave = 0;
    audio.addEventListener("timeupdate", () => {
      render();
      const now = Date.now();
      if (now - lastSave > 4000 && audio.currentTime > 5) {
        store.set(key, Math.floor(audio.currentTime));
        lastSave = now;
      }
    });
    audio.addEventListener("play", () => {
      players.forEach((a) => { if (a !== audio) a.pause(); });
      play.innerHTML = ICON.pause;
      play.setAttribute("aria-label", "Pause");
      note.textContent = "";
      mediaSession(el, audio, jump);
    });
    audio.addEventListener("pause", () => {
      play.innerHTML = ICON.play;
      play.setAttribute("aria-label", "Play");
      if (audio.currentTime > 5) store.set(key, Math.floor(audio.currentTime));
    });
    audio.addEventListener("ended", () => {
      store.del(key);
      audio.currentTime = 0;
      render();
    });

    play.addEventListener("click", () => (audio.paused ? audio.play() : audio.pause()));
    seek.addEventListener("input", () => jump(Number(seek.value)));
    el.querySelector(".pl-back").addEventListener("click", () => jump((audio.currentTime || pending) - 15));
    el.querySelector(".pl-fwd").addEventListener("click", () => jump((audio.currentTime || pending) + 30));
    speedBtn.addEventListener("click", () => {
      const next = SPEEDS[(SPEEDS.indexOf(audio.playbackRate) + 1) % SPEEDS.length] || 1;
      setSpeed(next);
      store.set("speed", next);
    });
    players.push(audio);
  }

  function mediaSession(el, audio, jump) {
    if (!("mediaSession" in navigator)) return;
    const art = el.dataset.artwork;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: el.dataset.title || document.title,
      artist: el.dataset.artist || "",
      artwork: art ? [{ src: new URL(art, location.href).href }] : [],
    });
    const handlers = {
      play: () => audio.play(),
      pause: () => audio.pause(),
      seekbackward: () => jump(audio.currentTime - 15),
      seekforward: () => jump(audio.currentTime + 30),
    };
    for (const [action, fn] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* unsupported */ }
    }
  }

  document.querySelectorAll("[data-player]").forEach(player);

  // ---------------------------------------------------------------- index
  let indexPromise;
  const index = () => (indexPromise ||= fetch(`${base}/search.json`).then((r) => r.json()));

  // ---------------------------------------------------------------- links
  // Links to other sites (sources, venues, credits) open in a new tab.
  document.querySelectorAll("a[href]").forEach((a) => {
    try {
      const u = new URL(a.getAttribute("href"), location.href);
      if (/^https?:$/.test(u.protocol) && u.host !== location.host) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
    } catch { /* not a URL */ }
  });

  // ---------------------------------------------------------------- theme
  // Cycles Auto (follows the device) -> Light -> Dark; remembered per browser.
  const toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    const order = ["system", "light", "dark"];
    const names = { system: "Auto", light: "Light", dark: "Dark" };
    const current = () => document.documentElement.dataset.theme || "system";
    const paint = () => {
      const t = current();
      toggle.querySelector(".theme-label").textContent = names[t];
      toggle.setAttribute("aria-label", `Theme: ${names[t]}. Change theme`);
    };
    paint();
    toggle.addEventListener("click", () => {
      const next = order[(order.indexOf(current()) + 1) % order.length];
      if (next === "system") delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch { /* private mode */ }
      paint();
    });
  }

  // ---------------------------------------------------------------- share / copy
  const share = document.querySelector("[data-share]");
  if (share && navigator.share) {
    share.hidden = false;
    share.addEventListener("click", () => {
      navigator.share({ title: document.title, url: location.href }).catch(() => {});
    });
  }
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const label = btn.textContent;
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = "Copied ✓";
      } catch {
        btn.textContent = "Press and hold the address to copy";
      }
      setTimeout(() => { btn.textContent = label; }, 2500);
    });
  });

  // ---------------------------------------------------------------- search
  const form = document.querySelector("[data-search]");
  if (form) {
    const input = form.querySelector("input");
    const status = document.querySelector("[data-search-status]");
    const results = document.querySelector("[data-search-results]");
    const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const mark = (text, terms) => {
      let out = esc(text);
      for (const t of terms) {
        if (t.length < 2) continue;
        out = out.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
      }
      return out;
    };
    // A short extract around the first match (or the start).
    const snippet = (text, terms) => {
      const t = String(text || "").replace(/\s+/g, " ");
      const f = fold(t);
      const at = Math.max(0, Math.min(...terms.map((w) => { const k = f.indexOf(w); return k < 0 ? Infinity : k; })));
      const start = isFinite(at) ? Math.max(0, at - 60) : 0;
      return (start ? "…" : "") + t.slice(start, start + 200) + (t.length > start + 200 ? "…" : "");
    };
    const run = async () => {
      const q = input.value.trim();
      const url = new URL(location.href);
      if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");
      history.replaceState(null, "", url);
      if (!q) { results.innerHTML = ""; status.textContent = ""; return; }
      const terms = fold(q).split(/\s+/).filter(Boolean);
      const items = await index();
      const scored = [];
      for (const i of items) {
        const title = fold(i.title);
        const meta = fold(`${i.section} ${i.places}`);
        const body = fold(i.text);
        let score = 0;
        const all = terms.every((t) => {
          const s = (title.includes(t) ? 5 : 0) + (meta.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0);
          score += s;
          return s > 0;
        });
        if (all) scored.push([score, i]);
      }
      scored.sort((a, b) => b[0] - a[0] || (a[1].date < b[1].date ? 1 : -1));
      status.textContent = scored.length ? `${scored.length} stor${scored.length === 1 ? "y" : "ies"}` : "Nothing found. Try another word.";
      results.innerHTML = scored.slice(0, 50).map(([, i]) => `
        <li style="--topic: ${esc(i.colour)}">
          <a href="${esc(i.url)}">
            <span class="row-title">${mark(i.title, terms)}</span>
            <span class="row-idea"><span class="dot"></span>${esc(i.section)} · ${esc(i.places)} · ${esc(i.date)}</span>
            <span class="row-why">${mark(snippet(i.text, terms), terms)}</span>
          </a>
        </li>`).join("");
    };
    let timer;
    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 120); });
    form.addEventListener("submit", (e) => { e.preventDefault(); run(); });
    const q = new URLSearchParams(location.search).get("q");
    if (q) { input.value = q; run(); }
  }
})();
