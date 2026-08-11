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

  function loadDates() {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveDates(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function addDate(entry) {
    const list = loadDates();
    entry.id = "d" + Date.now() + Math.random().toString(36).slice(2, 7);
    entry.created = new Date().toISOString();
    list.push(entry);
    saveDates(list);
    return entry;
  }

  function removeDate(id) {
    saveDates(loadDates().filter(function (d) { return d.id !== id; }));
  }

  function findDate(id) {
    var hit = null;
    loadDates().forEach(function (d) { if (d.id === id) hit = d; });
    return hit;
  }

  function updateDate(id, patch) {
    var list = loadDates();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      Object.keys(patch).forEach(function (k) { list[i][k] = patch[k]; });
      list[i].edited = new Date().toISOString();
      saveDates(list);
      return list[i];
    }
    return null;
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
    saveDates: saveDates,
    addDate: addDate,
    removeDate: removeDate,
    findDate: findDate,
    updateDate: updateDate,
    todayISO: todayISO,
    prettyDate: prettyDate,
    prettyTime: prettyTime
  };
})();
