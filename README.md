This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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


## Supabase setup

This project uses `@supabase/ssr` with separate browser and server clients.

1. Install the pinned Supabase dependencies and refresh the npm lockfile:

   ```bash
   npm install
   ```

2. Copy the safe environment template:

   ```bash
   cp .env.example .env.local
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

The Supabase browser and server clients are in `src/lib/supabase/`. The root `src/proxy.ts` refreshes auth cookies on requests. It does not protect any routes yet; add route authorization when the login and account pages are implemented.

Only use the publishable key in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable or commit private credentials. Keep `.env.local` out of Git.

Before deploying, add the same two public project variables to your hosting provider's environment settings.


## Supabase Storage security integration tests

The Storage security suite tests the actual `marketplace-images` bucket and its RLS policies using two authenticated seller accounts. The existing two seller accounts in the **development** Supabase project can be used: each must have a confirmed email, the `seller` role in `public.profiles`, an owned store, and working sign-in credentials. The suite creates uniquely named disposable objects under each seller's own folder and removes them with the authenticated owner session; it does not edit seller profiles, stores, or products.

Do not use production accounts or accounts whose Storage folders contain important files.

### Configure test credentials

Copy `.env.storage-test.example` to `.env.storage-test` and fill in the development project URL, publishable/anon key, and both seller login credentials. This file is ignored by Git. Never commit it or paste passwords into chat.

Run:

```bash
npm run test:storage-security
```

The script refuses to run unless the Supabase URL belongs to the expected development project ref. It never uses a service-role key.

The 13 checks cover anonymous and direct-Storage upload denial, valid uploads by both sellers through the validation function, own-object update/listing, cross-seller upload/update/delete isolation, unsupported MIME types, forged image signatures, the 5 MiB limit, and public image delivery. A cleanup warning is a failed run requiring manual inspection of the reported disposable path.
