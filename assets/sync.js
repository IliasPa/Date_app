/* ------------------------------------------------------------------
   Keeps the dates in this browser and the dates in Firebase in step.

   The browser copy stays the source of truth for drawing the page, so
   the app is instant and works offline. Firebase is the copy that
   outlives the browser: sign in on any device and the dates come back.

   Every account gets its own calendar at spaces/<uid>. Two people share
   one calendar when one of them joins the other's space with an invite
   code — the database rules decide access from who you are signed in
   as, so nobody has to edit them when a new person shows up.

   Nothing here runs until assets/firebase-config.js is filled in.
   ------------------------------------------------------------------ */

(function () {
  "use strict";

  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var cfg = window.FIREBASE_CONFIG || {};

  var fb = null;            // the Firebase bits, once loaded
  var user = null;
  var space = null;         // whose calendar we are reading and writing
  var stopDates = null;     // unsubscribe handles for the current space
  var stopWho = null;
  var remoteCopy = {};      // last snapshot of the space's dates
  var members = [];

  var badge = null;
  var shareBtn = null;
  var sheet = null;

  var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no O/0, no I/1

  /* ================= little buttons in the top bar ================= */

  function mount() {
    var host = document.querySelector(".navlinks");
    if (!host || badge) return;

    badge = document.createElement("button");
    badge.type = "button";
    badge.className = "btn ghost mini";
    badge.id = "syncBtn";
    badge.addEventListener("click", onBadgeClick);

    shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "btn ghost mini";
    shareBtn.id = "shareBtn";
    shareBtn.textContent = "Share 💞";
    shareBtn.hidden = true;
    shareBtn.addEventListener("click", openSheet);

    host.insertBefore(shareBtn, host.firstChild);
    host.insertBefore(badge, host.firstChild);
  }

  function show(text, title, busy) {
    if (!badge) return;
    badge.textContent = text;
    badge.title = title || "";
    badge.style.opacity = busy ? ".65" : "1";
  }

  /* ================= talking to the database ================= */

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

  function datesPath() { return "spaces/" + space + "/dates"; }

  function push() {
    if (!user || !fb || !space) return;

    Cute.pendingPush(remoteCopy).forEach(function (rec) {
      fb.set(fb.ref(fb.db, datesPath() + "/" + rec.id), clean(rec)).catch(function (err) {
        show("Sync blocked ⚠️", (err && err.message) || "The database refused that write.");
      });
    });
  }

  function listen() {
    if (stopDates) stopDates();
    if (stopWho) stopWho();
    remoteCopy = {};

    stopDates = fb.onValue(fb.ref(fb.db, datesPath()), function (snap) {
      remoteCopy = snap.val() || {};
      Cute.mergeRemote(remoteCopy);
      push();                                   // carry local-only dates up
      show(shared() ? "Synced 💞" : "Synced ✓",
        shared()
          ? "Sharing this calendar, signed in as " + (user.email || "")
          : "Saved to the cloud as " + (user.email || ""));
    }, function (err) {
      /* Refused on someone else's calendar means we were removed from it —
         quietly go home rather than sitting there stuck. */
      if (space !== user.uid) {
        space = user.uid;
        fb.set(fb.ref(fb.db, "users/" + user.uid + "/space"), user.uid).catch(function () {});
        members = [];
        paintSheet();
        listen();
        return;
      }
      show("Sync blocked ⚠️", (err && err.message) || "The database rules refused this account.");
    });

    stopWho = fb.onValue(fb.ref(fb.db, "spaces/" + space + "/members"), function (snap) {
      var val = snap.val() || {};
      members = Object.keys(val).map(function (uid) {
        return { uid: uid, email: (val[uid] && val[uid].email) || "someone" };
      });
      paintSheet();
    }, function () { /* not fatal: the calendar still syncs */ });
  }

  function shared() {
    return space !== (user && user.uid) || members.length > 0;
  }

  /* Which calendar am I on? My own unless I joined someone else's. */
  async function resolveSpace() {
    var mine = user.uid;
    try {
      var snap = await fb.get(fb.ref(fb.db, "users/" + mine + "/space"));
      space = (snap.exists() && snap.val()) || mine;
      if (!snap.exists()) {
        await fb.set(fb.ref(fb.db, "users/" + mine + "/space"), mine);
      }
    } catch (err) {
      space = mine;         // rules not published yet: still works on my own
    }
  }

  /* ================= sharing ================= */

  /* Codes are the only key to a shared calendar, so they come from the
     cryptographic generator rather than Math.random. 32 letters divides 256
     evenly, so no character is more likely than another. */
  function makeCode() {
    var out = "";
    var bytes = new Uint8Array(6);

    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (var j = 0; j < 6; j++) bytes[j] = Math.floor(Math.random() * 256);
    }

    for (var i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    return out;
  }

  function tidyCode(raw) {
    return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  async function createInvite() {
    var code = makeCode();
    await fb.set(fb.ref(fb.db, "invites/" + code), {
      space: space,
      by: user.uid,
      created: Date.now()
    });
    return code;
  }

  async function joinWithCode(raw) {
    var code = tidyCode(raw);
    if (code.length !== 6) throw new Error("That code should be 6 characters.");

    var snap = await fb.get(fb.ref(fb.db, "invites/" + code));
    if (!snap.exists()) throw new Error("No calendar found for that code. Check it and try again.");

    var target = snap.val().space;
    if (target === space) throw new Error("You are already on that calendar 💗");

    await fb.set(fb.ref(fb.db, "spaces/" + target + "/members/" + user.uid), {
      code: code,
      email: user.email || "",
      joined: Date.now()
    });
    await fb.set(fb.ref(fb.db, "users/" + user.uid + "/space"), target);

    space = target;
    listen();               // pushes this browser's dates into the shared calendar
  }

  async function leaveShared() {
    if (space === user.uid) return;
    await fb.remove(fb.ref(fb.db, "spaces/" + space + "/members/" + user.uid));
    await fb.set(fb.ref(fb.db, "users/" + user.uid + "/space"), user.uid);
    space = user.uid;
    members = [];
    listen();
  }

  /* ================= the share sheet ================= */

  function buildSheet() {
    sheet = document.createElement("dialog");
    sheet.className = "sheet";
    sheet.innerHTML =
      '<div class="inner">' +
        '<h2>Share this calendar 💞</h2>' +
        '<p class="sub" id="shareLead"></p>' +
        '<div id="shareInvite">' +
          '<button class="btn mini" type="button" id="makeCode">Create an invite code ✨</button>' +
          '<code class="code" id="codeOut" hidden></code>' +
          '<small class="note" id="codeNote" hidden></small>' +
        '</div>' +
        '<hr class="dashed">' +
        '<label class="field" for="joinCode">Got a code from someone?</label>' +
        '<div class="addrow">' +
          '<input type="text" id="joinCode" placeholder="ABC123" maxlength="7" autocomplete="off">' +
          '<button class="btn mini" type="button" id="joinBtn">Join 💌</button>' +
        '</div>' +
        '<small class="note" id="joinNote"></small>' +
        '<ul class="who" id="whoList"></ul>' +
        '<div class="dlgfoot" style="margin-top:16px">' +
          '<button class="btn ghost mini" type="button" id="leaveBtn" hidden>Leave this calendar</button>' +
          '<button class="btn mini" type="button" id="closeSheet" style="margin-left:auto">Done 💗</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(sheet);

    sheet.addEventListener("click", function (e) {
      if (e.target === sheet) sheet.close();
    });
    sheet.querySelector("#closeSheet").addEventListener("click", function () { sheet.close(); });

    sheet.querySelector("#makeCode").addEventListener("click", async function () {
      var btn = sheet.querySelector("#makeCode");
      btn.disabled = true;
      try {
        var code = await createInvite();
        var out = sheet.querySelector("#codeOut");
        out.textContent = code;
        out.hidden = false;
        var note = sheet.querySelector("#codeNote");
        note.textContent = "Send this to your person. They open the app, sign in, and paste it below. It keeps working until you delete it in Firebase.";
        note.hidden = false;
      } catch (err) {
        say("#codeNote", (err && err.message) || "Could not create a code.");
      }
      btn.disabled = false;
    });

    sheet.querySelector("#joinBtn").addEventListener("click", async function () {
      var field = sheet.querySelector("#joinCode");
      say("#joinNote", "Joining…");
      try {
        await joinWithCode(field.value);
        field.value = "";
        say("#joinNote", "You're on the shared calendar now — your dates are being merged in 💞");
        paintSheet();
      } catch (err) {
        say("#joinNote", (err && err.message) || "That didn't work.");
      }
    });

    sheet.querySelector("#joinCode").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); sheet.querySelector("#joinBtn").click(); }
    });

    sheet.querySelector("#leaveBtn").addEventListener("click", async function () {
      if (!confirm("Go back to your own private calendar?\n\nThe shared dates stay with the other person, and the copies in this browser stay with you.")) return;
      try {
        await leaveShared();
        paintSheet();
      } catch (err) {
        say("#joinNote", (err && err.message) || "Could not leave.");
      }
    });
  }

  function say(sel, text) {
    var el = sheet && sheet.querySelector(sel);
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
  }

  function paintSheet() {
    if (!sheet || !user) return;

    var owner = space === user.uid;
    sheet.querySelector("#shareLead").textContent = owner
      ? "This is your own calendar. Invite someone and you'll both see the same dates."
      : "You're on someone else's shared calendar. Everything you add here shows up for both of you.";

    var list = sheet.querySelector("#whoList");
    list.innerHTML = "";

    var people = [{ uid: space, email: owner ? (user.email || "you") : "the owner" }].concat(members);
    people.forEach(function (p) {
      var li = document.createElement("li");
      li.textContent = "💗 " + p.email;

      if (p.uid === user.uid) {
        var tag = document.createElement("span");
        tag.className = "you";
        tag.textContent = "you";
        li.appendChild(tag);
      } else if (owner) {
        // only the calendar's owner can show someone the door
        var kick = document.createElement("button");
        kick.type = "button";
        kick.className = "del";
        kick.style.marginLeft = "auto";
        kick.textContent = "✕";
        kick.title = "Remove " + p.email + " from this calendar";
        kick.setAttribute("aria-label", "Remove " + p.email);
        kick.addEventListener("click", function () {
          if (!confirm("Remove " + p.email + " from this calendar?\n\nThey stop seeing new dates straight away. Copies already on their device stay there.")) return;
          fb.remove(fb.ref(fb.db, "spaces/" + space + "/members/" + p.uid)).catch(function (err) {
            say("#joinNote", (err && err.message) || "Could not remove them.");
          });
        });
        li.appendChild(kick);
      }

      list.appendChild(li);
    });

    sheet.querySelector("#leaveBtn").hidden = owner;
    sheet.querySelector("#shareInvite").hidden = false;
  }

  function openSheet() {
    if (!sheet) buildSheet();
    paintSheet();
    sheet.showModal();
  }

  /* ================= sign in / out ================= */

  /* Always show the account chooser. Without this Google quietly reuses the
     last account, so "sign out and switch" would land you back where you were. */
  function googleProvider() {
    var p = new fb.GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    return p;
  }

  function signIn() {
    show("Signing in…", "", true);
    fb.signInWithPopup(fb.auth, googleProvider()).catch(function (err) {
      if (err && /popup/i.test(err.code || "")) {
        fb.signInWithRedirect(fb.auth, googleProvider());
        return;
      }
      show("Sign in failed ⚠️", (err && err.message) || "");
    });
  }

  function onBadgeClick() {
    if (!user) { signIn(); return; }
    if (confirm("Sign out of " + (user.email || "this account") + "?\n\nYour dates stay in the cloud. Sign in again with any Google account — the dates on this device are swapped for that account's own.")) {
      fb.signOut(fb.auth);
    }
  }

  /* ================= boot ================= */

  async function afterSignIn(who) {
    user = who;
    show("Syncing…", who.email || "", true);
    if (shareBtn) shareBtn.hidden = false;

    /* A shared computer: the copies sitting in this browser belong to whoever
       used it last. Only carry them up if they are unclaimed (someone who used
       the app before ever signing in) or already ours. Everyone else's dates
       are safe in their own account, so dropping the cache here loses nothing. */
    var held = Cute.owner();
    if (held && held !== who.uid) Cute.forgetLocal();
    Cute.claim(who.uid);

    await resolveSpace();
    listen();
  }

  function afterSignOut() {
    user = null;
    space = null;
    members = [];
    remoteCopy = {};
    if (stopDates) { stopDates(); stopDates = null; }
    if (stopWho) { stopWho(); stopWho = null; }
    if (shareBtn) shareBtn.hidden = true;
    if (sheet && sheet.open) sheet.close();
    show("Sync my dates ☁️", "Sign in with Google to keep these dates safe and share them across devices.");
  }

  async function boot() {
    mount();
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
      get: db.get,
      set: db.set,
      remove: db.remove,
      onValue: db.onValue,
      auth: auth.getAuth(instance),
      GoogleAuthProvider: auth.GoogleAuthProvider,
      signInWithPopup: auth.signInWithPopup,
      signInWithRedirect: auth.signInWithRedirect,
      signOut: auth.signOut
    };

    auth.onAuthStateChanged(fb.auth, function (who) {
      if (who) afterSignIn(who); else afterSignOut();
    });

    Cute.onChange(push);
  }

  /* Exposed so the browser tests can drive the sharing flows against a
     stand-in database, and so you can poke at the state from the console. */
  window.DateSync = {
    state: function () {
      return { uid: user && user.uid, space: space, members: members.slice() };
    },
    invite: function () { return createInvite(); },
    join: function (code) { return joinWithCode(code); },
    leave: function () { return leaveShared(); },
    tidyCode: tidyCode,
    _install: function (fakeFb, fakeUser, viaSignIn) {   // tests only
      fb = fakeFb;
      mount();
      if (viaSignIn) return afterSignIn(fakeUser);       // the full sign-in path
      user = fakeUser;
      if (shareBtn) shareBtn.hidden = false;
      return resolveSpace().then(listen);
    }
  };

  if (cfg && cfg.apiKey && cfg.databaseURL) {
    boot();
  }
})();
