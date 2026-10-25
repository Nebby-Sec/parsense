// ---------- Tabs ----------
const tabBtns = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".tab-panel");
const tabSelect = document.getElementById("tabSelect");

// The mobile dropdown mirrors the tab strip, so labels only live in one place.
tabSelect.innerHTML = [...tabBtns]
  .map(b => `<option value="${b.dataset.tab}">${b.textContent}</option>`)
  .join("");

function activateTab(name) {
  tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  panels.forEach(p => p.classList.toggle("active", p.id === name));
  tabSelect.value = name;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

tabBtns.forEach(btn => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));
tabSelect.addEventListener("change", () => activateTab(tabSelect.value));
tabSelect.value = document.querySelector(".tab-btn.active").dataset.tab;

// ---------- Storage helpers ----------
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

// ================= ROUNDS =================
const roundForm = document.getElementById("roundForm");
const roundTableBody = document.getElementById("roundTableBody");
const statsBox = document.getElementById("statsBox");

function loadRounds() { return store.get("golf_rounds", []); }
function saveRounds(rounds) { store.set("golf_rounds", rounds); }

function renderRounds() {
  const rounds = loadRounds().sort((a, b) => new Date(b.date) - new Date(a.date));
  roundTableBody.innerHTML = "";
  if (rounds.length === 0) {
    roundTableBody.innerHTML = `<tr><td colspan="8" class="muted">No rounds logged yet.</td></tr>`;
  }
  rounds.forEach(r => {
    const toPar = r.score - r.par;
    const toParStr = toPar > 0 ? `+${toPar}` : toPar === 0 ? "E" : `${toPar}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${escapeHtml(r.course)}</td>
      <td>${r.holes}</td>
      <td>${r.score}</td>
      <td>${toParStr}</td>
      <td>${r.putts ?? "-"}</td>
      <td>${r.fairways ?? "-"}</td>
      <td><button class="del-btn" data-id="${r.id}" title="Delete">✕</button></td>
    `;
    roundTableBody.appendChild(tr);
  });
  roundTableBody.querySelectorAll(".del-btn").forEach(b => {
    b.addEventListener("click", () => {
      const rounds = loadRounds().filter(r => r.id !== b.dataset.id);
      saveRounds(rounds);
      renderRounds();
      renderStats();
    });
  });
}

function renderStats() {
  const rounds = loadRounds();
  if (rounds.length === 0) {
    statsBox.innerHTML = `<p class="muted">Log a round to see stats.</p>`;
    return;
  }
  const scores = rounds.map(r => r.score);
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const best = Math.min(...scores);
  const toParAvg = (rounds.reduce((sum, r) => sum + (r.score - r.par), 0) / rounds.length).toFixed(1);
  const puttsLogged = rounds.filter(r => r.putts);
  const avgPutts = puttsLogged.length
    ? (puttsLogged.reduce((s, r) => s + Number(r.putts), 0) / puttsLogged.length).toFixed(1)
    : "-";

  statsBox.innerHTML = `
    <div class="stat"><div class="val">${rounds.length}</div><div class="label">Rounds</div></div>
    <div class="stat"><div class="val">${avg}</div><div class="label">Avg Score</div></div>
    <div class="stat"><div class="val">${best}</div><div class="label">Best Score</div></div>
    <div class="stat"><div class="val">${toParAvg > 0 ? "+" + toParAvg : toParAvg}</div><div class="label">Avg To Par</div></div>
    <div class="stat"><div class="val">${avgPutts}</div><div class="label">Avg Putts</div></div>
  `;
}

roundForm.addEventListener("submit", e => {
  e.preventDefault();
  const rounds = loadRounds();
  rounds.push({
    id: crypto.randomUUID(),
    course: document.getElementById("rCourse").value.trim(),
    date: document.getElementById("rDate").value,
    holes: document.getElementById("rHoles").value,
    par: Number(document.getElementById("rPar").value),
    score: Number(document.getElementById("rScore").value),
    putts: document.getElementById("rPutts").value || null,
    fairways: document.getElementById("rFairways").value || null,
  });
  saveRounds(rounds);
  roundForm.reset();
  document.getElementById("rPar").value = 72;
  document.getElementById("rHoles").value = "18";
  renderRounds();
  renderStats();
});

// Escapes for both text nodes AND quoted attributes. The textContent/innerHTML
// trick alone leaves quotes intact, which lets third-party data (OpenStreetMap
// tags are world-editable) break out of an attribute and inject handlers.
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only http(s) links are safe to render; anything else (javascript:, data:)
// is dropped rather than linked.
function safeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url), location.href);
    return (u.protocol === "http:" || u.protocol === "https:") ? u.href : null;
  } catch {
    return null;
  }
}

renderRounds();
renderStats();

// ================= COACH (rule-based AI assistant) =================
const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

function addMsg(text, who, imageDataUrl) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  if (imageDataUrl) {
    const img = document.createElement("img");
    img.src = imageDataUrl;
    div.appendChild(img);
  }
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function statsSummary() {
  const p = loadProfile();
  const greet = p && p.name ? `${p.name}, ` : "";
  const rounds = loadRounds();
  if (rounds.length === 0) return `${greet}you haven't logged any rounds yet — head to the Rounds tab and log one so I can give you personalized insight.`;
  const scores = rounds.map(r => r.score);
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const best = Math.min(...scores);
  const last = rounds[rounds.length - 1];
  const trend = rounds.length >= 2
    ? (rounds[rounds.length - 1].score < rounds[0].score ? "trending down (nice!)" : "holding steady")
    : "just getting started";
  let msg = `${greet}you've logged ${rounds.length} round(s). Average score: ${avg}, best: ${best}. Your scoring trend looks ${trend}. Last round was ${last.score} at ${last.course}.`;
  if (p && p.typicalScore) {
    const diff = avg - p.typicalScore;
    if (diff <= -2) msg += ` You're averaging below your typical ${p.typicalScore} — the work is paying off.`;
    else if (diff >= 2) msg += ` You're a bit above your typical ${p.typicalScore} lately — worth a range session.`;
    else msg += ` That's right around your typical ${p.typicalScore}.`;
  }
  return msg;
}

// Builds an estimated carry chart from the two distances in the profile,
// using standard ~12-yard gapping between irons.
function buildBag() {
  const p = loadProfile();
  if (!p || !p.sevenIron) return null;
  const s = Number(p.sevenIron);
  const d = Number(p.driver) || s + 80;
  return [
    ["driver", d], ["3-wood", d - 20], ["5-wood/hybrid", d - 35],
    ["4-iron", s + 36], ["5-iron", s + 24], ["6-iron", s + 12],
    ["7-iron", s], ["8-iron", s - 12], ["9-iron", s - 24],
    ["pitching wedge", s - 36], ["gap wedge", s - 48], ["sand wedge", s - 60],
  ];
}

function pickClub(bag, target) {
  let best = bag[0];
  for (const c of bag) {
    if (Math.abs(c[1] - target) < Math.abs(best[1] - target)) best = c;
  }
  return best;
}

