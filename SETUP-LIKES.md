# Making the like / view / share counters work

Three things must be true. Check them in order — step 2 is the one
that is usually missing.

## 1. The Functions actually deploy

Open your blog repo on GitHub:
`.github/workflows/azure-static-web-apps-<something>.yml`

Find the build job and confirm:

```yaml
app_location: "/"
api_location: "api"      # <-- if this is "" the API never deploys
output_location: ""
```

If `api_location` is empty, edit it to `"api"`, commit, and let the
Action re-run. This happens whenever the Static Web App was created
before the `api/` folder existed.

## 2. Create a free-tier Cosmos DB account and wire the connection string

This uses Azure Cosmos DB's **Table API** instead of a plain Storage
Account. Cosmos DB gives one account per subscription a lifetime-free
allowance of 1000 RU/s and 25 GB storage — for three tables holding a
slug and a number each, this project will realistically cost **$0,
indefinitely**. The code is unaffected either way: the same
`@azure/data-tables` SDK talks to both, so this is purely a "which
account do I point the connection string at" choice.

1. Azure Portal → **Create a resource** → search **Azure Cosmos DB** →
   **Create** → choose the **Azure Cosmos DB for Table** option (NOT
   NoSQL/MongoDB/Cassandra/Gremlin — those are different APIs with a
   different connection string shape that this code doesn't speak).
2. On the **Basics** tab:
   - Same resource group as the blog (`Niluniverse_group`)
   - Account name: e.g. `niluniverseblogdb` (lowercase, no dashes)
   - Capacity mode: **Provisioned throughput** (the free tier discount
     is only available in this mode, not Serverless)
   - Tick **Apply Free Tier Discount** — if it's greyed out, this
     subscription already has a free-tier Cosmos DB account elsewhere;
     you can still proceed, it just won't be $0 (though at this scale
     it'll still be pennies)
3. **Review + create** → **Create**. Takes a few minutes to provision.
4. Once it's up, open the account → left-hand menu → **Keys** (Table
   API accounts show ready-made connection strings here, the same
   shape a Storage Account gives you — the exact blade label can read
   "Keys" or "Connection String" depending on your portal version) →
   copy the **Primary Connection String**.
5. Azure Portal → your **NiluniverseBlog** Static Web App →
   **Configuration** → **Application settings** → **+ Add**
   - Name:  `STORAGE_CONNECTION`
   - Value: *(paste the connection string from step 4)*
6. Click **Save**. The app restarts automatically.

Three tables — `likes`, `views` and `shares` — are each created on
first use. Nothing to set up by hand for any of them.

(If you'd rather use a plain Storage Account instead — e.g. you've
already used up your subscription's one free-tier Cosmos DB slot on
something else and would rather pay the fractions-of-a-cent Storage
rate than fuss with Cosmos DB — that still works unchanged: create a
Storage account, copy its connection string from **Access keys**
instead, and set `STORAGE_CONNECTION` to that. Same code, same steps
3–6 above, just a different account type in step 1–4.)

## 3. Verify

Open in a browser:

    https://niluniverse.com/api/health

Expected when everything is correct:

```json
{ "ok": true, "storageConfigured": true, "tables": ["likes", "views", "shares"] }
```

Other responses and what they mean:

| Response | Meaning | Fix |
|---|---|---|
| `404` page not found | Functions did not deploy | Step 1 — `api_location: "api"` |
| `"storageConfigured": false` | App setting missing | Step 2 |
| `"ok": false` with an error | Connection string wrong/expired | Re-copy from the Keys blade |

Then check a real article count for each counter:

    https://niluniverse.com/api/likes?slug=outbox-pattern
    https://niluniverse.com/api/views?slug=outbox-pattern
    https://niluniverse.com/api/shares?slug=outbox-pattern

each should return something like `{"slug":"outbox-pattern","count":0}`.

You can also fetch every article's count at once by leaving `slug` off,
e.g. `https://niluniverse.com/api/likes` returns an array of
`{slug, count}` for every article that has at least one like.

## How each counter behaves

