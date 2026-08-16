export default {
  routes: [
    {
      method: 'GET',
      path: '/exam-rounds',
      handler: 'exam-round-management.listRounds',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:id',
      handler: 'exam-round-management.getRoundDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-round-payment-profiles',
      handler: 'exam-round-management.listPaymentProfiles',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/payment-media-upload',
      handler: 'exam-round-management.uploadPaymentMedia',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-round-configuration-components',
      handler: 'exam-round-management.listConfigurationComponents',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-round-configuration-subjects',
      handler: 'exam-round-management.listConfigurationSubjects',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-round-configuration-programs',
      handler: 'exam-round-management.listConfigurationPrograms',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-round-configuration-outcomes',
      handler: 'exam-round-management.listConfigurationOutcomes',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-round-configuration-outcomes',
      handler: 'exam-round-management.createConfigurationOutcome',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-round-configuration-programs',
      handler: 'exam-round-management.createConfigurationProgram',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-round-configuration-subjects',
      handler: 'exam-round-management.createConfigurationSubject',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-round-configuration-components',
      handler: 'exam-round-management.createConfigurationComponent',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-round-configuration-components/:componentId',
      handler: 'exam-round-management.getConfigurationComponentDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-round-configuration-subjects/:subjectId',
      handler: 'exam-round-management.getConfigurationSubjectDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-round-configuration-programs/:programId',
      handler: 'exam-round-management.getConfigurationProgramDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-round-configuration-outcomes/:outcomeId',
      handler: 'exam-round-management.getConfigurationOutcomeDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-round-configuration-outcomes/:outcomeId',
      handler: 'exam-round-management.updateConfigurationOutcome',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-round-configuration-outcomes/:outcomeId',
      handler: 'exam-round-management.updateConfigurationOutcome',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-round-configuration-programs/:programId',
      handler: 'exam-round-management.updateConfigurationProgram',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-round-configuration-programs/:programId',
      handler: 'exam-round-management.updateConfigurationProgram',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-round-configuration-programs/:programId/subjects',
      handler: 'exam-round-management.replaceConfigurationProgramSubjects',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-round-configuration-programs/:programId/subjects/:programSubjectId',
      handler: 'exam-round-management.updateConfigurationProgramSubject',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-round-configuration-subjects/:subjectId',
      handler: 'exam-round-management.updateConfigurationSubject',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-round-configuration-subjects/:subjectId',
      handler: 'exam-round-management.updateConfigurationSubject',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-round-configuration-subjects/:subjectId/components',
      handler: 'exam-round-management.replaceConfigurationSubjectComponents',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-round-configuration-subjects/:subjectId/components/:subjectComponentId',
      handler: 'exam-round-management.updateConfigurationSubjectComponent',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-round-configuration-components/:componentId',
      handler: 'exam-round-management.updateConfigurationComponent',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-round-configuration-components/:componentId',
      handler: 'exam-round-management.updateConfigurationComponent',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/configuration/components',
      handler: 'exam-round-management.listConfigurationComponents',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/configuration/subjects',
      handler: 'exam-round-management.listConfigurationSubjects',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/configuration/programs',
      handler: 'exam-round-management.listConfigurationPrograms',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/configuration/outcomes',
      handler: 'exam-round-management.listConfigurationOutcomes',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/configuration/outcomes',
      handler: 'exam-round-management.createConfigurationOutcome',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/configuration/programs',
      handler: 'exam-round-management.createConfigurationProgram',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/configuration/subjects',
      handler: 'exam-round-management.createConfigurationSubject',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/configuration/components',
      handler: 'exam-round-management.createConfigurationComponent',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/configuration/components/:componentId',
      handler: 'exam-round-management.getConfigurationComponentDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/configuration/subjects/:subjectId',
      handler: 'exam-round-management.getConfigurationSubjectDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/configuration/programs/:programId',
      handler: 'exam-round-management.getConfigurationProgramDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/configuration/outcomes/:outcomeId',
      handler: 'exam-round-management.getConfigurationOutcomeDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-rounds/configuration/outcomes/:outcomeId',
      handler: 'exam-round-management.updateConfigurationOutcome',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-rounds/configuration/outcomes/:outcomeId',
      handler: 'exam-round-management.updateConfigurationOutcome',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-rounds/configuration/programs/:programId',
      handler: 'exam-round-management.updateConfigurationProgram',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-rounds/configuration/programs/:programId',
      handler: 'exam-round-management.updateConfigurationProgram',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-rounds/configuration/programs/:programId/subjects',
      handler: 'exam-round-management.replaceConfigurationProgramSubjects',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-rounds/configuration/programs/:programId/subjects/:programSubjectId',
      handler: 'exam-round-management.updateConfigurationProgramSubject',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-rounds/configuration/subjects/:subjectId',
      handler: 'exam-round-management.updateConfigurationSubject',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-rounds/configuration/subjects/:subjectId',
      handler: 'exam-round-management.updateConfigurationSubject',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-rounds/configuration/subjects/:subjectId/components',
      handler: 'exam-round-management.replaceConfigurationSubjectComponents',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-rounds/configuration/subjects/:subjectId/components/:subjectComponentId',
      handler: 'exam-round-management.updateConfigurationSubjectComponent',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-rounds/configuration/components/:componentId',
      handler: 'exam-round-management.updateConfigurationComponent',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/exam-rounds/configuration/components/:componentId',
      handler: 'exam-round-management.updateConfigurationComponent',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/create-from-program',
      handler: 'exam-round-management.createFromProgram',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-rounds/:id/structure',
      handler: 'exam-round-management.updateStructure',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/apply-payment-profile',
      handler: 'exam-round-management.applyPaymentProfile',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-rounds/:id/payment-settings',
      handler: 'exam-round-management.updatePaymentSettings',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/submit-for-approval',
      handler: 'exam-round-management.submitForApproval',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/approve',
      handler: 'exam-round-management.approve',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/return-to-draft',
      handler: 'exam-round-management.returnToDraft',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/open-registration',
      handler: 'exam-round-management.openRegistration',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/pause-registration',
      handler: 'exam-round-management.pauseRegistration',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/resume-registration',
      handler: 'exam-round-management.resumeRegistration',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/close-registration',
      handler: 'exam-round-management.closeRegistration',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/eligibilities',
      handler: 'exam-round-management.createEligibility',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/learner/me',
      handler: 'exam-round-management.getCurrentLearner',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/learner/exam-rounds',
      handler: 'exam-round-management.listLearnerRounds',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/learner/exam-rounds/:id',
      handler: 'exam-round-management.getLearnerRoundDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/learner/exam-rounds/:id/learner-profile-context',
      handler: 'exam-round-management.getLearnerProfileRegistrationContext',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/learner/exam-rounds/:id/create-profile',
      handler: 'exam-round-management.createLearnerProfile',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/learner/exam-rounds/:id/registration-options',
      handler: 'exam-round-management.getLearnerRegistrationOptions',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/learner/exam-rounds/:id/register',
      handler: 'exam-round-management.registerLearner',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/learner/exam-registrations/:id',
      handler: 'exam-round-management.getLearnerRegistrationDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/learner/exam-registrations/:id/payment-evidence',
      handler: 'exam-round-management.uploadLearnerRegistrationPaymentEvidence',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/learner/exam-registrations/:id/report-payment',
      handler: 'exam-round-management.reportLearnerRegistrationPayment',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:id/my-registration-context',
      handler: 'exam-round-management.myRegistrationContext',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/register',
      handler: 'exam-round-management.register',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-registration.self',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/eligibilities/bulk',
      handler: 'exam-round-management.bulkCreateEligibilities',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:id/eligibilities',
      handler: 'exam-round-management.listEligibilities',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:id/payment-summary',
      handler: 'exam-round-management.getPaymentSummary',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:id/venue-room-configuration',
      handler: 'exam-round-management.getVenueRoomConfiguration',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-rounds/:id/venues-rooms',
      handler: 'exam-round-management.updateVenueRoomConfiguration',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/venues',
      handler: 'exam-round-management.createVenueForRound',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/rooms',
      handler: 'exam-round-management.createRoomForRound',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:id/payments',
      handler: 'exam-round-management.listRoundPayments',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:id/review-summary',
      handler: 'exam-round-management.getReviewSummary',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:id/reviews',
      handler: 'exam-round-management.listRoundReviews',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:roundId/reviews/:registrationId',
      handler: 'exam-round-management.getRoundReviewDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:roundId/registrations/:registrationId/approve',
      handler: 'exam-round-management.approveRegistrationReview',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:roundId/registrations/:registrationId/return',
      handler: 'exam-round-management.returnRegistrationReview',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:roundId/registrations/:registrationId/reject',
      handler: 'exam-round-management.rejectRegistrationReview',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:roundId/registrations/:registrationId/payment-detail',
      handler: 'exam-round-management.getRoundPaymentDetail',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:roundId/registrations/:registrationId/confirm-payment',
      handler: 'exam-round-management.confirmRegistrationPayment',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:roundId/registrations/:registrationId/reject-payment-report',
      handler: 'exam-round-management.rejectRegistrationPaymentReport',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:id/eligibility-learners',
      handler: 'exam-round-management.listEligibilityLearners',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/exam-rounds/:id/eligibilities/:eligibilityId',
      handler: 'exam-round-management.getEligibility',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              keys: ['exam-round.manage', 'exam-round.approve'],
            },
          },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/exam-rounds/:id/eligibilities/:eligibilityId',
      handler: 'exam-round-management.updateEligibility',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/exam-rounds/:id/eligibilities/:eligibilityId/mark-ineligible',
      handler: 'exam-round-management.markEligibilityIneligible',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'exam-round.manage',
            },
          },
        ],
      },
    },
  ],
};