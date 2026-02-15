<<<<<<< HEAD

=======
function syncCanvasUpcomingToGoogleCalendar() {
  const props = PropertiesService.getScriptProperties();
  const calId = props.getProperty("CANVAS_SYNC_CAL_ID") || "primary";
  const cal = CalendarApp.getCalendarById(calId);
  if (!cal) throw new Error("Could not open calendar: " + calId);

  const instances = [
    {
      tag: "AISD",
      base: (props.getProperty("AISD_CANVAS_BASE_URL") || "").replace(/\/+$/, ""),
      token: (props.getProperty("AISD_CANVAS_TOKEN") || "").trim()
    },
    {
      tag: "UTA",
      base: (props.getProperty("UTA_CANVAS_BASE_URL") || "").replace(/\/+$/, ""),
      token: (props.getProperty("UTA_CANVAS_TOKEN") || "").trim()
    }
  ].filter(x => x.base && x.token); // only run configured ones

  if (!instances.length) {
    throw new Error("Missing AISD/UTA Canvas properties. Set *_CANVAS_BASE_URL and *_CANVAS_TOKEN.");
  }

  // Pull existing events in range once (shared dedupe map)
  const LOOKAHEAD_DAYS = 45;
  const now = new Date();
  const end = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  const existing = cal.getEvents(now, end);
  const byKey = new Map();
  for (const ev of existing) {
    const desc = ev.getDescription() || "";
    const m = desc.match(/\[CanvasKey:([^\]]+)\]/);
    if (m) byKey.set(m[1], ev);
  }

  let created = 0, updated = 0;

  for (const inst of instances) {
    const items = canvasFetchJson_(inst.base, inst.token, "/api/v1/users/self/upcoming_events", {});

    for (const it of (items || [])) {
      const title = String(it.title || it.name || "Canvas Item").trim();
      const dueStr = it.due_at || it.start_at || it.end_at;
      if (!dueStr) continue;

      const due = new Date(dueStr);
      if (isNaN(due.getTime()) || due < now || due > end) continue;

      const allDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

      // IMPORTANT: include instance tag in key so AISD/UTA IDs never collide
      const rawId = String(it.id || "");
      const key = `${inst.tag}:${rawId || (title + "|" + dueStr)}`;

      const url = it.html_url || it.url || "";
      const course = it.context_name || it.course_name || "";
      const eventTitle = `[${inst.tag} Canvas Due] ${title}${course ? " — " + course : ""}`;
      const eventDesc =
        `Source: ${inst.tag}\n` +
        (course ? `Course: ${course}\n` : "") +
        (url ? `Link: ${url}\n` : "") +
        `\n[CanvasKey:${key}]`;

      const prev = byKey.get(key);

      if (!prev) {
        const ev = cal.createAllDayEvent(eventTitle, allDay, {
          description: eventDesc,
          location: url || ""
        });
        // reminders (7/3/1 days)
        ev.addPopupReminder(7 * 24 * 60);
        ev.addPopupReminder(3 * 24 * 60);
        ev.addPopupReminder(1 * 24 * 60);
        created++;
        byKey.set(key, ev);
      } else {
        const prevDate = prev.getAllDayStartDate ? prev.getAllDayStartDate() : prev.getStartTime();
        const prevAllDay = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());

        if (prevAllDay.getTime() !== allDay.getTime()) {
          prev.deleteEvent();
          const ev = cal.createAllDayEvent(eventTitle, allDay, { description: eventDesc, location: url || "" });
          ev.addPopupReminder(7 * 24 * 60);
          ev.addPopupReminder(3 * 24 * 60);
          ev.addPopupReminder(1 * 24 * 60);
          updated++;
          byKey.set(key, ev);
          continue;
        }

        let changed = false;
        if (prev.getTitle() !== eventTitle) { prev.setTitle(eventTitle); changed = true; }
        if ((prev.getLocation() || "") !== (url || "")) { prev.setLocation(url || ""); changed = true; }
        if ((prev.getDescription() || "") !== eventDesc) { prev.setDescription(eventDesc); changed = true; }
        if (changed) updated++;
      }
    }
  }

  Logger.log(`Canvas→GCal created=${created}, updated=${updated}`);
}

function canvasFetchJson_(base, token, path, params) {
  const url = buildUrl_(base + path, params || {});
  const res = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token }
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(`Canvas API error ${code}: ${res.getContentText().slice(0, 300)}`);
  }
  return JSON.parse(res.getContentText() || "null");
}

function buildUrl_(base, params) {
  const q = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
  return q ? `${base}?${q}` : base;
}

function buildDailyScheduleFromCalendar() {
  const CAL_ID = "primary";        // change if needed
  const DAY_START_HOUR = 8;
  const DAY_END_HOUR = 22;
  const FILL_RATIO = 0.80;         // 80% rule
  const BLOCK_MIN = 60;            // 1 hour focus blocks
  const BREAK_MIN = 10;

  const cal = CalendarApp.getCalendarById(CAL_ID);
  if (!cal) throw new Error("Calendar not found");

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAY_START_HOUR, 0);
  const dayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAY_END_HOUR, 0);

  // Pull existing events (lectures, etc.)
  const events = cal.getEvents(dayStart, dayEnd)
    .map(e => ({ start: e.getStartTime(), end: e.getEndTime() }))
    .sort((a,b) => a.start - b.start);

  // Compute free blocks
  const free = [];
  let cursor = new Date(dayStart);

  for (const ev of events) {
    if (ev.end <= cursor) continue;
    if (ev.start > cursor) {
      free.push({ start: new Date(cursor), end: new Date(ev.start) });
    }
    cursor = new Date(Math.max(cursor.getTime(), ev.end.getTime()));
  }

  if (cursor < dayEnd) {
    free.push({ start: new Date(cursor), end: new Date(dayEnd) });
  }

  // Total free minutes
  const freeMinutes = free.reduce((sum, f) => sum + (f.end - f.start) / 60000, 0);
  const targetMinutes = Math.floor(freeMinutes * FILL_RATIO);

  let scheduled = 0;

  for (const slot of free) {
    let t = new Date(slot.start);

    while (t < slot.end && scheduled < targetMinutes) {
      const blockEnd = new Date(t.getTime() + BLOCK_MIN * 60000);
      if (blockEnd > slot.end) break;

      cal.createEvent(
        "Study Block",
        t,
        blockEnd,
        { description: "Auto-scheduled around lectures" }
      );

      scheduled += BLOCK_MIN;
      t = new Date(blockEnd.getTime() + BREAK_MIN * 60000);
    }

    if (scheduled >= targetMinutes) break;
  }

  Logger.log(`Scheduled ${scheduled} minutes (80% rule enforced).`);
}

function extractTextFromSyllabusPdf(fileId) {
  const blob = DriveApp.getFileById(fileId).getBlob();

  const converted = Drive.Files.copy(
    { title: "tmp_syllabus_doc", mimeType: MimeType.GOOGLE_DOCS },
    fileId
  );

  const docId = converted.id;
  const text = DocumentApp.openById(docId).getBody().getText();

  // Clean up temp doc
  DriveApp.getFileById(docId).setTrashed(true);

  return text;
}

function installCanvasSyncTrigger() {
  ScriptApp.newTrigger("syncCanvasUpcomingToGoogleCalendar")
    .timeBased()
    .everyHours(6)
    .create();
}
>>>>>>> 3f880d3 (Initial ASS system: Canvas sync + lecture scheduler)
