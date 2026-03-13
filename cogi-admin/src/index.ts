// import type { Core } from '@strapi/strapi';
import { initServiceSalesMasterData } from './bootstrap/init-service-sales-master-data';

const WINDOWS_TEMP_UNLINK_EPERM =
  process.platform === 'win32'
  && !global.__IGNORE_WINDOWS_TEMP_UNLINK_EPERM__;

if (WINDOWS_TEMP_UNLINK_EPERM) {
  global.__IGNORE_WINDOWS_TEMP_UNLINK_EPERM__ = true;

  process.on('unhandledRejection', (reason) => {
    const error = reason as NodeJS.ErrnoException | undefined;
    const message = String(error?.message || '');
    const isWindowsTempUnlinkEperm =
      error?.code === 'EPERM'
      && error?.syscall === 'unlink'
      && message.includes('operation not permitted, unlink')
      && String(error?.path || '').toLowerCase().includes('appdata\\local\\temp');

    if (isWindowsTempUnlinkEperm) {
      console.warn('[upload] Ignore Windows temp unlink EPERM after upload cleanup:', error?.path);
      return;
    }

    throw reason;
  });
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi } /* : { strapi: Core.Strapi } */) {
    const frontendUrlRaw = process.env.FRONTEND_URL?.trim();
    const frontendUrl = frontendUrlRaw?.replace(/\/+$/, '');

    if (!frontendUrl) {
      strapi.log.warn('[bootstrap] FRONTEND_URL is empty, skip users-permissions reset password URL sync');
    } else {
      const resetPasswordUrl = `${frontendUrl}/reset-password`;

      const usersPermissionsStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
      const advanced = ((await usersPermissionsStore.get({ key: 'advanced' })) || {}) as Record<string, unknown>;

      if (!advanced.email_reset_password) {
        await usersPermissionsStore.set({
          key: 'advanced',
          value: {
            ...advanced,
            email_reset_password: resetPasswordUrl,
          },
        });

        strapi.log.info(`[bootstrap] users-permissions advanced.email_reset_password set to ${resetPasswordUrl}`);
      }
    }

    const uploadStore = strapi.store({ type: 'plugin', name: 'upload' });
    const uploadSettings = ((await uploadStore.get({ key: 'settings' })) || {}) as Record<string, unknown>;

    const desiredUploadSettings = {
      ...uploadSettings,
      sizeOptimization: false,
      responsiveDimensions: false,
    };

    const shouldUpdateUploadSettings =
      uploadSettings.sizeOptimization !== false || uploadSettings.responsiveDimensions !== false;

    if (shouldUpdateUploadSettings) {
      await uploadStore.set({ key: 'settings', value: desiredUploadSettings });
      strapi.log.info('[bootstrap] upload.settings updated: sizeOptimization=false, responsiveDimensions=false');
    }

    await initServiceSalesMasterData(strapi);
  },
};
