# 💗 Our Date App

A tiny, very cute web app that asks one important question — and only accepts one answer.

## The flow

1. **`index.html` — the question.** "Will you go on a date with me?" with a **YES** and a **No**.
   - The **No** button swims away like a fish: it flees the cursor, curves as it darts, wiggles,
     and bounces off the edges of the screen. Every attempt to catch it makes it *faster*
     (up to 4.6× its starting agility). On touch screens it bolts the instant a finger lands on it.
   - Every attempt also makes **YES** grow — logarithmically (`1 + 0.62 · ln(1 + attempts)`),
     so it swells fast at first and then keeps growing forever, capped to stay on screen.
2. **`plan.html` — planning.** Pick the day, the start time, where you meet, the food, and the
   activities (with room for your own ideas). Everything you pick becomes a slot in a live schedule,
   **in the order you tapped it** — first picked, first in the day:
   - **drag the ⠿ handle** to rearrange (works with a mouse *and* with a finger; the arrow keys
     work too when the handle is focused),
   - **set the time** on any slot — it gets pinned there and everything after it follows on,
   - **set how long** each slot lasts, add your own extra slots, or remove ones you don't want.
3. **`calendar.html` — the calendar.** A month grid with every date marked — pink for upcoming,
   lilac for the ones you already had — plus "Coming up" and "Our little history" lists.
   Click any marked day to see the full schedule; the card closes when you click outside it,
   and carries **Edit** (reopens the plan with everything restored) and **Remove**.

## Live

**https://iliaspa.github.io/Date_app/**

## Running it

No build step, no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

It also works as-is on GitHub Pages (Settings → Pages → deploy from `main`, root).

## Where the data lives

Saved dates go into the browser's `localStorage` under `cutedate.dates.v1`. That copy is what
draws the pages, so the app is instant and works with no connection — but on its own it lives
in **one browser on one device**, and clearing site data clears the dates.

Turn on syncing (below) and that same local copy is mirrored to Firebase, so the dates survive
a wiped browser, a new phone, and show up for both of you.

## Making the dates permanent (Firebase)

Fifteen minutes, free, and the app keeps working exactly as it does now while you set it up.

1. **Create the project.** [console.firebase.google.com](https://console.firebase.google.com) →
   *Add project*. Google Analytics is not needed.
2. **Create the database.** *Build → Realtime Database → Create database*. Pick the region
   closest to you and start in **locked mode** — the rules in step 5 open it up for just you two.
3. **Turn on Google sign-in.** *Build → Authentication → Get started → Google → Enable*, then save.
4. **Register the web app and copy the config.** *Project settings → General → Your apps →
   Web (`</>`)*. Copy the `firebaseConfig` values into [assets/firebase-config.js](assets/firebase-config.js) —
   `apiKey`, `authDomain`, `databaseURL`, `projectId` and `appId`. These values are public by
   design; they name the project, they don't grant access.
5. **Set the rules.** *Realtime Database → Rules*, paste the block from
   [Who can see what](#who-can-see-what) below, then *Publish*. Nothing in it needs editing —
   access follows whoever is signed in.
6. **Allow the site to sign in.** *Authentication → Settings → Authorized domains → Add domain* →
   `iliaspa.github.io`. (`localhost` is already allowed, for testing.)
7. **Push, then open the calendar** and press **Sync my dates ☁️** in the top bar. Sign in once per
   device. Everything already saved in that browser is uploaded on the first sync.

## Calendars and sharing

Every Google account that signs in gets **its own private calendar**, stored at `spaces/<uid>`.
Nobody can read anyone else's, so the app can be handed to friends as-is.

Two people share one calendar with an invite code:

1. One of you opens **Share 💞** in the top bar and presses **Create an invite code**.
2. The other opens the app, signs in, opens **Share 💞**, and pastes the code into *Got a code
   from someone?*
3. From then on both of you read and write the same dates. The joiner's own dates are merged into
   the shared calendar as they join — nothing is thrown away.

**Leave this calendar** (shown only when you're on someone else's) puts you back on your own.
Leaving never deletes dates: the shared copies stay with the other person, and your browser keeps
its copies.

### Who can see what

These rules never need editing when a new person starts using the app — they key off the signed-in
account, not a list of addresses:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "invites": {
      "$code": {
        ".read":  "auth != null",
        ".write": "auth != null && ((!data.exists() && (newData.child('space').val() === auth.uid || root.child('spaces').child(newData.child('space').val()).child('members').child(auth.uid).exists())) || (data.exists() && data.child('by').val() === auth.uid))"
      }
    },
    "spaces": {
      "$space": {
        ".read": "auth != null && (auth.uid === $space || data.child('members').child(auth.uid).exists())",
        "dates": {
          ".write": "auth != null && (auth.uid === $space || root.child('spaces').child($space).child('members').child(auth.uid).exists())"
        },
        "members": {
          "$uid": {
            ".write": "auth != null && (auth.uid === $space || (auth.uid === $uid && (!newData.exists() || root.child('invites').child(newData.child('code').val()).child('space').val() === $space)))"
          }
        }
      }
    }
  }
}
```

In words: you may read a calendar if it's yours or you're a member of it; you may write dates to it
on the same terms; you may add *yourself* as a member only by presenting an invite code that really
points at that calendar; and you may create invite codes only for a calendar you're already on.

Optional hardening: turn on **App Check** (with reCAPTCHA v3) in the Firebase console so only your
site can talk to the database, rather than any script holding the public config.

### How the syncing behaves

- The browser copy is always drawn first, so the app never waits on the network and works offline.
  Changes made offline upload the next time it connects.
- Each date carries the time it was last changed; if the same date is edited on both phones, the
  **most recent edit wins**.
- Deleting leaves a tombstone rather than just dropping the record — otherwise the other device
  would helpfully sync it back.
- Not signed in, or no config filled in? The app behaves exactly as it always has, saving locally.
- Signing out leaves this browser's copies alone — they just stop following you around.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The question, the fish-like No button, the growing Yes |
| `plan.html` | Date / food / activity picker and live schedule builder |
| `calendar.html` | Month calendar, past & future dates, date details |
| `assets/styles.css` | Shared pastel styling |
| `assets/cute.js` | Floating background, confetti, and the local date storage |
| `assets/sync.js` | Mirrors the local dates to Firebase (dormant until configured) |
| `assets/firebase-config.js` | Your Firebase project details — the one file you edit to switch syncing on |
| `assets/favicon.*` | The little heart icon (`.ico` for older browsers, `.svg` for the rest) |

Made with far too many hearts 💘
