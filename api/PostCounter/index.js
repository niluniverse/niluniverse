// POST /api/views  {slug}                -> +1 view,  returns {slug,count}
// POST /api/shares {slug, channel?}       -> +1 share, returns {slug,count}
// POST /api/likes  {slug, liked}          -> +1 if liked:true, -1 if liked:false, returns {slug,count}

const { incrementCount, ALLOWED_TABLES } = require("../shared/tableHelper");

module.exports = async function (context, req) {
    const resource = (context.bindingData.resource || "").toLowerCase();

    if (!ALLOWED_TABLES.includes(resource)) {
          context.res = { status: 404, headers: { "Content-Type": "application/json" }, body: { error: `Unknown counter "${resource}".` } };
          return;
    }

    const body = req.body || {};
    const slug = body.slug;

    if (!slug || typeof slug !== "string" || slug.length > 200) {
          context.res = { status: 400, headers: { "Content-Type": "application/json" }, body: { error: 'A valid "slug" is required.' } };
          return;
    }

    // views/shares always count up. "likes" is a toggle: liked:true = +1, liked:false = -1.
    let delta = 1;
    if (resource === "likes" && body.liked === false) delta = -1;

    try {
          const count = await incrementCount(resource, slug, delta);
          context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: { slug, count } };
    } catch (e) {
          context.log.error(e);
          context.res = { status: e.statusCode || 500, headers: { "Content-Type": "application/json" }, body: { error: e.message } };
    }
};