- **Likes** — a reader can like an article once per browser. The
  article page's like button toggles between liked/unliked; the choice
  is remembered in `localStorage` so refreshing or coming back later
  shows the same state. Unliking sends a decrement. The blog home page
  shows the current like count on every post card, read-only.
- **Views** — incremented once per browser *session* the first time an
  article page loads (tracked in `sessionStorage`), so refreshing the
  page or re-reading it in the same tab session doesn't inflate the
  count. A new tab or a new day generally counts as a new session.
- **Shares** — incremented whenever a reader clicks one of the share
  buttons on an article (LinkedIn, X, email, or copy-link). This counts
  share *intent* (the button was clicked), not confirmation that the
  post was actually published or read by anyone downstream.

All three are deliberately hidden (blank) on a page when the API is
unreachable, so a broken backend never shows a dead "0" to readers.
Counts are enforced client-side only (localStorage/sessionStorage) —
fine for a personal blog; a determined visitor could inflate any of
them by clearing storage or using a different browser.

## Reading the counts later

Azure Portal → your Cosmos DB account → **Data Explorer** → pick
`likes`, `views` or `shares`. One row (item) per article in each
table, `RowKey` is the slug, `PartitionKey` is `article`.
(If you went the plain Storage Account route instead: Storage account
→ **Storage browser** → **Tables** → same table names, same shape.)

## Is it safe with a public repo?

Yes. `STORAGE_CONNECTION` is an **Azure application setting**, not a
file in your repo. Azure injects it as an environment variable into the
Functions host at runtime, which is why the code only ever refers to
`process.env.STORAGE_CONNECTION`. The secret is never committed, never
part of the build output, and never reachable by a visitor.

What you must NOT do:
- do not commit `api/local.settings.json` (it holds the real string
  when developing locally) — it is in `.gitignore`; only
  `api/local.settings.json.example` (a placeholder) is committed
- do not paste the connection string into any `.html`, `.js` or
  `staticwebapp.config.json` file
- do not put it in the GitHub workflow yml

If a key is ever exposed: Cosmos DB account → **Keys** →
**Regenerate Primary Key**, then paste the new connection string into
the Static Web App application settings. Old key stops working
immediately. (Storage Account route: same idea, under **Access keys**
→ **Rotate key1**.)

### About removing the secret entirely (Managed Identity)

For an Azure Storage Account, you can eventually drop the connection
string and authenticate the Functions host via a system-assigned
managed identity instead (Storage Account → IAM → assign **Storage
Table Data Contributor**, then use `DefaultAzureCredential` from
`@azure/identity`). That upgrade is NOT reliably available yet for
Cosmos DB's Table API specifically — its Azure AD / RBAC data-plane
support has lagged behind its other APIs, so for now the connection
string is the supported way in for Table API and there's no action
needed here. If you ever move this off Cosmos DB's Table API onto a
plain Storage Account, that's the point where the managed-identity
upgrade becomes worth revisiting.

## Seeding starting counts for an article

`api/scripts/seed-counters.js` writes starting values straight into the
`likes`, `views` and `shares` tables. It is not a Function (no
`function.json`), so it never deploys; you run it from your own machine.

```powershell
cd api
npm install
$env:STORAGE_CONNECTION="<Primary Connection String from the Cosmos DB Keys blade>"
node scripts/seed-counters.js --slug midnight-sale-war-room --likes 25 --views 400 --shares 12 --dry-run
node scripts/seed-counters.js --slug midnight-sale-war-room --likes 25 --views 400 --shares 12
```

Using Command Prompt (cmd) instead of PowerShell? Set the variable like
this, with the quotes around the whole `NAME=value` part:

```cmd
set "STORAGE_CONNECTION=<Primary Connection String>"
```

- Rows that already exist are left alone, so real counts are never wiped.
  Add `--force` to overwrite them.
- `--dry-run` prints what would change without writing.
- You can pass any one of `--likes`, `--views`, `--shares` on its own.
- Close the terminal afterwards (or run `Remove-Item Env:STORAGE_CONNECTION` in PowerShell, `set STORAGE_CONNECTION=` in cmd)
  so the connection string does not linger in your shell.
