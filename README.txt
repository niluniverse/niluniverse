www.niluniverse.com — BLOG SUBDOMAIN
=====================================
Now uses the SAME design system as niluniverse.com:
 - Same fonts (IBM Plex Sans/Mono + Fraunces)
 - Same 4 themes (LinkedIn / Amber / Slate / Paper) with the switcher
   in the header. Theme choice is remembered in localStorage.
 - Same nav bar (links back to the main site), same footer, same
   colour tokens, same radii and shadows.
 - assets/site.css holds the shared design system.

FILES
  index.html                     blog home (tiles/list toggle, like counts)
  outbox-pattern.html            article
  observability-detective.html   article
  deterministic-ai-systems.html  article
  assets/site.css                shared design system (themes + chrome)
  assets/engagement.js           progress bar, sticky rail, like/share,
                                 highlight-to-share, back link, end CTA
  api/                           Azure Functions: /api/likes, /api/subscribe
  favicon.svg, favicon-32/180    same icons as main site
  staticwebapp.config.json

ADDING A NEW ARTICLE
 1. Copy an existing article as a template — it already has the
    <link rel="stylesheet" href="assets/site.css">, the nav header,
    the footer and the theme script.
 2. Before </body> keep:
      <script src="assets/engagement.js" data-accent="var(--accent)" defer></script>
 3. Add a card to index.html with data-slug="your-file-name".

HEART COUNTER
 See SETUP-LIKES.md for the full 3-step setup and a /api/health
 endpoint to diagnose it. Short version:
   1. workflow yml must have  api_location: "api"
   2. create a Storage Account, add app setting
        STORAGE_CONNECTION = <connection string>
   3. check https://www.niluniverse.com/api/health

 The counter hides itself if the API is unreachable, so readers never
 see a dead zero.

 The email subscribe form has been REMOVED. If you want a newsletter
 later, use a hosted service (Buttondown / Kit) which handles sending,
 unsubscribes and compliance.
