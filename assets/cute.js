/* Shared helpers: cute background + tiny localStorage "database". */

(function () {
  "use strict";

  /* ---------- floating background ---------- */

  const EMOJI = ["💕", "🌸", "💖", "🧁", "🎀", "🌷", "✨", "🍓", "💐", "🫧"];

  function buildSky(count) {
    const sky = document.querySelector(".sky");
    if (!sky) return;

    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = "floaty";
      el.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
      el.style.left = Math.random() * 100 + "vw";
      el.style.fontSize = 1.1 + Math.random() * 2.2 + "rem";
      el.style.animationDuration = 13 + Math.random() * 16 + "s";
      el.style.animationDelay = -Math.random() * 25 + "s";
      sky.appendChild(el);
    }

    for (let i = 0; i < 4; i++) {
      const c = document.createElement("div");
      c.className = "cloud";
      const w = 140 + Math.random() * 180;
      c.style.width = w + "px";
      c.style.height = w * 0.34 + "px";
      c.style.top = 6 + Math.random() * 55 + "vh";
      c.style.animationDuration = 55 + Math.random() * 60 + "s";
      c.style.animationDelay = -Math.random() * 80 + "s";
      c.style.opacity = 0.5 + Math.random() * 0.3;
      sky.appendChild(c);
    }
  }

  /* ---------- confetti burst ---------- */

  function burst(x, y, n) {
    const sky = document.querySelector(".sky");
    if (!sky) return;

    for (let i = 0; i < (n || 26); i++) {
      const p = document.createElement("span");
      p.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
      p.style.cssText =
        "position:fixed;left:" + x + "px;top:" + y + "px;font-size:" +
        (0.9 + Math.random() * 1.6) + "rem;pointer-events:none;z-index:5;" +
        "transition:transform 1.1s cubic-bezier(.2,.7,.3,1),opacity 1.1s ease";
      document.body.appendChild(p);

      const ang = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 260;
      requestAnimationFrame(function () {
        p.style.transform =
          "translate(" + Math.cos(ang) * dist + "px," +
          (Math.sin(ang) * dist + 120) + "px) rotate(" +
          (Math.random() * 720 - 360) + "deg)";
        p.style.opacity = "0";
      });
      setTimeout(function () { p.remove(); }, 1200);
    }
  }

  /* ---------- storage ---------- */

  const KEY = "cutedate.dates.v1";

  /* Everything on disk, tombstones included. */
  function loadAll() {
    var list;
    try {
      const raw = localStorage.getItem(KEY);
      list = raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
    if (!Array.isArray(list)) return [];

    // dates saved before syncing existed have no clock on them
    list.forEach(function (d) {
      if (!d.updated) d.updated = Date.parse(d.edited || d.created) || 1;
    });
    return list;
  }

  /* The dates worth showing. */
  function loadDates() {
    return loadAll().filter(function (d) { return !d.deleted; });
  }

  function saveDates(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  /* Anyone who cares when the dates change (the calendar, the sync layer). */
  var listeners = [];

  function onChange(fn) { listeners.push(fn); }

  function announce() {
    listeners.forEach(function (fn) {
      try { fn(); } catch (err) { /* one bad listener shouldn't stop the rest */ }
    });
  }

  function addDate(entry) {
    const list = loadAll();
    entry.id = "d" + Date.now() + Math.random().toString(36).slice(2, 7);
    entry.created = new Date().toISOString();
    entry.updated = Date.now();
    list.push(entry);
    saveDates(list);
    announce();
    return entry;
  }

  /* Deleting leaves a tombstone behind: without it, a delete on this device
     would simply be undone by the next sync from the other device. */
  function removeDate(id) {
    var list = loadAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      list[i].deleted = true;
      list[i].updated = Date.now();
      saveDates(list);
      announce();
      return;
    }
  }

  function findDate(id) {
    var hit = null;
    loadDates().forEach(function (d) { if (d.id === id) hit = d; });
    return hit;
  }

  function updateDate(id, patch) {
    var list = loadAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      Object.keys(patch).forEach(function (k) { list[i][k] = patch[k]; });
      list[i].edited = new Date().toISOString();
      list[i].updated = Date.now();
      saveDates(list);
      announce();
      return list[i];
    }
    return null;
  }

  /* ---------- merging with a remote copy ---------- */

  /* Newest edit wins, per date. Returns how many local records changed. */
  function mergeRemote(remote) {
    var list = loadAll();
    var byId = {};
    list.forEach(function (d) { byId[d.id] = d; });

    var changed = 0;

    Object.keys(remote || {}).forEach(function (id) {
      var incoming = remote[id];
      if (!incoming || !incoming.id) return;

      incoming.foods = incoming.foods || [];
      incoming.activities = incoming.activities || [];
      incoming.schedule = incoming.schedule || [];
      incoming.updated = incoming.updated || 1;

      var mine = byId[id];
      if (!mine) {
        list.push(incoming);
        changed++;
      } else if ((mine.updated || 1) < incoming.updated) {
        list[list.indexOf(mine)] = incoming;
        changed++;
      }
    });

    if (changed) {
      saveDates(list);
      announce();
    }
    return changed;
  }

  /* Which local records the remote copy is missing or behind on. */
  function pendingPush(remote) {
    var map = remote || {};
    return loadAll().filter(function (d) {
      var there = map[d.id];
      return !there || (there.updated || 1) < (d.updated || 1);
    });
  }

  /* ---------- date formatting ---------- */

  function todayISO() {
    const n = new Date();
    return [
      n.getFullYear(),
      String(n.getMonth() + 1).padStart(2, "0"),
      String(n.getDate()).padStart(2, "0")
    ].join("-");
  }

  function prettyDate(iso) {
    const parts = String(iso).split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }

  function prettyTime(hhmm) {
    if (!hhmm) return "";
    const parts = hhmm.split(":").map(Number);
    const d = new Date(2000, 0, 1, parts[0], parts[1]);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  window.Cute = {
    buildSky: buildSky,
    burst: burst,
    loadDates: loadDates,
    loadAll: loadAll,
    saveDates: saveDates,
    addDate: addDate,
    removeDate: removeDate,
    findDate: findDate,
    updateDate: updateDate,
    mergeRemote: mergeRemote,
    pendingPush: pendingPush,
    onChange: onChange,
    todayISO: todayISO,
    prettyDate: prettyDate,
    prettyTime: prettyTime
  };
})();