function clubAdvice(userText) {
  const generic = "Club selection depends on your personal distances, but as a rough guide for 150 yards many mid-handicap golfers reach for a 7-iron or 8-iron. Fill in your driver and 7-iron distances in the Profile tab and I'll answer with your own clubs.";
  const m = (userText || "").match(/(\d{2,3})/);
  const target = m ? Number(m[1]) : null;
  const p = loadProfile();
  if (!target || target < 30 || target > 350) return generic;
  const clubs = buildBag();
  if (!clubs) return generic;
  const s = Number(p.sevenIron);
  const d = Number(p.driver) || s + 80;
  let bestClub = clubs[0];
  for (const c of clubs) {
    if (Math.abs(c[1] - target) < Math.abs(bestClub[1] - target)) bestClub = c;
  }
  return `Based on your profile (7-iron ~${s}y${p.driver ? `, driver ~${d}y` : ""}), for ${target} yards I'd reach for your ${bestClub[0]} (~${bestClub[1]}y carry). These are estimates with standard ~12-yard gaps between irons — track your real carries on the range to dial them in. Wind, elevation, and lie all shift this a club or more.`;
}

const knowledgeBase = [
  {
    keywords: ["slice", "slicing"],
    reply: "A slice usually comes from an open clubface relative to your swing path at impact. Try: 1) strengthen your grip slightly (rotate hands right on the club for a right-hander), 2) check your alignment isn't aimed left, 3) focus on an in-to-out swing path with your downswing starting from the lower body, not the arms."
  },
  {
    keywords: ["hook", "hooking"],
    reply: "A hook is often a closed clubface relative to path. Try weakening your grip slightly, checking you're not overly rotating your forearms through impact, and make sure your stance/alignment isn't aimed too far right."
  },
  {
    keywords: ["putt", "putting"],
    reply: "For more consistent putting: keep your head still through the stroke, use a pendulum motion from the shoulders (not the wrists), pick a small intermediate target a foot in front of the ball on your line, and practice lag putting from 20-30ft to dial in speed control — speed misses leave easier second putts than line misses."
  },
  {
    keywords: ["driver", "distance", "drive"],
    reply: "For more driver distance: tee the ball higher so you're hitting up on it slightly, widen your stance a touch for stability, and focus on rotating your hips hard through impact rather than just swinging your arms faster. Also check your ball isn't too far back in your stance."
  },
  {
    keywords: ["chip", "chipping", "short game"],
    reply: "For better chipping: keep weight favoring your front foot, hands slightly ahead of the ball at address and impact, and use a consistent, low, descending strike. Let the loft of the club do the work rather than trying to scoop the ball up."
  },
  {
    keywords: ["bunker", "sand"],
    reply: "In greenside bunkers: open your stance and clubface slightly, aim to hit the sand about 2 inches behind the ball, and accelerate through to a full finish. The sand — not the ball — should absorb most of the impact."
  },
  {
    keywords: ["yard", "club selection", "what club", "which club"],
    dynamic: clubAdvice
  },
  {
    keywords: ["nervous", "anxious", "pressure", "mental"],
    reply: "For pressure shots: stick to a consistent pre-shot routine every time (same practice swings, same breathing), commit fully to your target before you start the swing, and focus on process (tempo, target) rather than outcome (don't think about the water hazard)."
  },
  {
    keywords: ["stats", "how am i doing", "progress", "handicap"],
    dynamic: statsSummary
  },
];

function botReply(userText) {
  const lower = userText.toLowerCase();
  const hit = knowledgeBase.find(k => k.keywords.some(kw => lower.includes(kw)));
  if (hit) return hit.dynamic ? hit.dynamic(lower) : hit.reply;
  return "I don't have a specific tip for that yet, but a few general fundamentals always help: solid grip, balanced stance, smooth tempo, and a committed pre-shot routine. Try asking me about slicing, putting, chipping, bunkers, driver distance, or say \"how am I doing\" for stats from your logged rounds.";
}

chatForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  addMsg(text, "user");
  chatInput.value = "";
  setTimeout(() => addMsg(botReply(text), "bot"), 350);
});

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    chatInput.value = chip.dataset.q;
    chatForm.requestSubmit();
  });
});

// ---------- Shot Planner ----------
// Adjusts a target yardage for conditions, then picks the club from the profile bag.
const spDistance = document.getElementById("spDistance");
const spWind = document.getElementById("spWind");
const spWindMph = document.getElementById("spWindMph");
const spElevation = document.getElementById("spElevation");
const spPlanBtn = document.getElementById("spPlanBtn");
const spResult = document.getElementById("spResult");

function planShot() {
  const target = Number(spDistance.value);
  if (!target || target < 30 || target > 350) {
    spResult.hidden = false;
    spResult.innerHTML = `<p class="muted">Enter a distance between 30 and 350 yards.</p>`;
    return;
  }
  const bag = buildBag();
  if (!bag) {
    spResult.hidden = false;
    spResult.innerHTML = `<p class="muted">Add your driver and 7-iron distances on the Profile tab and I'll pick the club for you.</p>`;
    return;
  }

  const wx = store.get("golf_last_weather", null);
  const mph = spWindMph.value !== "" ? Number(spWindMph.value) : (wx ? Math.round(wx.wind) : 0);
  const factors = [];
  let plays = target;

  // Rules of thumb: into the wind costs roughly a club per 10 mph; helping wind gives
  // back about half that; crosswind mostly steals a little carry.
  if (spWind.value === "into" && mph > 0) {
    const add = target * 0.008 * mph;
    plays += add;
    factors.push(`+${Math.round(add)} into a ${mph} mph wind`);
  } else if (spWind.value === "helping" && mph > 0) {
    const cut = target * 0.005 * mph;
    plays -= cut;
    factors.push(`−${Math.round(cut)} with a ${mph} mph wind at your back`);
  } else if (spWind.value === "cross" && mph > 0) {
    const add = target * 0.002 * mph;
    plays += add;
    factors.push(`+${Math.round(add)} for a ${mph} mph crosswind — aim into it`);
  }

  if (spElevation.value === "uphill") {
    const add = target * 0.05;
    plays += add;
    factors.push(`+${Math.round(add)} playing uphill`);
  } else if (spElevation.value === "downhill") {
    const cut = target * 0.05;
    plays -= cut;
    factors.push(`−${Math.round(cut)} playing downhill`);
  }

  // Cold air costs carry; hot air adds a touch. Baseline 70°F.
  if (wx && typeof wx.temp === "number") {
    const tempAdj = target * 0.0015 * (70 - wx.temp);
    if (Math.abs(tempAdj) >= 2) {
      plays += tempAdj;
      factors.push(`${tempAdj > 0 ? "+" : "−"}${Math.abs(Math.round(tempAdj))} at ${Math.round(wx.temp)}°F`);
    }
  }

  plays = Math.round(plays);
  const club = pickClub(bag, plays);
  const delta = plays - club[1];
  const note = Math.abs(delta) <= 3
    ? "That's right in its window."
    : delta > 0
      ? `That's ${Math.round(delta)} yds more than its stock carry — swing easy with the next club up if you're between.`
      : `That's ${Math.abs(Math.round(delta))} yds inside its stock carry — choke down slightly.`;

  spResult.hidden = false;
  spResult.innerHTML = `
    <div class="plan-headline">
      <div><div class="plan-num">${plays}</div><div class="plan-lbl">Plays like (yds)</div></div>
      <div><div class="plan-num">${escapeHtml(club[0])}</div><div class="plan-lbl">Suggested club</div></div>
    </div>
    ${factors.length ? `<ul class="plan-factors">${factors.map(f => `<li>${escapeHtml(f)}</li>`).join("")}</ul>` : `<p class="muted small">No adjustments — playing its true ${target} yards.</p>`}
    <p class="muted small">${escapeHtml(note)} Estimates based on your profile distances and standard club gapping.</p>
  `;
}

