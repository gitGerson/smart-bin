This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Smart-bin WhatsApp alert

The ESP32 calls `POST /api/alerts/distance` when the ultrasonic distance drops
below 5 cm. The server then sends the warning through Fonnte, keeping the Fonnte
token out of the device firmware.

1. Copy `.env.example` to `.env.local` and set the Fonnte token, target number,
   country code, and a long random device API key.
2. Copy `arduino/secrets.example.h` to `arduino/secrets.h`, then set the same
   device API key and your Wi-Fi credentials there. This file is git-ignored.
3. Set the reachable Next.js server URL in `arduino/app.ino`.
4. Start the server with `npm run dev -- --hostname 0.0.0.0`, then upload the
   sketch to the ESP32. Allow port 3000 through the local firewall if required.

The ESP32 sends one message per close-object event. It rearms after the measured
distance reaches 7 cm and retries failed notifications at most once every 30
seconds.

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
