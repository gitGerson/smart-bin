This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Smart-bin WhatsApp alert

The ESP32 calls `POST /api/alerts/distance` when the ultrasonic distance drops
below 5 cm. The server then sends the warning through a self-hosted
[WAHA Plus](https://waha.devlike.pro) instance using the NOWEB engine, keeping
the WAHA API key out of the device firmware.

1. Run WAHA Plus with `WHATSAPP_DEFAULT_ENGINE=NOWEB` and `WHATSAPP_API_KEY`
   set, then start a session and scan the QR code so its status is `WORKING`.
2. Copy `.env.example` to `.env.local` and set `WAHA_BASE_URL`, `WAHA_API_KEY`,
   `WAHA_SESSION`, the target (`WAHA_TARGET`, a phone number or a full chat ID
   such as `...@g.us` for a group), the country code, and a long random device
   API key.
   Optionally set `ALERT_MESSAGE` to change the alert wording without touching
   the code. It supports the `{distanceCm}`, `{thresholdCm}`, and `{time}`
   placeholders; unset falls back to `Peringatan : Tempat Sampah Hampir Penuh`.
3. Set your Wi-Fi credentials and the matching device API key directly in
   `arduino/app.ino`.
4. Upload the sketch to the ESP32. It sends alerts to
   `https://bin.dfxx.my.id/api/alerts/distance`.

The ESP32 sends one message per close-object event. It rearms after the measured
distance reaches 7 cm and retries failed notifications at most once every 30
seconds.

## Google Sheets log

Every 60 seconds the ESP32 posts the current distance to `POST /api/readings`,
and each alert attempt is logged with its WhatsApp result. Rows land in a `Log`
sheet with the columns `Time (WIB)`, `Type`, `Distance (cm)`, `Fill (%)`, and
`Note`.

1. Create a Google Sheet, open **Extensions → Apps Script**, and replace the
   code with `google-apps-script/Code.gs`.
2. In **Project Settings → Script properties**, add `SECRET` with a long random
   value.
3. **Deploy → New deployment → Web app**, execute as *Me*, access *Anyone*.
   Copy the `/exec` URL.
4. Set `SHEETS_WEBHOOK_URL`, `SHEETS_WEBHOOK_SECRET` (same as `SECRET`), and
   optionally `BIN_DEPTH_CM` for the fill percentage, then redeploy.

A logging failure never blocks the WhatsApp alert.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