spPlanBtn.addEventListener("click", planShot);
[spDistance, spWindMph].forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") planShot(); })
);
// Pre-fill wind speed from the last weather lookup so the planner opens ready to go.
(() => {
  const wx = store.get("golf_last_weather", null);
  if (wx && typeof wx.wind === "number") spWindMph.placeholder = String(Math.round(wx.wind));
})();

// ================= COURSES (search + booking links) =================
// Par / hole counts verified against course sites and golf-association listings.
// OpenStreetMap carries no par data, so anything not listed here shows no par
// rather than a guessed one.
const courseFacts = {
  // --- Ada / Lima area (NW Ohio) ---
  "Colonial Golfers Club": { par: 72, holes: 18, yards: 7043, site: "https://thecolonialgolfersclub.com/" },
  "Hidden Creek Golf Club": { par: 72, holes: 18, yards: 6810, site: "https://hiddencreekgolfclub.net/golf-course/" },
  "Bluffton Golf Club": { par: 72, holes: 18, yards: 6628, site: "https://blufftongolfclub.net/golf-course/" },
  "Lost Creek Golfers Club": { par: 71, holes: 18, yards: 6060, site: "http://lostcreekgolfersclub.com/" },
  "Cherokee Hills Golf Course": { par: 72, holes: 18, site: "https://cherokeehillsgolfclub.com/" },

  // --- Highland Heights / east Cleveland suburbs (NE Ohio) ---
  "Stonewater Golf Club": { par: 71, holes: 18, yards: 7045, site: "https://www.stonewatergolf.com/" },
  "Manakiki Golf Course": { par: 72, holes: 18, yards: 6625, site: "https://www.clevelandmetroparks.com/golf/courses/manakiki-golf-course" },
  "Lost Nation Golf Course": { par: 72, holes: 18, yards: 6410, site: "https://www.lostnationgolf.com/" },
  "Briardale Greens Golf Course": { par: 70, holes: 18, yards: 6058, site: "https://www.briardalegreens.com/" },
  "Highland Park Golf Course": { par: 71, holes: 18, yards: 6740, site: "https://www.clevelandohio.gov/" },
  "Green Ridge Public Golf Course": { par: 32, holes: 9, yards: 1915, site: "https://www.cityofwickliffe.com/185/Green-Ridge-Golf-Course" },
};

// Curated courses near Ada, OH 45810 (the default when no profile home is set)
const curatedCourses = [
  { name: "Colonial Golfers Club", loc: "10985 Harding Hwy, Harrod, OH 45850", miles: 6, access: "Public", bookingUrl: "https://thecolonialgolfersclub.com/book-your-tee-time/" },
  { name: "Hidden Creek Golf Club", loc: "6245 Sugar Creek Rd, Lima, OH 45801", miles: 10, access: "Public", bookingUrl: "https://hiddencreekgolfclub.com/teetimes/" },
  { name: "Findlay Country Club", loc: "15000 Country Club Dr, Findlay, OH", miles: 21, access: "Private", bookingUrl: "https://www.findlaycc.com/golf" },
  { name: "Cherokee Hills Golf Course", loc: "4622 County Road 49, Bellefontaine, OH 43311", miles: 24, access: "Public", bookingUrl: "https://foreupsoftware.com/index.php/booking/21188" },
];
let currentCourses = curatedCourses;

// Turns an OSM opening_hours string into something readable at a glance.
function formatHours(raw) {
  if (!raw) return null;
  const days = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun" };
  let out = raw.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, d => days[d]).replace(/-/g, "–");
  out = out.replace(/\b(\d{2}):(\d{2})\b/g, (m, h, min) => {
    const hr = Number(h);
    const period = hr >= 12 ? "pm" : "am";
    const h12 = hr % 12 === 0 ? 12 : hr % 12;
    return min === "00" ? `${h12}${period}` : `${h12}:${min}${period}`;
  });
  return out;
}

const courseListEl = document.getElementById("courseList");
const courseSearch = document.getElementById("courseSearch");

function sortCourses(list) {
  const mode = courseSort ? courseSort.value : "distance";
  const yards = c => (courseFacts[c.name] || {}).yards ?? null;
  if (mode === "distance") {
    return list.sort((a, b) => (a.miles ?? 9999) - (b.miles ?? 9999));
  }
  // Length stands in for difficulty — slope ratings aren't published in any free
  // dataset, so courses with no known yardage sort to the bottom either way.
  return list.sort((a, b) => {
    const ya = yards(a), yb = yards(b);
    if (ya == null && yb == null) return (a.miles ?? 9999) - (b.miles ?? 9999);
    if (ya == null) return 1;
    if (yb == null) return -1;
    return mode === "easy" ? ya - yb : yb - ya;
  });
}

function renderCourses(filter = "") {
  const f = filter.toLowerCase();
  const filtered = sortCourses(
    currentCourses.filter(c => c.name.toLowerCase().includes(f) || (c.loc || "").toLowerCase().includes(f))
  );
  courseListEl.innerHTML = "";
  if (filtered.length === 0) {
    courseListEl.innerHTML = `<p class="muted">No courses match your search.</p>`;
    return;
  }
  filtered.forEach(c => {
    const item = document.createElement("div");
    item.className = "course-item";
    const isPrivate = c.access === "Private";
    const badge = c.access ? ` <span class="access-badge ${isPrivate ? "private" : "public"}">${c.access}</span>` : "";
    const facts = courseFacts[c.name] || {};

    // Address under the name; distance kept as a separate quiet line.
    const address = c.loc || null;
    const distance = c.miles != null ? `${c.miles} mi away` : null;

    // Par / holes / hours — only shown when actually known for that course.
    const meta = [];
    if (facts.par) meta.push(`<span class="cmeta-item"><strong>Par ${facts.par}</strong></span>`);
    if (facts.holes) meta.push(`<span class="cmeta-item">${facts.holes} holes</span>`);
    if (facts.yards) meta.push(`<span class="cmeta-item">${facts.yards.toLocaleString()} yds</span>`);
    const hours = formatHours(c.hours);
    meta.push(`<span class="cmeta-item${hours ? "" : " cmeta-unknown"}">🕐 ${hours ? escapeHtml(hours) : "Hours not listed"}</span>`);

    const bookHref = safeUrl(c.bookingUrl);
    const bookLink = bookHref
      ? `<a class="booking-link" href="${escapeHtml(bookHref)}" target="_blank" rel="noopener noreferrer">${isPrivate ? "Club website (members only) ↗" : "Book a tee time ↗"}</a>`
      : `<a class="booking-link" href="https://www.google.com/search?q=${encodeURIComponent(c.name + " tee times")}" target="_blank" rel="noopener noreferrer">Find tee times ↗</a>`;

    // Rules & policies live on the course's own site; fall back to a search.
    const rulesHref = safeUrl(facts.site) || safeUrl(c.website) ||
      `https://www.google.com/search?q=${encodeURIComponent(c.name + " golf course rules dress code policies")}`;
    const rulesLink = `<a class="booking-link secondary-link" href="${escapeHtml(rulesHref)}" target="_blank" rel="noopener noreferrer">Course rules &amp; info ↗</a>`;

    item.innerHTML = `
      <div class="cname">${escapeHtml(c.name)}${badge}</div>
      ${address ? `<div class="caddr">${escapeHtml(address)}</div>` : ""}
      ${distance ? `<div class="cloc">${escapeHtml(distance)}</div>` : ""}
      <div class="cmeta">${meta.join("")}</div>
      <div class="clinks">${bookLink}${rulesLink}</div>
    `;
    courseListEl.appendChild(item);
  });
}

