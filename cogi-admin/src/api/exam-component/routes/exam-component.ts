import { factories } from '@strapi/strapi';

const EXAM_COMPONENT_UID = 'api::exam-component.exam-component';

const EXAM_COMPONENT_READ_POLICY = {
  name: 'global::has-tenant-permission',
  config: { keys: ['exam-round.manage', 'exam-round.approve'] },
};

export default factories.createCoreRouter(EXAM_COMPONENT_UID, {
  only: ['find', 'findOne'],
  config: {
    find: {
      auth: false,
      policies: [EXAM_COMPONENT_READ_POLICY],
    },
    findOne: {
      auth: false,
      policies: [EXAM_COMPONENT_READ_POLICY],
    },
  },
});