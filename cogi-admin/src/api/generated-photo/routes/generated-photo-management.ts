const GENERATED_PHOTO_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    keys: ['photo-frame-campaign.manage', 'photo-frame-campaign.manage.all'],
  },
};

export default {
  routes: [
    {
      method: 'POST',
      path: '/public/photo-frame-campaigns/:slug/generated-photos',
      handler: 'generated-photo.createPublicGeneratedPhoto',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/photo-frame-campaign-management/campaigns/:id/generated-photos',
      handler: 'generated-photo.listCampaignGeneratedPhotos',
      config: {
        auth: false,
        policies: [GENERATED_PHOTO_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/photo-frame-campaign-management/campaigns/:id/generated-photo-summary',
      handler: 'generated-photo.getCampaignGeneratedPhotoSummary',
      config: {
        auth: false,
        policies: [GENERATED_PHOTO_POLICY],
      },
    },
    {
      method: 'PATCH',
      path: '/photo-frame-campaign-management/generated-photos/:id/status',
      handler: 'generated-photo.updateGeneratedPhotoStatus',
      config: {
        auth: false,
        policies: [GENERATED_PHOTO_POLICY],
      },
    },
    {
      method: 'DELETE',
      path: '/photo-frame-campaign-management/generated-photos/:id',
      handler: 'generated-photo.deleteGeneratedPhoto',
      config: {
        auth: false,
        policies: [GENERATED_PHOTO_POLICY],
      },
    },
  ],
};