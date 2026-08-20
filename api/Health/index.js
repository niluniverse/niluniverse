// GET /api/health -> { ok, storageConfigured, tables }
// Diagnostic endpoint — see SETUP-LIKES.md.

const { getTableClient, ALLOWED_TABLES } = require("../shared/tableHelper");

module.exports = async function (context, req) {
    const storageConfigured = !!process.env.STORAGE_CONNECTION;
    const result = { ok: false, storageConfigured, tables: ALLOWED_TABLES };

    if (!storageConfigured) {
          context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: result };
          return;
    }

    try {
          // Touch one table to confirm the connection string actually works end to end.
      const client = getTableClient("likes");
          await client.createTable().catch(function (e) {
                  if (e.statusCode !== 409) throw e;
          });
          result.ok = true;
          context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: result };
    } catch (e) {
          result.error = e.message;
          context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: result };
    }
};
