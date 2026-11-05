const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const Koa = require('koa');

const middlewareFactory = require('../dist/src/middlewares/frontend-app-shell.js').default;

const tenantRecord = {
  id: 11,
  code: 'cva',
  name: 'Chu Van An',
  shortName: 'CVA',
  siteTitle: 'CVA Clubs',
  defaultPageTitle: 'Cong thong tin CLB CVA',
  titleSuffix: 'CVA',
  siteDescription: 'He thong thong tin da tenant.',
  defaultMetaImage: { url: '/uploads/tenant-default.png' },
  logo: { url: '/uploads/tenant-logo.png' },
  siteLogo: null,
};

const pagesBySlug = {
  'gioi-thieu': {
    id: 101,
    slug: 'gioi-thieu',
    title: 'Gioi thieu CLB',
    seoTitle: 'Gioi thieu ve cac CLB the thao nang khieu',
    seoDescription: 'Thong tin tong quan ve cac CLB.',
    seoImage: { url: '/uploads/page-og.png' },
  },
  'khong-co-seo-title': {
    id: 102,
    slug: 'khong-co-seo-title',
    title: 'Trang chi co title thuong',
    seoTitle: '',
    seoDescription: 'Mo ta tu page.',
    seoImage: { url: '/uploads/page-og-2.png' },
  },
  'khong-co-seo-image': {
    id: 103,
    slug: 'khong-co-seo-image',
    title: 'Trang khong co seo image',
    seoTitle: 'Trang khong co seo image',
    seoDescription: 'Page khong co anh seo.',
    seoImage: null,
  },
};

const campaignsBySlug = {
  'english-level-check': {
    id: 201,
    slug: 'english-level-check',
    name: 'English Level Check',
    publicTitle: 'Bai danh gia trinh do tieng Anh',
    publicDescription: 'Danh gia dau vao tieng Anh cho hoc vien.',
    description: 'Mo ta chien dich.',
    status: 'active',
  },
};

function buildFakeStrapi(overrides = {}) {
  const tenant = overrides.tenant || tenantRecord;
  const pages = overrides.pages || pagesBySlug;
  const campaigns = overrides.campaigns || campaignsBySlug;

  return {
    db: {
      query(uid) {
        return {
          async findOne(options = {}) {
            if (uid === 'api::tenant.tenant') {
              return tenant;
            }

            if (uid === 'api::public-page.public-page') {
              const slug = options?.where?.$and?.[0]?.$and?.[0]?.slug || '';
              return pages[slug] || null;
            }

            if (uid === 'api::assessment-campaign.assessment-campaign') {
              const slug = options?.where?.$and?.[0]?.slug?.$eq || options?.where?.slug?.$eq || '';
              return campaigns[slug] || null;
            }

            return null;
          },
        };
      },
    },
    log: {
      warn() {},
    },
  };
}

async function createTempDist() {
  const distRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'frontend-app-shell-'));
  await fs.writeFile(
    path.join(distRoot, 'index.html'),
    [
      '<!doctype html>',
      '<html lang="vi">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <title>COGI Platform</title>',
      '  </head>',
      '  <body>',
      '    <div id="root"></div>',
      '  </body>',
      '</html>',
    ].join('\n'),
    'utf8',
  );
  return distRoot;
}

async function withServer(strapi, distRoot, callback) {
  const originalDistPath = process.env.FRONTEND_DIST_PATH;
  process.env.FRONTEND_DIST_PATH = distRoot;

  const app = new Koa();
  const middleware = middlewareFactory({}, { strapi });
  app.use(async (ctx, next) => {
    ctx.state.tenantId = 11;
    ctx.state.tenant = { id: 11, code: 'cva' };
    await middleware(ctx, next);
  });

  const server = http.createServer(app.callback());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    await callback(address.port);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (originalDistPath === undefined) {
      delete process.env.FRONTEND_DIST_PATH;
    } else {
      process.env.FRONTEND_DIST_PATH = originalDistPath;
    }
  }
}

