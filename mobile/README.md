# The phone app

Block & Bind for Android and iOS: Community, My quiltings, My fabrics and the camera. It's a web page (`src/`) that
[Capacitor](https://capacitorjs.com) wraps as a real app; `android/` and `ios/` are the two native projects it made.
Designing stays on the web. Quilts, fabric photos, folders and quilt photos are kept on the phone first and sync with the
same account as the web app.

## Working on it without a phone

```bash
npm run dev -w @quilt/mobile
```

Then open http://localhost:8200 in a browser, in its phone view. It shows the live Community. Signing in needs this address
among Auth0's allowed ones, so for trying the signed-in screens use the tests' name sign-in instead:

```bash
npm run test:e2e -w @quilt/mobile
```

## What's needed to run it on a phone

These steps need the owner's accounts or programs, so they have not been done or tried yet. The code that only runs inside
the real app (the camera, signing in through the phone's browser, the Android back button) has **never run on a device**:
expect small corrections.

**1. Install Android Studio** from developer.android.com/studio. It brings Java and the Android tools. Then:

```bash
npm run android -w @quilt/mobile
```

That builds the page, copies it into the Android project and opens it in Android Studio; the ▶ button runs it on a phone
with USB debugging turned on, or on an emulator. iOS is the same with `npm run ios -w @quilt/mobile`, but needs a Mac with
Xcode, or a cloud build service.

**2. The name of the app in the stores.** The app's id is `com.blockandbind.app` (`capacitor.config.json`). It can't change
once published, and it's also in `src/auth.js` and in the two native projects. Change it now if you'd like another one.

**3. Let the app reach the server.** At Fly.io, add the app's two addresses to the ones already there (keep the web page's):

```bash
fly secrets set --app block-and-bind-api CORS_ORIGINS=https://block-and-bind.pages.dev,https://localhost,capacitor://localhost
```

**4. Let the app reach the photos.** In the Cloudflare R2 bucket's CORS settings, allow `PUT` and `GET` from
`https://localhost` and `capacitor://localhost` too.

**5. Let the app sign in.** In Auth0, on the app's settings page, add this to **Allowed Callback URLs** and to **Allowed
Logout URLs**, and add `https://localhost, capacitor://localhost` to **Allowed Origins (CORS)**:

```
com.blockandbind.app://dev-5op4uervqyekvlsx.us.auth0.com/capacitor/com.blockandbind.app/callback
```

**6. Update the server.** The server has new routes, and a new table file, `server/migrations/005_phone_app.sql`. Follow
"Going live" in `server/README.md` to deploy it. Until then the phone can show Community and keep things on the phone, but
can't send photos, folders or notes, or block someone or delete an account.

## Before the stores

- **Account deletion:** the app deletes everything of the person's on our server. Their sign-in at Auth0 stays: signing in
  again only starts a new, empty account. Removing it too needs Auth0's Management API, with a secret on the server.
- **Privacy policy and terms:** `src/legal/` has drafts in English and Portuguese. They aren't legal advice: a lawyer should
  read them, and the `[marked]` parts need filling in. Then take away the "draft" notes.
- **A public address for them:** both stores ask for a link to the privacy policy, so these pages also have to go on the web
  page (nothing copies them there yet, as they're still drafts).
- **A way to reach you:** fill in `CONTACT_EMAIL` in `src/me.js`. The stores also ask for it on the listing.
- **The app's icon:** `assets/logo.svg` is a placeholder (a star block in the app's colours). To change it, replace the
  picture and run `generate-icons.mjs`.
- **The reports:** Apple asks that reported content is dealt with within 24 hours, and the draft terms promise to try. See
  "Community moderation" in `CLAUDE.md`.
- **Store accounts:** Google Play ($25 once; new personal accounts must run a closed test with testers before release) and
  the Apple Developer Program ($99 a year).
