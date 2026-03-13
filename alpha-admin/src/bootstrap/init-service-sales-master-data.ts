const CUSTOMER_UID = 'api::customer.customer';
const SERVICE_CATEGORY_UID = 'api::service-category.service-category';
const SERVICE_ITEM_UID = 'api::service-item.service-item';

const DEFAULT_GUEST_CODE = 'GUEST';

const PHOTO_PRINT_CATEGORY = {
  code: 'PHOTO_PRINT',
  name: 'Photo / In ấn',
  description: 'Dịch vụ photo, in ấn, scan, ép plastic, đóng quyển',
  isActive: true,
  sortOrder: 10,
};

const PHOTO_PRINT_ITEMS = [
  { code: 'PHOTO_A4_BW', name: 'Photo A4 đen trắng', unit: 'trang', defaultPrice: 1000, sortOrder: 10 },
  { code: 'PHOTO_A4_COLOR', name: 'Photo A4 màu', unit: 'trang', defaultPrice: 3000, sortOrder: 20 },
  { code: 'PRINT_A4_BW', name: 'In A4 đen trắng', unit: 'trang', defaultPrice: 1200, sortOrder: 30 },
  { code: 'PRINT_A4_COLOR', name: 'In A4 màu', unit: 'trang', defaultPrice: 3500, sortOrder: 40 },
  { code: 'SCAN_A4', name: 'Scan A4', unit: 'trang', defaultPrice: 1000, sortOrder: 50 },
  { code: 'BINDING', name: 'Đóng quyển', unit: 'quyển', defaultPrice: 12000, sortOrder: 60 },
  { code: 'LAMINATE', name: 'Ép plastic', unit: 'tờ', defaultPrice: 5000, sortOrder: 70 },
];

async function ensureDefaultRetailGuest(strapi: any) {
  let guest = await strapi.db.query(CUSTOMER_UID).findOne({
    where: { code: DEFAULT_GUEST_CODE },
    orderBy: [{ id: 'asc' }],
  });

  if (!guest) {
    guest = await strapi.db.query(CUSTOMER_UID).create({
      data: {
        code: DEFAULT_GUEST_CODE,
        name: 'Khách lẻ',
        customerType: 'RETAIL',
        allowDebt: false,
        isDefaultRetailGuest: true,
        isActive: true,
      },
    });

    strapi.log.info('[bootstrap] Created default retail guest customer (code=GUEST)');
  } else {
    const needsUpdate =
      guest.name !== 'Khách lẻ'
      || guest.customerType !== 'RETAIL'
      || guest.allowDebt !== false
      || guest.isDefaultRetailGuest !== true
      || guest.isActive !== true;

    if (needsUpdate) {
      await strapi.db.query(CUSTOMER_UID).update({
        where: { id: guest.id },
        data: {
          name: 'Khách lẻ',
          customerType: 'RETAIL',
          allowDebt: false,
          isDefaultRetailGuest: true,
          isActive: true,
        },
      });

      strapi.log.info('[bootstrap] Normalized default retail guest customer (code=GUEST)');
    }
  }

  const duplicateDefaults = await strapi.db.query(CUSTOMER_UID).findMany({
    where: {
      isDefaultRetailGuest: true,
      id: { $ne: guest.id },
    },
    orderBy: [{ id: 'asc' }],
  });

  if (Array.isArray(duplicateDefaults) && duplicateDefaults.length > 0) {
    for (const row of duplicateDefaults) {
      await strapi.db.query(CUSTOMER_UID).update({
        where: { id: row.id },
        data: { isDefaultRetailGuest: false },
      });
    }

    strapi.log.warn(
      `[bootstrap] Found ${duplicateDefaults.length} duplicated default retail guest customer(s); kept code=GUEST and disabled others`
    );
  }
}

async function ensurePhotoPrintCategory(strapi: any) {
  const existing = await strapi.db.query(SERVICE_CATEGORY_UID).findOne({
    where: { code: PHOTO_PRINT_CATEGORY.code },
  });

  if (existing) return existing;

  const created = await strapi.db.query(SERVICE_CATEGORY_UID).create({
    data: PHOTO_PRINT_CATEGORY,
  });

  strapi.log.info('[bootstrap] Created service category PHOTO_PRINT');
  return created;
}

async function ensurePhotoPrintItems(strapi: any, categoryId: number) {
  for (const item of PHOTO_PRINT_ITEMS) {
    const existing = await strapi.db.query(SERVICE_ITEM_UID).findOne({
      where: { code: item.code },
    });

    if (existing) continue;

    await strapi.db.query(SERVICE_ITEM_UID).create({
      data: {
        ...item,
        isActive: true,
        category: categoryId,
      },
    });
  }

  strapi.log.info('[bootstrap] Ensured default PHOTO_PRINT service items');
}

export async function initServiceSalesMasterData(strapi: any) {
  await ensureDefaultRetailGuest(strapi);
  const category = await ensurePhotoPrintCategory(strapi);
  await ensurePhotoPrintItems(strapi, category.id);
}
