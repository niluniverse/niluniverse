// GET /api/likes|views|shares            -> [{slug,count}, ...]  (all articles)
// GET /api/likes|views|shares?slug=X      -> {slug,count}         (one article)

const { getCount, getAllCounts, ALLOWED_TABLES } = require("../shared/tableHelper");

module.exports = async function (context, req) {
    const resource = (context.bindingData.resource || "").toLowerCase();

    if (!ALLOWED_TABLES.includes(resource)) {
          context.res = { status: 404, headers: { "Content-Type": "application/json" }, body: { error: `Unknown counter "${resource}".` } };
          return;
    }

    const slug = req.query.slug;

    try {
          if (slug) {
                  const count = await getCount(resource, slug);
                  context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: { slug, count } };
          } else {
                  const all = await getAllCounts(resource);
                  context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: all };
          }
    } catch (e) {
          context.log.error(e);
          context.res = { status: e.statusCode || 500, headers: { "Content-Type": "application/json" }, body: { error: e.message } };
    }
};
