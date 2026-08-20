# Making the heart counter work

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

## 2. Create storage and wire the connection string

1. Azure Portal → **Create a resource** → **Storage account**
   - Same resource group as the blog (`Niluniverse_group`)
   - Performance: Standard, Redundancy: **LRS** (cheapest)
   - Name: e.g. `niluniverseblogstore` (lowercase, no dashes)
2. Once created → **Access keys** → **Show** → copy
   **Connection string** under key1
3. Azure Portal → your **NiluniverseBlog** Static Web App →
   **Configuration** → **Application settings** → **+ Add**
   - Name:  `STORAGE_CONNECTION`
   - Value: *(paste the connection string)*
4. Click **Save**. The app restarts automatically.

The `likes` table is created on first use — nothing to set up by hand.

## 3. Verify

Open in a browser:

    https://blog.niluniverse.com/api/health

Expected when everything is correct:

```json
{ "ok": true, "storageConfigured": true, "table": "likes" }
```

Other responses and what they mean:

| Response | Meaning | Fix |
|---|---|---|
| `404` page not found | Functions did not deploy | Step 1 — `api_location: "api"` |
| `"storageConfigured": false` | App setting missing | Step 2 |
| `"ok": false` with an error | Connection string wrong/expired | Re-copy from Access keys |

Then check a real article count:

    https://blog.niluniverse.com/api/likes?slug=outbox-pattern

should return `{"slug":"outbox-pattern","count":0}`.

## Reading the counts later

Azure Portal → Storage account → **Storage browser** → **Tables** →
`likes`. One row per article, `RowKey` is the slug.

## Note on behaviour

The counter is deliberately hidden (blank) when the API is
unreachable, so a broken backend never shows a dead "0" to readers.
One like per browser is enforced client-side via localStorage — fine
for a personal blog; a determined visitor could inflate it.


## Is it safe with a public repo?

Yes. `STORAGE_CONNECTION` is an **Azure application setting**, not a
file in your repo. Azure injects it as an environment variable into the
Functions host at runtime, which is why the code only ever refers to
`process.env.STORAGE_CONNECTION`. The secret is never committed, never
part of the build output, and never reachable by a visitor.

What you must NOT do:
- do not commit `api/local.settings.json` (it holds the real string
  when developing locally) — it is in `.gitignore`
- do not paste the connection string into any `.html`, `.js` or
  `staticwebapp.config.json` file
- do not put it in the GitHub workflow yml

If a key is ever exposed: Storage account → **Access keys** →
**Rotate key1**, then paste the new connection string into the
Static Web App application settings. Old key stops working immediately.

### Better still: no secret at all (Managed Identity)

Once things are running you can remove the connection string entirely:

1. Static Web App → **Identity** → System assigned → **On**
2. Storage account → **Access control (IAM)** → Add role assignment →
   **Storage Table Data Contributor** → assign to that managed identity
3. Replace the app setting with `STORAGE_ACCOUNT_NAME = <name>` and use
   `DefaultAzureCredential` from `@azure/identity` instead of the
   connection string

That is the pattern to prefer for anything client-facing — no secret
exists to leak or rotate.
