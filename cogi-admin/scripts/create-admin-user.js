#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

function getArgValue(name) {
  const prefix = `--${name}=`;
  const exactIndex = process.argv.findIndex((item) => item === `--${name}`);
  if (exactIndex >= 0) return process.argv[exactIndex + 1];

  const inline = process.argv.find((item) => item.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  return undefined;
}

function requireValue(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function main() {
  try {
    const email = requireValue(
      getArgValue('email') || process.env.STRAPI_ADMIN_EMAIL,
      'email (--email or STRAPI_ADMIN_EMAIL)'
    );

    const password = requireValue(
      getArgValue('password') || process.env.STRAPI_ADMIN_PASSWORD,
      'password (--password or STRAPI_ADMIN_PASSWORD)'
    );

    const firstname = String(
      getArgValue('firstname')
      || process.env.STRAPI_ADMIN_FIRSTNAME
      || 'Admin'
    ).trim();

    const lastname = String(
      getArgValue('lastname')
      || process.env.STRAPI_ADMIN_LASTNAME
      || 'User'
    ).trim();

    const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    const args = [
      'strapi',
      'admin:create-user',
      '--email',
      email,
      '--password',
      password,
      '--firstname',
      firstname,
      '--lastname',
      lastname,
    ];

    console.log('[create-admin-user] Running:', `${npxCommand} ${args.join(' ')}`);

    const result = spawnSync(npxCommand, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    });

    if (result.error) {
      throw result.error;
    }

    process.exit(result.status ?? 0);
  } catch (error) {
    console.error('[create-admin-user] Failed:', error?.message || error);
    console.error('Usage:');
    console.error('  node ./scripts/create-admin-user.js --email admin@example.com --password "StrongPass123!" --firstname Admin --lastname Root');
    console.error('  or set STRAPI_ADMIN_EMAIL / STRAPI_ADMIN_PASSWORD / STRAPI_ADMIN_FIRSTNAME / STRAPI_ADMIN_LASTNAME');
    process.exit(1);
  }
}

main();