async function requestHtml(port, requestPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method: 'GET',
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

test('injects public page metadata for tenant-domain page URLs', async () => {
  const strapi = buildFakeStrapi();
  const distRoot = await createTempDist();

  await withServer(strapi, distRoot, async (port) => {
    const response = await requestHtml(port, '/page/gioi-thieu', { Host: 'clubs.cva-edu.com' });
    assert.equal(response.status, 200);
    assert.match(response.body, /<title>Gioi thieu ve cac CLB the thao nang khieu \| CVA<\/title>/);
    assert.match(response.body, /<meta property="og:description" content="Thong tin tong quan ve cac CLB\." \/>/);
    assert.match(response.body, /<meta property="og:image" content="https:\/\/clubs\.cva-edu\.com\/uploads\/page-og\.png" \/>/);
    assert.match(response.body, /<meta property="og:url" content="https:\/\/clubs\.cva-edu\.com\/page\/gioi-thieu" \/>/);
  });
});

test('injects public page metadata for tenant-path page URLs', async () => {
  const strapi = buildFakeStrapi();
  const distRoot = await createTempDist();

  await withServer(strapi, distRoot, async (port) => {
    const response = await requestHtml(port, '/t/cva/page/khong-co-seo-title', { Host: '127.0.0.1:19000' });
    assert.equal(response.status, 200);
    assert.match(response.body, /<title>Trang chi co title thuong \| CVA<\/title>/);
    assert.match(response.body, /<meta property="og:url" content="http:\/\/127\.0\.0\.1:19000\/t\/cva\/page\/khong-co-seo-title" \/>/);
  });
});

test('falls back to tenant metadata when page fields are missing', async () => {
  const strapi = buildFakeStrapi();
  const distRoot = await createTempDist();

  await withServer(strapi, distRoot, async (port) => {
    const response = await requestHtml(port, '/page/khong-co-seo-image', { Host: 'clubs.cva-edu.com' });
    assert.equal(response.status, 200);
    assert.match(response.body, /<meta property="og:image" content="https:\/\/clubs\.cva-edu\.com\/uploads\/tenant-default\.png" \/>/);
  });
});

test('falls back from tenant defaultMetaImage to tenant logo', async () => {
  const strapi = buildFakeStrapi({
    tenant: {
      ...tenantRecord,
      defaultMetaImage: null,
    },
  });
  const distRoot = await createTempDist();

  await withServer(strapi, distRoot, async (port) => {
    const response = await requestHtml(port, '/page/khong-co-seo-image', { Host: 'clubs.cva-edu.com' });
    assert.equal(response.status, 200);
    assert.match(response.body, /<meta property="og:image" content="https:\/\/clubs\.cva-edu\.com\/uploads\/tenant-logo\.png" \/>/);
  });
});

test('uses tenant fallback metadata on non public-page routes', async () => {
  const strapi = buildFakeStrapi();
  const distRoot = await createTempDist();

  await withServer(strapi, distRoot, async (port) => {
    const response = await requestHtml(port, '/journal', { Host: 'clubs.cva-edu.com' });
    assert.equal(response.status, 200);
    assert.match(response.body, /<title>Cong thong tin CLB CVA<\/title>/);
    assert.match(response.body, /<meta name="description" content="He thong thong tin da tenant\." \/>/);
  });
});

test('injects assessment campaign metadata for tenant-domain campaign URLs', async () => {
  const strapi = buildFakeStrapi();
  const distRoot = await createTempDist();

  await withServer(strapi, distRoot, async (port) => {
    const response = await requestHtml(port, '/campaign/english-level-check', { Host: 'vitaminfun.net' });
    assert.equal(response.status, 200);
    assert.match(response.body, /<title>Bai danh gia trinh do tieng Anh \/\/ CVA|<title>Bai danh gia trinh do tieng Anh \| CVA<\/title>/);
    assert.match(response.body, /<meta name="description" content="Danh gia dau vao tieng Anh cho hoc vien\." \/>/);
    assert.match(response.body, /<meta property="og:url" content="https:\/\/vitaminfun\.net\/campaign\/english-level-check" \/>/);
    assert.match(response.body, /<meta property="og:image" content="https:\/\/vitaminfun\.net\/uploads\/tenant-default\.png" \/>/);
  });
});