const courseSort = document.getElementById("courseSort");
const useLocationBtn = document.getElementById("useLocationBtn");
const locStatus = document.getElementById("locStatus");

courseSearch.addEventListener("input", () => renderCourses(courseSearch.value));
courseSort.addEventListener("change", () => renderCourses(courseSearch.value));

// Uses the device's GPS to re-centre the course list on exactly where you are,
// rather than the town saved in your profile. Nothing is uploaded anywhere.
useLocationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    locStatus.hidden = false;
    locStatus.textContent = "This browser doesn't support location lookup.";
    return;
  }
  locStatus.hidden = false;
  locStatus.textContent = "Getting your location...";
  useLocationBtn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude, accuracy } = pos.coords;
      locStatus.textContent = `Using your current position (±${Math.round(accuracy)} m). Your location stays on this device.`;
      useLocationBtn.disabled = false;
      loadNearbyCourses(latitude, longitude, "your current location");
    },
    err => {
      useLocationBtn.disabled = false;
      locStatus.textContent = err.code === err.PERMISSION_DENIED
        ? "Location permission denied — still showing courses near your profile home town."
        : "Couldn't get your location — still showing courses near your profile home town.";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
});

const courseAreaNote = document.getElementById("courseAreaNote");

function milesBetween(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Replaces the curated Ada list with real courses within ~30 miles of the
// profile's home town, from OpenStreetMap. Cached per location for 30 days.
async function loadNearbyCourses(lat, lon, label) {
  const cacheKey = `golf_nearby_${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const cached = store.get(cacheKey, null);
  if (cached && Date.now() - cached.fetchedAt < 30 * 24 * 3600 * 1000) {
    applyNearbyCourses(cached.courses, label);
    return;
  }
  courseAreaNote.textContent = `Finding courses near ${label}...`;
  const query = `[out:json][timeout:60];(way["leisure"="golf_course"](around:48000,${lat},${lon});relation["leisure"="golf_course"](around:48000,${lat},${lon});node["leisure"="golf_course"](around:48000,${lat},${lon}););out tags center;`;
  const endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
  try {
    let data = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query) });
        if (!res.ok) continue;
        data = await res.json();
        break;
      } catch { /* try next mirror */ }
    }
    if (!data) throw new Error("all mirrors failed");
    const seen = new Set();
    const courses = data.elements
      .filter(el => el.tags && el.tags.name)
      .map(el => {
        const cLat = el.center ? el.center.lat : el.lat;
        const cLon = el.center ? el.center.lon : el.lon;
        const curated = curatedCourses.find(c => c.name === el.tags.name);
        const street = [el.tags["addr:housenumber"], el.tags["addr:street"]].filter(Boolean).join(" ");
          const osmAddr = [street, el.tags["addr:city"], el.tags["addr:state"]].filter(Boolean).join(", ");
          return {
            name: el.tags.name,
            // Prefer the verified curated address; fall back to what OSM has mapped.
            loc: (curated && curated.loc) || osmAddr || null,
            miles: cLat != null ? Math.round(milesBetween(lat, lon, cLat, cLon)) : null,
            hours: el.tags.opening_hours || null,
            website: el.tags.website || null,
            access: curated ? curated.access
              : el.tags.access === "private" || el.tags.access === "members" ? "Private"
              : el.tags.access === "yes" || el.tags.access === "customers" || el.tags.access === "permissive" ? "Public"
              : null,
            bookingUrl: curated ? curated.bookingUrl : (el.tags.website || null),
          };
      })
      .filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });
    if (courses.length === 0) {
      courseAreaNote.textContent = `No mapped courses found within 30 miles of ${label} — showing the Ada, OH area list instead.`;
      return;
    }
    store.set(cacheKey, { fetchedAt: Date.now(), courses });
    applyNearbyCourses(courses, label);
  } catch {
    courseAreaNote.textContent = `Couldn't load courses near ${label} right now — showing the Ada, OH area list.`;
  }
}

function applyNearbyCourses(courses, label) {
  currentCourses = courses;
  courseAreaNote.textContent = `Showing ${courses.length} real courses within ~30 miles of ${label}.`;
  renderCourses(courseSearch.value);
  if (typeof populateCourseSelect === "function") populateCourseSelect();
}
renderCourses();

// ================= WEATHER (live via Open-Meteo, no API key required) =================
const weatherLocation = document.getElementById("weatherLocation");
const weatherBtn = document.getElementById("weatherBtn");
const weatherResult = document.getElementById("weatherResult");

function weatherCodeText(code) {
  const map = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow",
    80: "Rain showers", 81: "Rain showers", 82: "Violent rain showers",
    95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Thunderstorm w/ heavy hail"
  };
  return map[code] || "Unknown";
}

function golfVerdict(temp, wind, precipProb, code) {
  const issues = [];
  if (precipProb >= 50) issues.push("high chance of rain — consider rescheduling or packing rain gear");
  if (wind >= 20) issues.push("strong wind will affect club selection and shot shape significantly");
  else if (wind >= 12) issues.push("moderate wind — take an extra club into greens and expect more roll");
  if (temp <= 45) issues.push("cold conditions — ball won't travel as far, warm up well");
  if (temp >= 95) issues.push("very hot — stay hydrated and expect the ball to fly a bit further");
  if ([95, 96, 99].includes(code)) issues.push("thunderstorms — do not play, lightning risk");

  if (issues.length === 0) return "Great conditions for golf today — go play!";
  return "Heads up: " + issues.join("; ") + ".";
}

const radarFrame = document.getElementById("radarFrame");
const radarCaption = document.getElementById("radarCaption");

function setRadarLocation(lat, lon, label) {
  const la = lat.toFixed(3);
  const lo = lon.toFixed(3);
  radarFrame.src =
    `https://embed.windy.com/embed2.html?lat=${la}&lon=${lo}&detailLat=${la}&detailLon=${lo}` +
    `&zoom=8&level=surface&overlay=radar&product=radar&menu=&message=&marker=true&calendar=now` +
    `&pressure=&type=map&location=coordinates&detail=&metricWind=mph&metricTemp=%C2%B0F&radarRange=-1`;
  radarCaption.textContent = `Live precipitation radar centered on ${label} — powered by Windy.com.`;
}

