/**
 * Tenant lifecycle hooks
 *
 * afterCreate – automatically provision TenantFeature records for every
 * existing Feature when a new tenant is created.
 *
 * The tenant-feature `beforeCreate` lifecycle will auto-generate the label,
 * so we do not need to build it here.
 */

const FEATURE_UID = 'api::feature.feature' as const;
const TENANT_FEATURE_UID = 'api::tenant-feature.tenant-feature' as const;

async function provisionTenantFeatures(tenantId: number, tenantLabel: string): Promise<void> {
  const features = await strapi.db.query(FEATURE_UID).findMany({
    select: ['id', 'key'],
  });

  if (!features || features.length === 0) {
    strapi.log.debug('[tenant lifecycle] No features found – skipping TenantFeature provisioning.');
    return;
  }

  for (const feature of features) {
    const existing = await strapi.db.query(TENANT_FEATURE_UID).findOne({
      where: { tenant: tenantId, feature: feature.id },
      select: ['id'],
    });

    if (existing) {
      strapi.log.debug(
        `[tenant lifecycle] Skip existing TenantFeature: ${tenantLabel} -> ${feature.key}`,
      );
      continue;
    }

    await strapi.db.query(TENANT_FEATURE_UID).create({
      data: {
        tenant: tenantId,
        feature: feature.id,
        isEnabled: true,
      },
    });

    strapi.log.info(
      `[tenant lifecycle] Created TenantFeature: ${tenantLabel} -> ${feature.key}`,
    );
  }
}

export default {
  async afterCreate(event: any) {
    const { result } = event;

    if (!result?.id) {
      strapi.log.warn('[tenant lifecycle] afterCreate: result has no id, skipping provisioning.');
      return;
    }

    const tenantLabel = result.name || result.code || `Tenant#${result.id}`;

    strapi.log.info(
      `[tenant lifecycle] New tenant created: ${tenantLabel} – provisioning TenantFeature records…`,
    );

    try {
      await provisionTenantFeatures(result.id, tenantLabel);
    } catch (err: any) {
      // Non-fatal: log and continue so the tenant record is not rolled back.
      strapi.log.error(
        `[tenant lifecycle] Failed to provision TenantFeature for ${tenantLabel}: ${err?.message ?? err}`,
      );
    }
  },
};
