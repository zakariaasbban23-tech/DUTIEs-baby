# Dorm Duty

A free, local-only WeChat Mini Program for two independent dorm chores:

- **Garbage:** Zakaria → Roman → Yegor, daily, anchored to October 27, 2026.
- **Floor Cleaning:** Zakaria → Yegor → Roman, every three days, anchored to October 29, 2026.

No account, payment, backend, or cloud service is required. Completion records and reminder preferences stay in WeChat local storage on the current device. They are not synchronized between roommates.

## Run in WeChat Developer Tools

1. Install Node.js 20 or newer.
2. In this project folder, run:
   ```bash
   npm install
   npm run build:weapp
   ```
3. Open WeChat Developer Tools and choose **Mini Program → Import Project**.
4. Select this project folder (the folder containing `project.config.json`). The configured Mini Program root is `dist/weapp/`.
5. For local testing, use the test/tourist AppID option or your own free Mini Program AppID. No cloud environment is needed.
6. Click **Compile**. Use the schedule checker on the home page to test any date without changing the device clock.

To rebuild after edits, run `npm run build:weapp` and compile again in Developer Tools.

## Tests and production build

```bash
npm test
npm run build
```

The second command builds both `dist/weapp/` (WeChat) and `dist/` (web preview).

## Reminders: what works and what does not

- Each chore has its own enabled/disabled preference, reminder time, next scheduled reminder date, copyable message, and phone-calendar setup guide.
- Floor-cleaning reminders only point to dates with an assigned cleaning duty.
- For a completely free setup, copy the message into your phone's Calendar app and enable the calendar alert.
- **WeChat subscription push notifications and scheduled cloud tasks are not activated.** The app never claims to have sent a notification. Those features would require separate WeChat configuration and, for unattended scheduled delivery, a backend/cloud task.

## Storage

Separate keys are used for garbage history, floor history, garbage reminder settings, and floor reminder settings. Known legacy garbage history keys are read and merged without deleting their original values. Marking a chore complete changes only that chore's history; it never changes either schedule.