async function checkWeather() {
  const query = weatherLocation.value.trim();
  if (!query) return;
  weatherResult.innerHTML = `<p class="muted">Loading weather...</p>`;
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      weatherResult.innerHTML = `<p class="muted">Couldn't find that location. Try a different city name.</p>`;
      return;
    }
    const { latitude, longitude, name, admin1, country } = geoData.results[0];
    setRadarLocation(latitude, longitude, `${name}${admin1 ? ", " + admin1 : ""}`);

    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,wind_speed_10m,precipitation_probability,weather_code,relative_humidity_2m` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph`
    );
    const wxData = await wxRes.json();
    const c = wxData.current;

    // Shot Planner reads these to adjust for wind and temperature.
    store.set("golf_last_weather", {
      wind: c.wind_speed_10m,
      temp: c.temperature_2m,
      at: Date.now(),
    });
    if (typeof spWindMph !== "undefined" && spWindMph) {
      spWindMph.placeholder = String(Math.round(c.wind_speed_10m));
    }

    weatherResult.innerHTML = `
      <div class="wx-current">
        <div class="wx-temp">${Math.round(c.temperature_2m)}°F</div>
        <div>
          <div class="wx-place">${escapeHtml(name)}${admin1 ? ", " + escapeHtml(admin1) : ""}${country ? ", " + escapeHtml(country) : ""}</div>
          <div class="muted">${weatherCodeText(c.weather_code)}</div>
        </div>
      </div>
      <div class="wx-grid">
        <div class="wx-metric"><div class="val">${Math.round(c.wind_speed_10m)} mph</div><div class="label">Wind</div></div>
        <div class="wx-metric"><div class="val">${c.precipitation_probability ?? 0}%</div><div class="label">Rain Chance</div></div>
        <div class="wx-metric"><div class="val">${c.relative_humidity_2m}%</div><div class="label">Humidity</div></div>
      </div>
      <div class="wx-verdict">${golfVerdict(c.temperature_2m, c.wind_speed_10m, c.precipitation_probability ?? 0, c.weather_code)}</div>
    `;
  } catch (err) {
    weatherResult.innerHTML = `<p class="muted">Weather lookup failed. Check your connection and try again.</p>`;
  }
}

weatherBtn.addEventListener("click", checkWeather);
weatherLocation.addEventListener("keydown", e => { if (e.key === "Enter") checkWeather(); });

// ================= SCORE (live scorecard) =================
const scCourseSelect = document.getElementById("scCourseSelect");
const scCustomWrap = document.getElementById("scCustomWrap");
const scCourseCustom = document.getElementById("scCourseCustom");
const scHolesSelect = document.getElementById("scHolesSelect");
const startRoundBtn = document.getElementById("startRoundBtn");
const scoreSetup = document.getElementById("scoreSetup");
const scoreCardPanel = document.getElementById("scoreCardPanel");
const scCourseName = document.getElementById("scCourseName");
const scRoundDate = document.getElementById("scRoundDate");
const scThru = document.getElementById("scThru");
const scStrokes = document.getElementById("scStrokes");
const scToPar = document.getElementById("scToPar");
const scTableBody = document.getElementById("scTableBody");
const finishRoundBtn = document.getElementById("finishRoundBtn");
const cancelRoundBtn = document.getElementById("cancelRoundBtn");

// standard par-72 layout (front 36 / back 36) — editable per hole in the card
const DEFAULT_PARS_18 = [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];

function loadActiveRound() { return store.get("golf_active_round", null); }
function saveActiveRound(r) { store.set("golf_active_round", r); }
function clearActiveRound() { localStorage.removeItem("golf_active_round"); }

function populateCourseSelect() {
  const prev = scCourseSelect.value;
  const nearby = [...currentCourses].sort((a, b) => (a.miles ?? 999) - (b.miles ?? 999)).slice(0, 12);
  scCourseSelect.innerHTML =
    nearby.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("") +
    `<option value="__other__">Other course...</option>`;
  if (prev && [...scCourseSelect.options].some(o => o.value === prev)) scCourseSelect.value = prev;
}
scCourseSelect.addEventListener("change", () => {
  scCustomWrap.hidden = scCourseSelect.value !== "__other__";
  if (scCourseSelect.value === "__other__") loadOhioCourses();
});

// Ohio course name autocomplete, sourced from OpenStreetMap (Overpass API).
// Fetched once, then cached in localStorage for 30 days.
const ohioCourseList = document.getElementById("ohioCourseList");
const scCustomHint = document.getElementById("scCustomHint");
let ohioCoursesLoading = false;

function populateOhioDatalist(names) {
  ohioCourseList.innerHTML = names.map(n => `<option value="${escapeHtml(n)}"></option>`).join("");
  scCustomHint.textContent = `${names.length} Ohio courses loaded — suggestions appear as you type.`;
}

async function loadOhioCourses() {
  const cached = store.get("golf_ohio_courses", null);
  if (cached && Date.now() - cached.fetchedAt < 30 * 24 * 3600 * 1000 && cached.names?.length) {
    populateOhioDatalist(cached.names);
    return;
  }
  if (ohioCoursesLoading) return;
  ohioCoursesLoading = true;
  scCustomHint.textContent = "Loading Ohio course list from OpenStreetMap...";
  const query = `[out:json][timeout:60];area["ISO3166-2"="US-OH"][admin_level=4]->.oh;(way["leisure"="golf_course"](area.oh);relation["leisure"="golf_course"](area.oh);node["leisure"="golf_course"](area.oh););out tags;`;
  // public Overpass instances, tried in order — the main one 504s when overloaded
  const endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
  try {
    let data = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query) });
        if (!res.ok) continue;
        data = await res.json();
        break;
      } catch { /* try next mirror */ }
    }
    if (!data) throw new Error("all mirrors failed");
    const names = [...new Set(
      data.elements.map(el => el.tags && el.tags.name).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
    store.set("golf_ohio_courses", { fetchedAt: Date.now(), names });
    populateOhioDatalist(names);
  } catch {
    scCustomHint.textContent = "Couldn't load the Ohio course list — you can still type any course name.";
  } finally {
    ohioCoursesLoading = false;
  }
}

