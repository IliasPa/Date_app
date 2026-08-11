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
   activities (with room for your own ideas). Everything you pick becomes a slot in a live schedule:
   - **drag the ⠿ handle** to reorder any slot (works with a mouse *and* with a finger; arrow keys
     work too when the handle is focused),
   - **set the time** on any slot — it gets pinned there and everything after it follows on,
   - **set how long** each slot lasts, add your own extra slots, or remove ones you don't want.

   *Quick arrange* re-sorts the whole day as *eat first / play first / mix it up*, and
   *Re-time from the start* unpins everything again.
3. **`calendar.html` — the calendar.** A month grid with every date marked — pink for upcoming,
   lilac for the ones you already had — plus "Coming up" and "Our little history" lists.
   Click any marked day to see the full schedule, notes, and to remove it.

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

Saved dates go into the browser's `localStorage` under `cutedate.dates.v1` — no server,
no accounts, nothing leaves the device. Clearing site data clears the dates.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The question, the fish-like No button, the growing Yes |
| `plan.html` | Date / food / activity picker and live schedule builder |
| `calendar.html` | Month calendar, past & future dates, date details |
| `assets/styles.css` | Shared pastel styling |
| `assets/cute.js` | Floating background, confetti, and the localStorage helpers |

Made with far too many hearts 💘
