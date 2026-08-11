/* ------------------------------------------------------------------
   Keeps the dates in this browser and the dates in Firebase in step.

   The browser copy stays the source of truth for drawing the page, so
   the app is instant and works offline. Firebase is the copy that
   outlives the browser: sign in on any device and the dates come back.

   Nothing here runs until assets/firebase-config.js has a real apiKey.
   ------------------------------------------------------------------ */

(function () {
  "use strict";

  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var cfg = window.FIREBASE_CONFIG || {};
  var space = window.DATE_SPACE || "us";

  var badge = null;
  var remoteCopy = {};        // last thing we saw in the database
  var user = null;
  var fb = null;              // { db, ref, set, auth, ... } once loaded

  /* ---------------- the little button in the corner ---------------- */

  function mount() {
    var host = document.querySelector(".navlinks");
    if (!host) return null;

    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn ghost mini";
    b.id = "syncBtn";
    host.insertBefore(b, host.firstChild);
    return b;
  }

  function show(text, title, busy) {
    if (!badge) return;
    badge.textContent = text;
    badge.title = title || "";
    badge.style.opacity = busy ? ".65" : "1";
  }

  /* ---------------- syncing ---------------- */

  /* Firebase rejects undefined, and drops empty arrays on the way back. */
  function clean(rec) {
    var out = {};
    Object.keys(rec).forEach(function (k) {
      if (rec[k] !== undefined) out[k] = rec[k];
    });
    out.foods = out.foods || [];
    out.activities = out.activities || [];
    out.schedule = out.schedule || [];
    out.updated = out.updated || Date.now();
    return out;
  }

  function push() {
    if (!user || !fb) return;

    var waiting = Cute.pendingPush(remoteCopy);
    if (!waiting.length) return;

    waiting.forEach(function (rec) {
      var path = "spaces/" + space + "/dates/" + rec.id;
      fb.set(fb.ref(fb.db, path), clean(rec)).catch(function (err) {
        show("Sync problem ⚠️", String(err.message || err));
      });
    });
  }

  function listen() {
    var path = "spaces/" + space + "/dates";

    fb.onValue(fb.ref(fb.db, path), function (snap) {
      remoteCopy = snap.val() || {};
      Cute.mergeRemote(remoteCopy);
      push();
      show("Synced ✓", "Your dates are saved to the cloud as " + (user.email || ""));
    }, function (err) {
      show("Sync blocked ⚠️", (err && err.message) || "The database rules refused this account.");
    });
  }

  /* ---------------- sign in / out ---------------- */

  function signIn() {
    show("Signing in…", "", true);
    fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider()).catch(function (err) {
      // some phone browsers block popups; the redirect flow works there
      if (err && /popup/i.test(err.code || "")) {
        fb.signInWithRedirect(fb.auth, new fb.GoogleAuthProvider());
        return;
      }
      show("Sign in failed ⚠️", (err && err.message) || "");
    });
  }

  function onBadgeClick() {
    if (!user) { signIn(); return; }
    if (confirm("Stop syncing on this device?\n\nYour dates stay saved here, they just won't follow you to other devices until you sign in again.")) {
      fb.signOut(fb.auth);
    }
  }

  /* ---------------- boot ---------------- */

  async function boot() {
    badge = mount();
    show("Connecting…", "", true);

    var app, auth, db;
    try {
      app = await import(SDK + "firebase-app.js");
      auth = await import(SDK + "firebase-auth.js");
      db = await import(SDK + "firebase-database.js");
    } catch (err) {
      show("Offline ☁️", "Couldn't reach Firebase — your dates are still saved in this browser.");
      return;
    }

    var instance = app.initializeApp(cfg);

    fb = {
      db: db.getDatabase(instance),
      ref: db.ref,
      set: db.set,
      onValue: db.onValue,
      auth: auth.getAuth(instance),
      GoogleAuthProvider: auth.GoogleAuthProvider,
      signInWithPopup: auth.signInWithPopup,
      signInWithRedirect: auth.signInWithRedirect,
      signOut: auth.signOut
    };

    if (badge) badge.addEventListener("click", onBadgeClick);

    auth.onAuthStateChanged(fb.auth, function (who) {
      user = who;
      if (who) {
        show("Syncing…", who.email || "", true);
        listen();
      } else {
        remoteCopy = {};
        show("Sync my dates ☁️", "Sign in with Google to keep these dates safe and share them across devices.");
      }
    });

    // anything saved locally goes up as soon as it happens
    Cute.onChange(push);
  }

  // A half-filled config would only produce a broken badge, so wait for both.
  if (cfg && cfg.apiKey && cfg.databaseURL) {
    boot();
  }
})();