function formatToPar(diff) {
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function diffLabel(diff) {
  if (diff <= -2) return `<span class="diff-label diff-eagle">Eagle${diff < -2 ? "+" : ""}</span>`;
  if (diff === -1) return `<span class="diff-label diff-birdie">Birdie</span>`;
  if (diff === 0) return `<span class="diff-label diff-par">Par</span>`;
  if (diff === 1) return `<span class="diff-label diff-bogey">Bogey</span>`;
  if (diff === 2) return `<span class="diff-label diff-double">Double</span>`;
  return `<span class="diff-label diff-double">+${diff}</span>`;
}

function renderScorecard() {
  const round = loadActiveRound();
  if (!round) {
    scoreSetup.hidden = false;
    scoreCardPanel.hidden = true;
    return;
  }
  scoreSetup.hidden = true;
  scoreCardPanel.hidden = false;
  scCourseName.textContent = round.course;
  scRoundDate.textContent = `${round.date} • ${round.holes.length} holes`;

  let rows = "";
  let nineStrokes = 0, ninePar = 0, ninePlayed = 0;
  round.holes.forEach((h, i) => {
    const played = h.strokes != null;
    rows += `
      <tr>
        <td class="hole-num">${i + 1}</td>
        <td>
          <span class="sc-cell">
            <button class="sc-btn" data-hole="${i}" data-act="par-">−</button>
            <span class="sc-val">${h.par}</span>
            <button class="sc-btn" data-hole="${i}" data-act="par+">+</button>
          </span>
        </td>
        <td>
          <span class="sc-cell">
            <button class="sc-btn" data-hole="${i}" data-act="str-">−</button>
            <span class="sc-val ${played ? "" : "empty"}">${played ? h.strokes : "–"}</span>
            <button class="sc-btn" data-hole="${i}" data-act="str+">+</button>
          </span>
        </td>
        <td>${played ? diffLabel(h.strokes - h.par) : ""}</td>
      </tr>
    `;
    if (played) { nineStrokes += h.strokes; ninePar += h.par; ninePlayed++; }
    if (i === 8 && round.holes.length === 18) {
      rows += `<tr class="nine-total"><td>OUT</td><td>${round.holes.slice(0, 9).reduce((s, x) => s + x.par, 0)}</td><td>${ninePlayed ? nineStrokes : "–"}</td><td>${ninePlayed ? formatToPar(nineStrokes - ninePar) : ""}</td></tr>`;
      nineStrokes = 0; ninePar = 0; ninePlayed = 0;
    }
  });
  if (round.holes.length === 18) {
    rows += `<tr class="nine-total"><td>IN</td><td>${round.holes.slice(9).reduce((s, x) => s + x.par, 0)}</td><td>${ninePlayed ? nineStrokes : "–"}</td><td>${ninePlayed ? formatToPar(nineStrokes - ninePar) : ""}</td></tr>`;
  }
  scTableBody.innerHTML = rows;

  const played = round.holes.filter(h => h.strokes != null);
  const totalStrokes = played.reduce((s, h) => s + h.strokes, 0);
  const playedPar = played.reduce((s, h) => s + h.par, 0);
  scThru.textContent = played.length;
  scStrokes.textContent = totalStrokes;
  scToPar.textContent = played.length ? formatToPar(totalStrokes - playedPar) : "E";
}

startRoundBtn.addEventListener("click", () => {
  let course = scCourseSelect.value;
  if (course === "__other__") {
    course = scCourseCustom.value.trim();
    if (!course) { scCourseCustom.focus(); return; }
  }
  const holeCount = Number(scHolesSelect.value);
  const pars = DEFAULT_PARS_18.slice(0, holeCount);
  saveActiveRound({
    course,
    date: new Date().toISOString().slice(0, 10),
    holes: pars.map(p => ({ par: p, strokes: null })),
  });
  renderScorecard();
});

scTableBody.addEventListener("click", e => {
  const btn = e.target.closest("button.sc-btn");
  if (!btn) return;
  const round = loadActiveRound();
  const h = round.holes[Number(btn.dataset.hole)];
  switch (btn.dataset.act) {
    case "par-": h.par = Math.max(3, h.par - 1); break;
    case "par+": h.par = Math.min(6, h.par + 1); break;
    case "str-":
      if (h.strokes != null) h.strokes = h.strokes === 1 ? null : h.strokes - 1;
      break;
    case "str+": h.strokes = h.strokes == null ? h.par : Math.min(15, h.strokes + 1); break;
  }
  saveActiveRound(round);
  renderScorecard();
});

finishRoundBtn.addEventListener("click", () => {
  const round = loadActiveRound();
  const played = round.holes.filter(h => h.strokes != null);
  if (played.length === 0) return;
  const rounds = loadRounds();
  rounds.push({
    id: crypto.randomUUID(),
    course: round.course,
    date: round.date,
    holes: String(played.length),
    par: played.reduce((s, h) => s + h.par, 0),
    score: played.reduce((s, h) => s + h.strokes, 0),
    putts: null,
    fairways: null,
  });
  saveRounds(rounds);
  clearActiveRound();
  renderScorecard();
  renderRounds();
  renderStats();
});

cancelRoundBtn.addEventListener("click", () => {
  clearActiveRound();
  renderScorecard();
});

populateCourseSelect();
renderScorecard();

// ================= PROFILE =================
const profileForm = document.getElementById("profileForm");
const pfName = document.getElementById("pfName");
const pfHome = document.getElementById("pfHome");
const pfSkill = document.getElementById("pfSkill");
const pfTypicalScore = document.getElementById("pfTypicalScore");
const pfDriver = document.getElementById("pfDriver");
const pfSevenIron = document.getElementById("pfSevenIron");
const pfStatus = document.getElementById("pfStatus");
const coachGreeting = document.getElementById("coachGreeting");

function loadProfile() { return store.get("golf_profile", null); }
function saveProfile(p) { store.set("golf_profile", p); }

function applyProfile() {
  const p = loadProfile();
  if (!p) return;
  if (p.name) {
    coachGreeting.textContent = `Hey ${p.name}, I'm your ParSense caddie 🏌️. Ask me about your swing, club selection, putting, or say "how am I doing" for stats from your logged rounds.`;
  }
  const label = p.homeLabel || p.home;
  if (label) {
    weatherLocation.value = label;
  }
  if (p.lat != null && p.lon != null) {
    setRadarLocation(p.lat, p.lon, label);
    loadNearbyCourses(p.lat, p.lon, label);
  }
}

function fillProfileForm() {
  const p = loadProfile();
  if (!p) return;
  pfName.value = p.name || "";
  pfHome.value = p.home || "";
  pfSkill.value = p.skill || "";
  if (pfSkill.selectedIndex === -1) pfSkill.value = ""; // saved value from an older option list
  pfTypicalScore.value = p.typicalScore || "";
  pfDriver.value = p.driver || "";
  pfSevenIron.value = p.sevenIron || "";
}

profileForm.addEventListener("submit", async e => {
  e.preventDefault();
  pfStatus.textContent = "Saving...";
  const p = {
    name: pfName.value.trim() || null,
    home: pfHome.value.trim() || null,
    skill: pfSkill.value || null,
    typicalScore: pfTypicalScore.value ? Number(pfTypicalScore.value) : null,
    driver: pfDriver.value ? Number(pfDriver.value) : null,
    sevenIron: pfSevenIron.value ? Number(pfSevenIron.value) : null,
    lat: null, lon: null, homeLabel: null,
  };
  if (p.home) {
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(p.home)}&count=1`);
      const data = await res.json();
      if (data.results && data.results.length) {
        const g = data.results[0];
        p.lat = g.latitude;
        p.lon = g.longitude;
        p.homeLabel = `${g.name}${g.admin1 ? ", " + g.admin1 : ""}`;
      }
    } catch { /* geocode is best-effort; profile still saves */ }
  }
  saveProfile(p);
  applyProfile();
  pfStatus.textContent = p.home && !p.homeLabel
    ? "Saved — but couldn't find that town on the map, so courses/weather stay on the defaults."
    : "Saved ✓";
});

// ---------- Generative golf avatar ----------
const avatarWrap = document.getElementById("avatarWrap");

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function generateAvatarSVG(seed) {
  const rnd = mulberry32(seed);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + rnd() * (b - a);

  const skies = [
    { top: "#8ed3f0", bottom: "#cfeef7", sun: "#ffd76e", night: false }, // day
    { top: "#f7b267", bottom: "#f9d9a6", sun: "#ff8c42", night: false }, // sunset
    { top: "#c86b85", bottom: "#f8b195", sun: "#ffb347", night: false }, // dusk
    { top: "#2b3a67", bottom: "#4e5d94", sun: "#f2f2d9", night: true },  // night
    { top: "#b8c6db", bottom: "#f5f7fa", sun: "#fff3b0", night: false }, // overcast
  ];
  const sky = pick(skies);
  const greensBack = ["#3e7c4f", "#2f6b40", "#4a8a58", "#356e45"];
  const greensFront = ["#57a05f", "#4c9455", "#63ab6a", "#519a5b"];
  const flagColors = ["#e05c5c", "#f2c14e", "#5c9de0", "#e07be0", "#ffffff", "#ff8c42"];

  const sunX = between(15, 85), sunY = between(12, 32), sunR = between(6, 11);
  const flagX = between(25, 75);
  const greenY = between(62, 72);
  const flagColor = pick(flagColors);
  const flagDir = rnd() > 0.5 ? 1 : -1;
  const backHillY = greenY - between(8, 16);

  let clouds = "";
  const cloudCount = Math.floor(rnd() * 3);
  for (let i = 0; i < cloudCount; i++) {
    const cx = between(10, 90), cy = between(10, 35), s = between(0.6, 1.2);
    const op = sky.night ? 0.25 : 0.85;
    clouds += `<g opacity="${op}" fill="#ffffff">
      <ellipse cx="${cx}" cy="${cy}" rx="${9 * s}" ry="${4 * s}"/>
      <ellipse cx="${cx - 6 * s}" cy="${cy + 1.5 * s}" rx="${6 * s}" ry="${3 * s}"/>
      <ellipse cx="${cx + 6 * s}" cy="${cy + 1.5 * s}" rx="${6 * s}" ry="${3 * s}"/>
    </g>`;
  }

  let stars = "";
  if (sky.night) {
    for (let i = 0; i < 12; i++) {
      stars += `<circle cx="${between(3, 97)}" cy="${between(3, 45)}" r="${between(0.4, 0.9)}" fill="#fffbe6" opacity="${between(0.5, 1)}"/>`;
    }
  }

  let trees = "";
  const treeCount = Math.floor(rnd() * 3);
  for (let i = 0; i < treeCount; i++) {
    const tx = rnd() > 0.5 ? between(6, 22) : between(78, 94);
    const ty = greenY + between(-2, 4);
    const th = between(10, 16);
    trees += `<g>
      <rect x="${tx - 1.2}" y="${ty - th * 0.45}" width="2.4" height="${th * 0.45}" fill="#6b4a2f"/>
      <circle cx="${tx}" cy="${ty - th * 0.62}" r="${th * 0.38}" fill="${pick(greensBack)}"/>
      <circle cx="${tx - th * 0.22}" cy="${ty - th * 0.48}" r="${th * 0.26}" fill="${pick(greensBack)}"/>
      <circle cx="${tx + th * 0.22}" cy="${ty - th * 0.48}" r="${th * 0.26}" fill="${pick(greensBack)}"/>
    </g>`;
  }

  const bunker = rnd() > 0.5
    ? `<ellipse cx="${flagX + between(-25, 25)}" cy="${greenY + between(8, 16)}" rx="${between(7, 12)}" ry="${between(2.5, 4)}" fill="#e8d8a8"/>`
    : "";

  const ballX = flagX + between(-14, 14);
  const ballY = greenY + between(4, 10);

  // A golfer stands on the green in most avatars (scenery-only the rest of the time).
  let golfer = "";
  if (rnd() < 0.72) {
    const skinTones = ["#f8d5b8", "#eab38c", "#c98a5f", "#9c6340", "#6f4428", "#f2c199"];
    const hairColors = ["#2e2118", "#5a3a22", "#8a5a2b", "#c9973f", "#e0c068", "#9b3f2f", "#d9d9d9", "#4a4a4a"];
    const shirtColors = ["#e05c5c", "#5c9de0", "#f2c14e", "#ffffff", "#7bc47f", "#c77bd4", "#ff8c42", "#3f7fd4"];
    const pantsColors = ["#3a3f4a", "#6b6f78", "#2b4a6b", "#e8e2d4", "#8a7355", "#4a3b2f"];
    const skin = pick(skinTones);
    const hair = pick(hairColors);
    const shirt = pick(shirtColors);
    const pants = pick(pantsColors);
    // "long" reads feminine, "short" masculine, "ponytail"/"bun" mixed — all genders represented
    const hairStyle = pick(["short", "long", "ponytail", "bun", "cap", "visor", "curly"]);
    const gx = flagX > 50 ? between(20, 34) : between(66, 80); // stand opposite the flag
    const gy = greenY + between(9, 15);                        // feet on the front green
    const s = between(0.85, 1.15);                             // overall golfer scale
    const faceR = 5 * s;
    const headY = gy - 21 * s;
    const swingDir = gx < flagX ? 1 : -1;                      // face the flag

    let hairShape = "";
    switch (hairStyle) {
      case "long":
        hairShape = `<path d="M ${gx - faceR - 0.8} ${headY - 1} q 0 ${-faceR * 1.5} ${faceR + 0.8} ${-faceR * 1.5} q ${faceR + 0.8} 0 ${faceR + 0.8} ${faceR * 1.5} l 0 ${faceR * 1.9} q ${-faceR * 0.5} ${-faceR * 0.5} ${-faceR * 0.7} ${-faceR * 1.3} l ${-faceR * 2.2} 0 q ${-faceR * 0.2} ${faceR * 0.8} ${-faceR * 0.7} ${faceR * 1.3} z" fill="${hair}"/>`;
        break;
      case "ponytail":
        hairShape = `<path d="M ${gx - faceR - 0.5} ${headY} a ${faceR + 0.5} ${faceR + 0.5} 0 0 1 ${(faceR + 0.5) * 2} 0 z" fill="${hair}"/>
          <path d="M ${gx + faceR * 0.6} ${headY - faceR * 0.4} q ${faceR * 1.5} ${faceR * 0.6} ${faceR * 0.6} ${faceR * 2.4} q ${-faceR * 0.5} ${-faceR * 0.8} ${-faceR * 0.9} ${-faceR * 1.6} z" fill="${hair}"/>`;
        break;
      case "bun":
        hairShape = `<circle cx="${gx}" cy="${headY - faceR * 1.35}" r="${faceR * 0.55}" fill="${hair}"/>
          <path d="M ${gx - faceR - 0.5} ${headY} a ${faceR + 0.5} ${faceR + 0.5} 0 0 1 ${(faceR + 0.5) * 2} 0 z" fill="${hair}"/>`;
        break;
      case "curly":
        hairShape = `<circle cx="${gx - faceR * 0.6}" cy="${headY - faceR * 0.7}" r="${faceR * 0.55}" fill="${hair}"/>
          <circle cx="${gx}" cy="${headY - faceR * 0.95}" r="${faceR * 0.6}" fill="${hair}"/>
          <circle cx="${gx + faceR * 0.6}" cy="${headY - faceR * 0.7}" r="${faceR * 0.55}" fill="${hair}"/>
          <circle cx="${gx - faceR * 0.95}" cy="${headY - faceR * 0.1}" r="${faceR * 0.45}" fill="${hair}"/>
          <circle cx="${gx + faceR * 0.95}" cy="${headY - faceR * 0.1}" r="${faceR * 0.45}" fill="${hair}"/>`;
        break;
      case "cap":
        hairShape = `<path d="M ${gx - faceR - 0.5} ${headY - faceR * 0.15} a ${faceR + 0.5} ${faceR + 0.5} 0 0 1 ${(faceR + 0.5) * 2} 0 z" fill="${pick(shirtColors)}"/>
          <rect x="${gx - faceR - 0.5}" y="${headY - faceR * 0.4}" width="${(faceR + 0.5) * 2}" height="${faceR * 0.35}" rx="${faceR * 0.17}" fill="${pick(shirtColors)}"/>
          <path d="M ${gx + faceR * 0.2} ${headY - faceR * 0.3} l ${faceR * 1.5 * swingDir} 0 l 0 ${faceR * 0.3} l ${-faceR * 1.5 * swingDir} 0 z" fill="#1f2933" opacity="0.75"/>`;
        break;
      case "visor":
        hairShape = `<path d="M ${gx - faceR - 0.5} ${headY} a ${faceR + 0.5} ${faceR + 0.5} 0 0 1 ${(faceR + 0.5) * 2} 0 z" fill="${hair}"/>
          <rect x="${gx - faceR - 0.5}" y="${headY - faceR * 0.5}" width="${(faceR + 0.5) * 2}" height="${faceR * 0.32}" rx="${faceR * 0.16}" fill="${pick(shirtColors)}"/>`;
        break;
      default: // short
        hairShape = `<path d="M ${gx - faceR - 0.4} ${headY + faceR * 0.15} a ${faceR + 0.4} ${faceR + 0.4} 0 0 1 ${(faceR + 0.4) * 2} 0 q ${-faceR * 0.6} ${-faceR * 0.55} ${-(faceR + 0.4) * 2} 0 z" fill="${hair}"/>`;
    }

    golfer = `<g>
      <ellipse cx="${gx}" cy="${gy + 0.8}" rx="${5.5 * s}" ry="${1.6 * s}" fill="#000" opacity="0.16"/>
      <!-- legs -->
      <rect x="${gx - 3.1 * s}" y="${gy - 9 * s}" width="${2.6 * s}" height="${9 * s}" rx="${1.1 * s}" fill="${pants}"/>
      <rect x="${gx + 0.5 * s}" y="${gy - 9 * s}" width="${2.6 * s}" height="${9 * s}" rx="${1.1 * s}" fill="${pants}"/>
      <!-- shoes -->
      <ellipse cx="${gx - 1.8 * s}" cy="${gy}" rx="${2.2 * s}" ry="${1.1 * s}" fill="#ffffff"/>
      <ellipse cx="${gx + 1.8 * s}" cy="${gy}" rx="${2.2 * s}" ry="${1.1 * s}" fill="#ffffff"/>
      <!-- torso -->
      <path d="M ${gx - 4.2 * s} ${gy - 9 * s} l 0 ${-6.5 * s} q 0 ${-2.2 * s} ${4.2 * s} ${-2.2 * s} q ${4.2 * s} 0 ${4.2 * s} ${2.2 * s} l 0 ${6.5 * s} z" fill="${shirt}"/>
      <!-- club arm, swinging toward the flag -->
      <line x1="${gx + 3 * s * swingDir}" y1="${gy - 14 * s}" x2="${gx + 7.5 * s * swingDir}" y2="${gy - 10 * s}" stroke="${skin}" stroke-width="${2 * s}" stroke-linecap="round"/>
      <line x1="${gx + 7.5 * s * swingDir}" y1="${gy - 10 * s}" x2="${gx + 11 * s * swingDir}" y2="${gy - 1 * s}" stroke="#c9ccd1" stroke-width="${1.1 * s}" stroke-linecap="round"/>
      <line x1="${gx + 11 * s * swingDir}" y1="${gy - 1 * s}" x2="${gx + 12.6 * s * swingDir}" y2="${gy - 0.4 * s}" stroke="#8f959c" stroke-width="${1.7 * s}" stroke-linecap="round"/>
      <!-- head -->
      <circle cx="${gx}" cy="${headY}" r="${faceR}" fill="${skin}"/>
      ${hairShape}
      <circle cx="${gx - faceR * 0.34}" cy="${headY + faceR * 0.1}" r="${faceR * 0.15}" fill="#1f2933"/>
      <circle cx="${gx + faceR * 0.34}" cy="${headY + faceR * 0.1}" r="${faceR * 0.15}" fill="#1f2933"/>
      <path d="M ${gx - faceR * 0.32} ${headY + faceR * 0.5} q ${faceR * 0.32} ${faceR * 0.32} ${faceR * 0.64} 0" stroke="#1f2933" stroke-width="${0.5 * s}" fill="none" stroke-linecap="round"/>
    </g>`;
  }

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky${seed}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${sky.top}"/>
        <stop offset="1" stop-color="${sky.bottom}"/>
      </linearGradient>
      <clipPath id="clip${seed}"><circle cx="50" cy="50" r="50"/></clipPath>
    </defs>
    <g clip-path="url(#clip${seed})">
      <rect width="100" height="100" fill="url(#sky${seed})"/>
      ${stars}
      <circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="${sky.sun}"/>
      ${clouds}
      <ellipse cx="50" cy="${backHillY + 30}" rx="75" ry="34" fill="${pick(greensBack)}"/>
      <ellipse cx="50" cy="${greenY + 34}" rx="80" ry="38" fill="${pick(greensFront)}"/>
      ${bunker}
      ${trees}
      <ellipse cx="${flagX}" cy="${greenY + 1.5}" rx="1.8" ry="0.8" fill="#1f3d29"/>
      <rect x="${flagX - 0.5}" y="${greenY - 22}" width="1" height="22" fill="#f0f0f0"/>
      <path d="M ${flagX} ${greenY - 22} l ${9 * flagDir} 3 l ${-9 * flagDir} 3 z" fill="${flagColor}"/>
      <circle cx="${ballX}" cy="${ballY}" r="1.6" fill="#ffffff"/>
      ${golfer}
    </g>
  </svg>`;
}

function renderAvatar() {
  let seed = store.get("golf_avatar_seed", null);
  if (seed == null) {
    seed = Math.floor(Math.random() * 4294967296);
    store.set("golf_avatar_seed", seed);
  }
  avatarWrap.innerHTML = generateAvatarSVG(seed);
}

avatarWrap.addEventListener("click", () => {
  store.set("golf_avatar_seed", Math.floor(Math.random() * 4294967296));
  renderAvatar();
});

renderAvatar();

fillProfileForm();
applyProfile();

// ---------- Golf ball mascot ----------
const golfBuddy = document.getElementById("golfBuddy");
const buddyBubble = document.getElementById("buddyBubble");
const buddyLines = [
  "Beaster!",
  "Fore!",
  "Having a ball out here!",
  "You're dimply the best!",
  "Par-ty time! ⛳",
  "Stay out of the rough!",
  "Just rolling through...",
  "Nice swing... I felt that one.",
  "Grip it and rip it!",
  "I never slice. Can't say the same for you 😏",
  "Keep your head down — not me though!",
  "Shotgun time?",
  "That one's still gettable.",
  "Mulligan? I saw nothing 👀",
  "Gimme range: generous today.",
  "Send it!",
  "Water hazard? Never heard of her.",
  "Left rough again? Bold strategy.",
  "Tee it high, let it fly!",
  "Beer cart's on the back nine 🍺",
  "Play it as it lies... mostly.",
  "That's a breakfast ball, take another.",
  "Drive for show, putt for dough.",
  "You've got this — I believe in you!",
  "Cart path only. Sorry, rules.",
  "Sandbagger? Me? Never.",
  "Two-putt and we're golden.",
  "Wind's helping. Probably.",
  "Bogey's still a score!",
  "Nice lag... now bury it.",
  "Front nine warm-up, back nine glory.",
  "I've been in worse lies.",
];
let buddyTimer = null;
golfBuddy.addEventListener("click", () => {
  buddyBubble.textContent = buddyLines[Math.floor(Math.random() * buddyLines.length)];
  buddyBubble.hidden = false;
  clearTimeout(buddyTimer);
  buddyTimer = setTimeout(() => { buddyBubble.hidden = true; }, 2500);
});

// ---------- PWA ----------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* offline support is optional */ });
}
