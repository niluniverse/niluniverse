// Shared Table API helper used by every counter endpoint
// (likes, views, shares). One table per counter, same simple shape:
//   PartitionKey: "article"
//   RowKey:       <slug>
//   count:        number
//
// Talks to whatever STORAGE_CONNECTION points at via the Table API —
// this project targets an Azure Cosmos DB account (Table API) so the
// whole thing runs on Cosmos DB's free tier (1000 RU/s / 25 GB,
// forever, no cost). A plain Azure Storage Account connection string
// also works unchanged if you ever want to switch — same SDK, same
// wire protocol, just a different connection string.
//
// Neither backend has atomic increment, so incrementCount() does a
// read -> modify -> write with an ETag, and retries a few times if two
// requests race each other. Fine for a personal blog's traffic.

const { TableClient } = require("@azure/data-tables");

const ALLOWED_TABLES = ["likes", "views", "shares"];

function assertTable(name) {
    if (!ALLOWED_TABLES.includes(name)) {
          const err = new Error(`Unknown counter "${name}". Must be one of: ${ALLOWED_TABLES.join(", ")}`);
          err.statusCode = 400;
          throw err;
    }
}

function getTableClient(tableName) {
    assertTable(tableName);
    const conn = process.env.STORAGE_CONNECTION;
    if (!conn) {
          const err = new Error('STORAGE_CONNECTION app setting is not configured.');
          err.statusCode = 500;
          throw err;
    }
    return TableClient.fromConnectionString(conn, tableName, { allowInsecureConnection: true });
}

async function ensureTable(client) {
    try {
          await client.createTable();
    } catch (e) {
          // 409 = table already exists — that's fine, everything else is real.
      if (e.statusCode !== 409) throw e;
    }
}

async function getCount(tableName, slug) {
    const client = getTableClient(tableName);
    await ensureTable(client);
    try {
          const entity = await client.getEntity("article", slug);
          return Number(entity.count) || 0;
    } catch (e) {
          if (e.statusCode === 404) return 0;
          throw e;
    }
}

async function getAllCounts(tableName) {
    const client = getTableClient(tableName);
    await ensureTable(client);
    const results = [];
    for await (const entity of client.listEntities({ queryOptions: { filter: "PartitionKey eq 'article'" } })) {
          results.push({ slug: entity.rowKey, count: Number(entity.count) || 0 });
    }
    return results;
}

async function incrementCount(tableName, slug, delta) {
    const client = getTableClient(tableName);
    await ensureTable(client);
    const MAX_ATTEMPTS = 6;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        let current = 0;
        let etag;
        try {
                const entity = await client.getEntity("article", slug);
                current = Number(entity.count) || 0;
                etag = entity.etag;
        } catch (e) {
                if (e.statusCode !== 404) throw e;
        }

      const next = Math.max(0, current + delta);

      try {
              if (etag) {
                        await client.updateEntity({ partitionKey: "article", rowKey: slug, count: next }, "Merge", { etag });
              } else {
                        await client.createEntity({ partitionKey: "article", rowKey: slug, count: next });
              }
              return next;
      } catch (e) {
              // 412 = someone else updated it between our read and write (ETag mismatch).
          // 409 = it now exists when we thought it didn't. Either way: retry with a fresh read.
          if (e.statusCode === 412 || e.statusCode === 409) continue;
              throw e;
      }
  }

  const err = new Error(`Could not update counter "${tableName}/${slug}" after ${MAX_ATTEMPTS} attempts (concurrent writes).`);
    err.statusCode = 503;
    throw err;
}

module.exports = { ALLOWED_TABLES, getTableClient, getCount, getAllCounts, incrementCount };
