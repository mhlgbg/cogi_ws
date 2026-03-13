export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'http://admin.alphavni.com', // Strapi admin qua IIS
        'https://admin.alphavni.com', // Strapi admin qua IIS
        'http://one.alphavni.com', // nếu frontend đang chạy port này
        'https://one.alphavni.com', // nếu frontend đang chạy port này
        'http://alphavni.com',      // nếu có domain không kèm port
        'https://alphavni.com',     // nếu sau này bật https
        'http://localhost:5173',   // frontend local
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: '*',
      credentials: true,
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '25mb',
      jsonLimit: '25mb',
      textLimit: '25mb',
      formidable: {
        maxFileSize: 20 * 1024 * 1024,
        multiples: false,
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
