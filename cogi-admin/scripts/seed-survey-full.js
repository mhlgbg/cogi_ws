"use strict";

const { createStrapi } = require("@strapi/strapi");

const tenantId = process.env.TENANT_ID || "3";

(async () => {
  const strapi = await createStrapi().load();

  console.log("🚀 START SEED SURVEY");

  try {
    // TEST thử 1 insert đơn giản trước
    const test = await strapi.entityService.create(
      "api::survey-template.survey-template",
      {
        data: {
          name: "TEST TEMPLATE",
          code: "TEST_TEMPLATE",
          type: "TEACHING_EVALUATION",
          isActive: true,
          tenant: tenantId,
        },
      }
    );

    console.log("✅ Insert OK:", test.id);

    // 👉 sau khi OK thì paste toàn bộ logic seed FULL của bạn vào đây

  } catch (err) {
    console.error("❌ ERROR:", err);
  }

  await strapi.destroy();
  process.exit(0);
})();