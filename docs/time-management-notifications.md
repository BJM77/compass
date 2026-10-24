# Manage Time – due dates, reminders & push notifications

All times are **Australia/Perth (AWST, UTC+8)**.

## In the app (no setup needed)
- **Due dates** on tasks (quick picks: Today 5pm, Tomorrow 9am, Friday 5pm, or a custom date/time).
- **Due chips**: red = overdue, amber = due today, grey = later.
- **Auto-promote**: incomplete tasks that are overdue or due today move to *Do Now* (alongside the existing 24h *Do Soon → Do Now* rule), with a toast.
- **Header bell**: count of overdue + due-today tasks in your current plan; the popover links to Manage Time.
- **Add to calendar**: downloads an `.ics` for the task (30-min event at the due time, 15-min alert).
- **Delegate or Delete?**: Do Now tasks untouched for 2+ days show a prompt.
- **Leaders** (LEADER / GM / ADMIN / SUPER_ADMIN): *View Team Plans* shows each person's overdue/due-today and stale counts, with a **Nudge** button. It writes `systemAnnouncements/nudge_<uid>` (the existing Team Nudge broadcast mechanism, targeted at one person), which shows as a banner for that user, and a push is sent if they've enabled notifications.

## Push notifications (Firebase Cloud Messaging)
- Users opt in under **Settings → Notifications** (per device). Preferences: quiet hours (default 7am–6pm weekdays), daily digest, TWTW/NWA deadline nudges, and stale Do Now alerts.
- Per task: reminders 15 min before, 8am on the day, and/or the day before.
- Data: `users/{uid}/fcmTokens/{sha256(token)}` and `users/{uid}/notificationSettings/prefs` (owner-only by Firestore rules). The server-only `users/{uid}/notificationLog/*` and `notificationActions/*` collections are closed to clients.
- Notification buttons (**Snooze 1h / Tomorrow / Mark done**) are handled by `public/firebase-messaging-sw.js`, which POSTs to the `notificationAction` function with a random, single-use action token that expires after 7 days. The token is issued with that one notification.

### Cloud Functions (`functions/`, region `australia-southeast1`)
- `sendTimeNotifications`: runs every 5 minutes and sends task reminders, snoozes, stale escalations, the 8am digest (top 3 Do Now + due today), TWTW and NWA nudges, and Team Nudge pushes. It respects quiet hours; anything held by quiet hours is sent when the window opens, as long as that's within 72h.
- `notificationAction`: an HTTPS endpoint for the notification buttons.

### Deadline nudges: how submissions are detected
- **TWTW**: `twiwSubmissions/{uid}_{week}` with `status == 'SUBMITTED'`. The app labels it "Thursday TWTW", so the nudge goes out at **1pm on Thursday** by default.
- **NWA (Next Weeks Activity, formerly Friday FW)**: `weeklyReports/{uid}_{reviewedWeek}` with `submittedAt` set, where the reviewed week is the week just finished. The nudge goes out at **7am on Mondays** (before the Monday NWA meeting).
- `week` uses the app's financial-year week key (`getWeekForDate`), computed in Perth time.
- There's no stored "TWTW due day" setting in the app, so the TWTW day is behind flags. Set them in `functions/.env.<projectId>`:
  ```
  TWTW_NUDGE_ENABLED=true
  TWTW_DUE_WEEKDAY=4   # 0=Sun … 4=Thu
  FW_NUDGE_ENABLED=true
  ```

### Setup
1. Use the **Blaze** plan (Cloud Functions and Cloud Scheduler need it).
2. Firebase console → Project settings → Cloud Messaging → *Web Push certificates* → **Generate key pair**. Put the public key in `NEXT_PUBLIC_FIREBASE_VAPID_KEY`: in `apphosting.yaml` (see the commented entry) and in `.env.local` for local dev. Then redeploy App Hosting.
3. `firebase deploy --only functions,firestore:rules`
4. **iPhone/iPad**: web push works only on iOS/iPadOS 16.4+ and only once the site has been added to the Home Screen. In Safari, tap Share → *Add to Home Screen*, open the app from the icon, then enable notifications in Settings.

### Not included
- **SMS**: out of scope.
- **Email digest**: skipped. The app has no existing email-sending path.

### Dev
- `npm test`: unit tests (time helpers).
- `npm run test:rules`: Firestore rules tests in the emulator (needs Java 17).
- `npm run build:functions` / `npm run test:functions`: builds and tests the functions' scheduling logic.
- `functions/src/shared/time-mgmt.ts` is a copy of `src/lib/time-mgmt.ts`. Run `npm --prefix functions run sync-shared` after changing the original.
