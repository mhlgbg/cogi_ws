import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminAuditLog extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_audit_logs';
  info: {
    displayName: 'Audit Log';
    pluralName: 'audit-logs';
    singularName: 'audit-log';
  };
  options: {
    draftAndPublish: false;
    timestamps: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.DateTime & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::audit-log'> &
      Schema.Attribute.Private;
    payload: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<'oneToOne', 'admin::user'>;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminSession extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_sessions';
  info: {
    description: 'Session Manager storage';
    displayName: 'Session';
    name: 'Session';
    pluralName: 'sessions';
    singularName: 'session';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
    i18n: {
      localized: false;
    };
  };
  attributes: {
    absoluteExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    childId: Schema.Attribute.String & Schema.Attribute.Private;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deviceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::session'> &
      Schema.Attribute.Private;
    origin: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sessionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique;
    status: Schema.Attribute.String & Schema.Attribute.Private;
    type: Schema.Attribute.String & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiAboutAbout extends Struct.SingleTypeSchema {
  collectionName: 'abouts';
  info: {
    description: 'Write about yourself and the content you create';
    displayName: 'About';
    pluralName: 'abouts';
    singularName: 'about';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    blocks: Schema.Attribute.DynamicZone<
      ['shared.media', 'shared.quote', 'shared.rich-text', 'shared.slider']
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::about.about'> &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiActivationTokenActivationToken
  extends Struct.CollectionTypeSchema {
  collectionName: 'activation_tokens';
  info: {
    displayName: 'Activation Token';
    pluralName: 'activation-tokens';
    singularName: 'activation-token';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::activation-token.activation-token'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    usedAt: Schema.Attribute.DateTime;
    user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiAdmissionApplicationActivityAdmissionApplicationActivity
  extends Struct.CollectionTypeSchema {
  collectionName: 'admission_application_activities';
  info: {
    description: 'Activity logs for admission application access and important actions.';
    displayName: 'AdmissionApplicationActivity';
    pluralName: 'admission-application-activities';
    singularName: 'admission-application-activity';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    actionType: Schema.Attribute.Enumeration<
      [
        'OPEN_APPLICATION',
        'VIEW_REVIEW_DETAIL',
        'VIEW_PARENT_TRACKING',
        'MESSAGE_SENT',
        'FILE_ATTACHED',
        'STATUS_CHANGED',
        'APPLICATION_UPDATED',
        'REVIEW_SNAPSHOT_REBUILT',
        'APPLICATION_SUBMITTED',
        'APPLICATION_APPROVED',
        'APPLICATION_REJECTED',
        'APPLICATION_NEEDS_UPDATE',
        'APPROVAL_ACKNOWLEDGED',
        'EMAIL_SENT',
        'APPLICATION_SOFT_DELETED',
        'APPLICATION_RESTORED',
      ]
    > &
      Schema.Attribute.Required;
    actorType: Schema.Attribute.Enumeration<
      ['SCHOOL', 'PARENT', 'SYSTEM', 'UNKNOWN']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'UNKNOWN'>;
    actorUser: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    application: Schema.Attribute.Relation<
      'manyToOne',
      'api::admission-application.admission-application'
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    ipAddress: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application-activity.admission-application-activity'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userAgent: Schema.Attribute.Text;
  };
}

export interface ApiAdmissionApplicationFileAdmissionApplicationFile
  extends Struct.CollectionTypeSchema {
  collectionName: 'admission_application_files';
  info: {
    description: 'Uploaded files attached to admission applications.';
    displayName: 'AdmissionApplicationFile';
    pluralName: 'admission-application-files';
    singularName: 'admission-application-file';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    application: Schema.Attribute.Relation<
      'manyToOne',
      'api::admission-application.admission-application'
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    fieldKey: Schema.Attribute.String & Schema.Attribute.Required;
    file: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'> &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application-file.admission-application-file'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAdmissionApplicationMessageAdmissionApplicationMessage
  extends Struct.CollectionTypeSchema {
  collectionName: 'admission_application_messages';
  info: {
    description: 'Conversation messages for one admission application.';
    displayName: 'AdmissionApplicationMessage';
    pluralName: 'admission-application-messages';
    singularName: 'admission-application-message';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    application: Schema.Attribute.Relation<
      'manyToOne',
      'api::admission-application.admission-application'
    > &
      Schema.Attribute.Required;
    attachments: Schema.Attribute.JSON;
    content: Schema.Attribute.RichText;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    createdByRole: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application-message.admission-application-message'
    > &
      Schema.Attribute.Private;
    messageType: Schema.Attribute.Enumeration<
      [
        'MESSAGE',
        'REQUEST_UPDATE',
        'SUPPLEMENT_FILE',
        'STATUS_NOTICE',
        'SYSTEM',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'MESSAGE'>;
    metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    readByParentAt: Schema.Attribute.DateTime;
    readBySchoolAt: Schema.Attribute.DateTime;
    senderType: Schema.Attribute.Enumeration<['SCHOOL', 'PARENT', 'SYSTEM']> &
      Schema.Attribute.Required;
    senderUser: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    visibility: Schema.Attribute.Enumeration<['PUBLIC', 'INTERNAL']> &
      Schema.Attribute.DefaultTo<'PUBLIC'>;
  };
}

export interface ApiAdmissionApplicationAdmissionApplication
  extends Struct.CollectionTypeSchema {
  collectionName: 'admission_applications';
  info: {
    description: 'Tenant-scoped admission applications submitted by parents.';
    displayName: 'AdmissionApplication';
    pluralName: 'admission-applications';
    singularName: 'admission-application';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activities: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application-activity.admission-application-activity'
    >;
    address: Schema.Attribute.Text;
    admissionStatus: Schema.Attribute.Enumeration<
      [
        'draft',
        'submitted',
        'reviewing',
        'approved',
        'rejected',
        'exam_scheduled',
        'passed',
        'failed',
        'enrolled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    applicationCode: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    applicationFiles: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application-file.admission-application-file'
    >;
    approvalNotificationCount: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>;
    approvalNotifiedAt: Schema.Attribute.DateTime;
    approvedAcknowledgedAt: Schema.Attribute.DateTime;
    approvedAcknowledgedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    approvedAcknowledgedNote: Schema.Attribute.Text;
    campaign: Schema.Attribute.Relation<'manyToOne', 'api::campaign.campaign'> &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currentSchool: Schema.Attribute.String;
    deletedAt: Schema.Attribute.DateTime;
    deletedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    deleteReason: Schema.Attribute.Text;
    dob: Schema.Attribute.Date;
    formData: Schema.Attribute.JSON;
    formTemplateVersion: Schema.Attribute.Integer;
    gender: Schema.Attribute.Enumeration<['male', 'female', 'other']>;
    isDeleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    lastActivityAt: Schema.Attribute.DateTime;
    lastMessageAt: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application.admission-application'
    > &
      Schema.Attribute.Private;
    messages: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application-message.admission-application-message'
    >;
    parent: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    parentLastOpenedAt: Schema.Attribute.DateTime;
    parentUnreadMessageCount: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    restoredAt: Schema.Attribute.DateTime;
    restoredBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    restoreReason: Schema.Attribute.Text;
    reviewedAt: Schema.Attribute.DateTime;
    reviewedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    reviewNote: Schema.Attribute.Text;
    reviewSnapshot: Schema.Attribute.JSON;
    reviewStatus: Schema.Attribute.Enumeration<
      ['submitted', 'returned', 'accepted']
    >;
    schoolLastOpenedAt: Schema.Attribute.DateTime;
    schoolUnreadMessageCount: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>;
    studentCode: Schema.Attribute.String;
    studentName: Schema.Attribute.String;
    submittedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAiAssistantAiAssistant extends Struct.CollectionTypeSchema {
  collectionName: 'ai_assistants';
  info: {
    description: 'Tenant-scoped AI assistant configuration for public chat and future AI features.';
    displayName: 'AiAssistant';
    pluralName: 'ai-assistants';
    singularName: 'ai-assistant';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assistantName: Schema.Attribute.String & Schema.Attribute.DefaultTo<''>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ai-assistant.ai-assistant'
    > &
      Schema.Attribute.Private;
    maxTokens: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<800>;
    model: Schema.Attribute.String & Schema.Attribute.DefaultTo<'gpt-4o-mini'>;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    provider: Schema.Attribute.Enumeration<['OPENAI', 'GEMINI', 'ANTHROPIC']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'OPENAI'>;
    publishedAt: Schema.Attribute.DateTime;
    systemPrompt: Schema.Attribute.RichText;
    temperature: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0.3>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    welcomeMessage: Schema.Attribute.Text;
  };
}

export interface ApiAiKnowledgeAiKnowledge extends Struct.CollectionTypeSchema {
  collectionName: 'ai_knowledges';
  info: {
    description: 'Tenant-scoped knowledge entries for future AI-assisted public chat and support flows.';
    displayName: 'AiKnowledge';
    pluralName: 'ai-knowledges';
    singularName: 'ai-knowledge';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    content: Schema.Attribute.RichText & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ai-knowledge.ai-knowledge'
    > &
      Schema.Attribute.Private;
    priority: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['ACTIVE', 'INACTIVE']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'ACTIVE'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiArticleArticle extends Struct.CollectionTypeSchema {
  collectionName: 'articles';
  info: {
    description: 'Create your blog content';
    displayName: 'Article';
    pluralName: 'articles';
    singularName: 'article';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    author: Schema.Attribute.Relation<'manyToOne', 'api::author.author'>;
    blocks: Schema.Attribute.DynamicZone<
      ['shared.media', 'shared.quote', 'shared.rich-text', 'shared.slider']
    >;
    category: Schema.Attribute.Relation<'manyToOne', 'api::category.category'>;
    cover: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::article.article'
    > &
      Schema.Attribute.Private;
    publicAt: Schema.Attribute.DateTime;
    publishedAt: Schema.Attribute.DateTime;
    seoDescription: Schema.Attribute.Text;
    seoImage: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    seoKeywords: Schema.Attribute.Text;
    seoTitle: Schema.Attribute.String;
    slug: Schema.Attribute.UID<'title'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAuthorAuthor extends Struct.CollectionTypeSchema {
  collectionName: 'authors';
  info: {
    description: 'Create authors for your content';
    displayName: 'Author';
    pluralName: 'authors';
    singularName: 'author';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    articles: Schema.Attribute.Relation<'oneToMany', 'api::article.article'>;
    avatar: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::author.author'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCampaignCampaign extends Struct.CollectionTypeSchema {
  collectionName: 'campaigns';
  info: {
    description: 'Tenant-scoped admission campaigns for enrollment management.';
    displayName: 'Campaign';
    pluralName: 'campaigns';
    singularName: 'campaign';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    admissionApplications: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application.admission-application'
    >;
    allowExamCardPrinting: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    applicationStatusGuide: Schema.Attribute.JSON;
    campaignStatus: Schema.Attribute.Enumeration<['draft', 'open', 'closed']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.RichText;
    endDate: Schema.Attribute.Date;
    examCardPrintEndAt: Schema.Attribute.DateTime;
    examCardPrintStartAt: Schema.Attribute.DateTime;
    examCardReminderEmailHtml: Schema.Attribute.RichText;
    examCardReminderEmailSubject: Schema.Attribute.String;
    examCardTemplateHtml: Schema.Attribute.RichText;
    formTemplate: Schema.Attribute.Relation<
      'manyToOne',
      'api::form-template.form-template'
    > &
      Schema.Attribute.Required;
    formTemplateVersion: Schema.Attribute.Integer & Schema.Attribute.Required;
    grade: Schema.Attribute.String & Schema.Attribute.Required;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::campaign.campaign'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    reviewDisplayConfig: Schema.Attribute.JSON;
    scorePublishedAt: Schema.Attribute.DateTime;
    scoreReportTemplateHtml: Schema.Attribute.RichText;
    startDate: Schema.Attribute.Date;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    year: Schema.Attribute.Integer & Schema.Attribute.Required;
  };
}

export interface ApiCandidateExamLogCandidateExamLog
  extends Struct.CollectionTypeSchema {
  collectionName: 'candidate_exam_logs';
  info: {
    description: 'Tenant-scoped audit trail for candidate exam card and exam operations.';
    displayName: 'CandidateExamLog';
    pluralName: 'candidate-exam-logs';
    singularName: 'candidate-exam-log';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    action: Schema.Attribute.Enumeration<
      [
        'card_view',
        'first_card_download',
        'card_download',
        'card_print',
        'card_reminder_sent',
        'card_reminder_failed',
        'status_changed',
        'score_updated',
        'room_assigned',
        'note_updated',
        'import_created',
        'import_updated',
        'import_restored',
        'score_lookup',
        'score_report_sent',
      ]
    > &
      Schema.Attribute.Required;
    actionAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    actionBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    actorType: Schema.Attribute.Enumeration<['parent', 'staff', 'system']> &
      Schema.Attribute.Required;
    admissionApplication: Schema.Attribute.Relation<
      'manyToOne',
      'api::admission-application.admission-application'
    >;
    admissionSeason: Schema.Attribute.Relation<
      'manyToOne',
      'api::campaign.campaign'
    > &
      Schema.Attribute.Required;
    candidateExam: Schema.Attribute.Relation<
      'manyToOne',
      'api::candidate-exam.candidate-exam'
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deletedAt: Schema.Attribute.DateTime;
    deletedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    deleteReason: Schema.Attribute.Text;
    ip: Schema.Attribute.String;
    isDeleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::candidate-exam-log.candidate-exam-log'
    > &
      Schema.Attribute.Private;
    newValue: Schema.Attribute.JSON;
    note: Schema.Attribute.Text;
    oldValue: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    restoredAt: Schema.Attribute.DateTime;
    restoredBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    restoreReason: Schema.Attribute.Text;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userAgent: Schema.Attribute.String;
  };
}

export interface ApiCandidateExamCandidateExam
  extends Struct.CollectionTypeSchema {
  collectionName: 'candidate_exams';
  info: {
    description: 'Tenant-scoped candidate exam records derived from qualified admission applications.';
    displayName: 'CandidateExam';
    pluralName: 'candidate-exams';
    singularName: 'candidate-exam';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    admissionApplication: Schema.Attribute.Relation<
      'manyToOne',
      'api::admission-application.admission-application'
    >;
    admissionSeason: Schema.Attribute.Relation<
      'manyToOne',
      'api::campaign.campaign'
    > &
      Schema.Attribute.Required;
    applicationCode: Schema.Attribute.String;
    candidateExamStatus: Schema.Attribute.Enumeration<
      [
        'draft',
        'ready',
        'card_downloaded',
        'checked_in',
        'absent',
        'completed',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    candidateNumber: Schema.Attribute.String;
    cardDownloadCount: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    cardFirstDownloadedAt: Schema.Attribute.DateTime;
    cardFirstDownloadedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    cardImagePath: Schema.Attribute.Text;
    cardReminderCount: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    cardReminderQueuedAt: Schema.Attribute.DateTime;
    cardReminderSentAt: Schema.Attribute.DateTime;
    cardReminderStatus: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'pending'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dateOfBirth: Schema.Attribute.Date;
    deletedAt: Schema.Attribute.DateTime;
    deletedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    deleteReason: Schema.Attribute.Text;
    englishScore: Schema.Attribute.Decimal;
    examLocation: Schema.Attribute.String;
    examRoom: Schema.Attribute.String;
    firstName: Schema.Attribute.String;
    fullName: Schema.Attribute.String;
    gender: Schema.Attribute.Enumeration<['male', 'female', 'other']>;
    incentiveScore: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    isDeleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    lastName: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::candidate-exam.candidate-exam'
    > &
      Schema.Attribute.Private;
    logs: Schema.Attribute.Relation<
      'oneToMany',
      'api::candidate-exam-log.candidate-exam-log'
    >;
    mathScore: Schema.Attribute.Decimal;
    note: Schema.Attribute.Text;
    primarySchool: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    recheckEnglish: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    recheckEnglishScore: Schema.Attribute.Decimal;
    recheckMath: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    recheckMathScore: Schema.Attribute.Decimal;
    recheckVietnamese: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    recheckVietnameseScore: Schema.Attribute.Decimal;
    restoredAt: Schema.Attribute.DateTime;
    restoredBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    restoreReason: Schema.Attribute.Text;
    studentCode: Schema.Attribute.String;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    totalScore: Schema.Attribute.Decimal;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vietnameseScore: Schema.Attribute.Decimal;
  };
}

export interface ApiCategoryCategory extends Struct.CollectionTypeSchema {
  collectionName: 'categories';
  info: {
    description: 'Organize your content into categories';
    displayName: 'Category';
    pluralName: 'categories';
    singularName: 'category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    articles: Schema.Attribute.Relation<'oneToMany', 'api::article.article'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::category.category'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiChallengeActivityChallengeActivity
  extends Struct.CollectionTypeSchema {
  collectionName: 'challenge_activities';
  info: {
    description: 'Tenant-scoped accepted or pending activity ledger used by challenge scoring.';
    displayName: 'Challenge Activity';
    pluralName: 'challenge-activities';
    singularName: 'challenge-activity';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    acceptedAt: Schema.Attribute.DateTime;
    acceptedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    activity: Schema.Attribute.Relation<
      'manyToOne',
      'api::strava-activity.strava-activity'
    > &
      Schema.Attribute.Required;
    challenge: Schema.Attribute.Relation<
      'manyToOne',
      'api::fitness-challenge.fitness-challenge'
    > &
      Schema.Attribute.Required;
    countedActivityCount: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<1>;
    countedDistance: Schema.Attribute.Decimal;
    countedElevationGain: Schema.Attribute.Decimal;
    countedMovingTime: Schema.Attribute.Integer;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::challenge-activity.challenge-activity'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    participant: Schema.Attribute.Relation<
      'manyToOne',
      'api::challenge-participant.challenge-participant'
    > &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    rejectedAt: Schema.Attribute.DateTime;
    rejectedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    rejectReason: Schema.Attribute.Text;
    status: Schema.Attribute.Enumeration<
      ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'PENDING'>;
    submittedAt: Schema.Attribute.DateTime;
    submittedBy: Schema.Attribute.Enumeration<['SYSTEM', 'USER', 'ADMIN']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'USER'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
  };
}

export interface ApiChallengeParticipantChallengeParticipant
  extends Struct.CollectionTypeSchema {
  collectionName: 'challenge_participants';
  info: {
    description: 'Tenant-scoped challenge enrollment and aggregate progress for a user.';
    displayName: 'Challenge Participant';
    pluralName: 'challenge-participants';
    singularName: 'challenge-participant';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activityCount: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    challenge: Schema.Attribute.Relation<
      'manyToOne',
      'api::fitness-challenge.fitness-challenge'
    > &
      Schema.Attribute.Required;
    challengeActivities: Schema.Attribute.Relation<
      'oneToMany',
      'api::challenge-activity.challenge-activity'
    >;
    completedAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    displayName: Schema.Attribute.String;
    joinedAt: Schema.Attribute.DateTime;
    lastCalculatedAt: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::challenge-participant.challenge-participant'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    rank: Schema.Attribute.Integer;
    status: Schema.Attribute.Enumeration<
      ['REGISTERED', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'DISQUALIFIED']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'REGISTERED'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    totalDistance: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    totalElevationGain: Schema.Attribute.Decimal &
      Schema.Attribute.DefaultTo<0>;
    totalMovingTime: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    withdrawnAt: Schema.Attribute.DateTime;
  };
}

export interface ApiChatMessageChatMessage extends Struct.CollectionTypeSchema {
  collectionName: 'chat_messages';
  info: {
    description: 'Tenant-scoped messages belonging to public chat sessions.';
    displayName: 'ChatMessage';
    pluralName: 'chat-messages';
    singularName: 'chat-message';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    content: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::chat-message.chat-message'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Enumeration<['user', 'assistant', 'admin']> &
      Schema.Attribute.Required;
    session: Schema.Attribute.Relation<
      'manyToOne',
      'api::chat-session.chat-session'
    > &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiChatSessionChatSession extends Struct.CollectionTypeSchema {
  collectionName: 'chat_sessions';
  info: {
    description: 'Tenant-scoped public chat sessions for website visitors.';
    displayName: 'ChatSession';
    pluralName: 'chat-sessions';
    singularName: 'chat-session';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    chatLeadStatus: Schema.Attribute.Enumeration<
      ['NEW', 'CONTACTED', 'CONVERTED', 'IGNORED']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'NEW'>;
    chatSessionStatus: Schema.Attribute.Enumeration<['OPEN', 'CLOSED']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'OPEN'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::chat-session.chat-session'
    > &
      Schema.Attribute.Private;
    messages: Schema.Attribute.Relation<
      'oneToMany',
      'api::chat-message.chat-message'
    >;
    publishedAt: Schema.Attribute.DateTime;
    sourcePage: Schema.Attribute.String;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    visitorEmail: Schema.Attribute.Email;
    visitorName: Schema.Attribute.String;
    visitorPhone: Schema.Attribute.String;
  };
}

export interface ApiClassTeacherAssignmentClassTeacherAssignment
  extends Struct.CollectionTypeSchema {
  collectionName: 'class_teacher_assignments';
  info: {
    description: 'Assignments of teachers to classes (tenant-scoped).';
    displayName: 'ClassTeacherAssignment';
    pluralName: 'class-teacher-assignments';
    singularName: 'class-teacher-assignment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assignmentStatus: Schema.Attribute.Enumeration<['active', 'inactive']> &
      Schema.Attribute.DefaultTo<'active'>;
    class: Schema.Attribute.Relation<'manyToOne', 'api::class.class'> &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    endDate: Schema.Attribute.Date;
    isPayable: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::class-teacher-assignment.class-teacher-assignment'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Enumeration<
      ['main', 'co_teacher', 'assistant', 'substitute']
    > &
      Schema.Attribute.DefaultTo<'co_teacher'>;
    startDate: Schema.Attribute.Date;
    subject: Schema.Attribute.String;
    subjectCode: Schema.Attribute.String;
    teacher: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiClassClass extends Struct.CollectionTypeSchema {
  collectionName: 'classes';
  info: {
    description: 'Tenant-scoped classes managed by a main teacher.';
    displayName: 'Class';
    pluralName: 'classes';
    singularName: 'class';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    classStatus: Schema.Attribute.Enumeration<['active', 'inactive']> &
      Schema.Attribute.DefaultTo<'active'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    enrollments: Schema.Attribute.Relation<
      'oneToMany',
      'api::enrollment.enrollment'
    >;
    feeSheetClasses: Schema.Attribute.Relation<
      'oneToMany',
      'api::fee-sheet-class.fee-sheet-class'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::class.class'> &
      Schema.Attribute.Private;
    mainTeacher: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    subject: Schema.Attribute.String;
    subjectCode: Schema.Attribute.String;
    teacherAssignments: Schema.Attribute.Relation<
      'oneToMany',
      'api::class-teacher-assignment.class-teacher-assignment'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiContentBlockContentBlock
  extends Struct.CollectionTypeSchema {
  collectionName: 'content_blocks';
  info: {
    description: 'Tenant-scoped ordered content blocks inside a learning object.';
    displayName: 'Content Block';
    pluralName: 'content-blocks';
    singularName: 'content-block';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    config: Schema.Attribute.JSON;
    content: Schema.Attribute.Text;
    contentBlockStatus: Schema.Attribute.Enumeration<
      ['active', 'hidden', 'archived']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    formula: Schema.Attribute.Relation<'manyToOne', 'api::formula.formula'>;
    htmlContent: Schema.Attribute.RichText;
    learningObject: Schema.Attribute.Relation<
      'manyToOne',
      'api::learning-object.learning-object'
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::content-block.content-block'
    > &
      Schema.Attribute.Private;
    media: Schema.Attribute.Media;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    question: Schema.Attribute.Relation<'manyToOne', 'api::question.question'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<
      [
        'text',
        'html',
        'image',
        'video',
        'audio',
        'question',
        'formula',
        'example',
        'exercise',
        'interactive',
        'summary',
      ]
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    visualAsset: Schema.Attribute.Relation<
      'manyToOne',
      'api::visual-asset.visual-asset'
    >;
  };
}

export interface ApiCustomerCustomer extends Struct.CollectionTypeSchema {
  collectionName: 'customers';
  info: {
    displayName: 'Customer';
    pluralName: 'customers';
    singularName: 'customer';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    address: Schema.Attribute.Text;
    allowDebt: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customerType: Schema.Attribute.Enumeration<
      ['RETAIL', 'COMPANY', 'INTERNAL', 'OTHER']
    > &
      Schema.Attribute.DefaultTo<'RETAIL'>;
    debtLimit: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    isDefaultRetailGuest: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::customer.customer'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    note: Schema.Attribute.Text;
    payment_transactions: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment-transaction.payment-transaction'
    >;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    service_orders: Schema.Attribute.Relation<
      'oneToMany',
      'api::service-order.service-order'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    zalo: Schema.Attribute.String;
  };
}

export interface ApiDepartmentMembershipDepartmentMembership
  extends Struct.CollectionTypeSchema {
  collectionName: 'department_memberships';
  info: {
    displayName: 'DepartmentMembership';
    pluralName: 'department-memberships';
    singularName: 'department-membership';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    approved_by: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    approvedAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    department: Schema.Attribute.Relation<
      'oneToOne',
      'api::department.department'
    >;
    joinedAt: Schema.Attribute.Date;
    joinMethod: Schema.Attribute.Enumeration<['SELF_REGISTER', 'ASSIGNED']>;
    leftAt: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::department-membership.department-membership'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    status_record: Schema.Attribute.Enumeration<
      ['PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED']
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiDepartmentDepartment extends Struct.CollectionTypeSchema {
  collectionName: 'departments';
  info: {
    displayName: 'Department';
    pluralName: 'departments';
    singularName: 'department';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    children: Schema.Attribute.Relation<
      'oneToMany',
      'api::department.department'
    >;
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    isActive: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::department.department'
    > &
      Schema.Attribute.Private;
    manager: Schema.Attribute.Relation<'manyToOne', 'api::employee.employee'>;
    name: Schema.Attribute.String;
    parent: Schema.Attribute.Relation<
      'manyToOne',
      'api::department.department'
    >;
    publishedAt: Schema.Attribute.DateTime;
    requests: Schema.Attribute.Relation<'oneToMany', 'api::request.request'>;
    scopeType: Schema.Attribute.Enumeration<
      ['GROUP', 'COMPANY', 'DEPARTMENT', 'TEAM']
    >;
    slug: Schema.Attribute.UID<'name'>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiEmployeeHistoryEmployeeHistory
  extends Struct.CollectionTypeSchema {
  collectionName: 'employee_histories';
  info: {
    displayName: 'Employee History';
    pluralName: 'employee-histories';
    singularName: 'employee-history';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assignmentType: Schema.Attribute.Enumeration<
      ['official', 'concurrent', 'temporary', 'promotion', 'transfer']
    > &
      Schema.Attribute.DefaultTo<'official'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    decisionNo: Schema.Attribute.String;
    department: Schema.Attribute.Relation<
      'manyToOne',
      'api::department.department'
    > &
      Schema.Attribute.Required;
    employee: Schema.Attribute.Relation<'manyToOne', 'api::employee.employee'> &
      Schema.Attribute.Required;
    endDate: Schema.Attribute.Date;
    isCurrent: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    isPrimary: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::employee-history.employee-history'
    > &
      Schema.Attribute.Private;
    manager: Schema.Attribute.Relation<'manyToOne', 'api::employee.employee'>;
    note: Schema.Attribute.Text;
    position: Schema.Attribute.Relation<'manyToOne', 'api::position.position'> &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    startDate: Schema.Attribute.Date & Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiEmployeeEmployee extends Struct.CollectionTypeSchema {
  collectionName: 'employees';
  info: {
    displayName: 'Employee';
    pluralName: 'employees';
    singularName: 'employee';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    address: Schema.Attribute.Text;
    avatar: Schema.Attribute.Media<'images'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currentDepartment: Schema.Attribute.Relation<
      'manyToOne',
      'api::department.department'
    >;
    currentManager: Schema.Attribute.Relation<
      'manyToOne',
      'api::employee.employee'
    >;
    currentPosition: Schema.Attribute.Relation<
      'manyToOne',
      'api::position.position'
    >;
    dateOfBirth: Schema.Attribute.Date;
    employeeCode: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    employeeStatus: Schema.Attribute.Enumeration<
      [
        'draft',
        'active',
        'probation',
        'official',
        'maternity_leave',
        'unpaid_leave',
        'resigned',
        'retired',
      ]
    > &
      Schema.Attribute.DefaultTo<'active'>;
    fullName: Schema.Attribute.String & Schema.Attribute.Required;
    gender: Schema.Attribute.Enumeration<['male', 'female', 'other']>;
    identityIssueDate: Schema.Attribute.Date;
    identityIssuePlace: Schema.Attribute.String;
    identityNumber: Schema.Attribute.String;
    joinDate: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::employee.employee'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    officialDate: Schema.Attribute.Date;
    personalEmail: Schema.Attribute.Email;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    workEmail: Schema.Attribute.Email;
  };
}

export interface ApiEnrollmentEnrollment extends Struct.CollectionTypeSchema {
  collectionName: 'enrollments';
  info: {
    description: 'Learner enrollment in tenant-scoped classes.';
    displayName: 'Enrollment';
    pluralName: 'enrollments';
    singularName: 'enrollment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    class: Schema.Attribute.Relation<'manyToOne', 'api::class.class'> &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    enrollmentStatus: Schema.Attribute.Enumeration<['active', 'inactive']> &
      Schema.Attribute.DefaultTo<'active'>;
    joinDate: Schema.Attribute.Date;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'> &
      Schema.Attribute.Required;
    leaveDate: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::enrollment.enrollment'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFeatureGroupFeatureGroup
  extends Struct.CollectionTypeSchema {
  collectionName: 'feature_groups';
  info: {
    description: 'Internal business collection for grouping RBAC features';
    displayName: 'Feature Group';
    pluralName: 'feature-groups';
    singularName: 'feature-group';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    icon: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::feature-group.feature-group'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFeatureFeature extends Struct.CollectionTypeSchema {
  collectionName: 'features';
  info: {
    description: 'Business permission (feature-level access)';
    displayName: 'Feature';
    pluralName: 'features';
    singularName: 'feature';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    group: Schema.Attribute.Relation<
      'manyToOne',
      'api::feature-group.feature-group'
    > &
      Schema.Attribute.Required;
    key: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::feature.feature'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    path: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFeeItemFeeItem extends Struct.CollectionTypeSchema {
  collectionName: 'fee_items';
  info: {
    description: 'Learner-level fee line items under class fee sheets.';
    displayName: 'Fee Item';
    pluralName: 'fee-items';
    singularName: 'fee-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    discountAmount: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    discountPercent: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    feeItemPaymentStatus: Schema.Attribute.Enumeration<
      ['unpaid', 'partial', 'paid']
    > &
      Schema.Attribute.DefaultTo<'unpaid'>;
    feeSheetClass: Schema.Attribute.Relation<
      'manyToOne',
      'api::fee-sheet-class.fee-sheet-class'
    > &
      Schema.Attribute.Required;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'> &
      Schema.Attribute.Required;
    learnerCodeSnapshot: Schema.Attribute.String;
    learnerNameSnapshot: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::fee-item.fee-item'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    paidAmount: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    paymentAllocations: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment-allocation.payment-allocation'
    >;
    publishedAt: Schema.Attribute.DateTime;
    sessions: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    unitPrice: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFeeSheetClassFeeSheetClass
  extends Struct.CollectionTypeSchema {
  collectionName: 'fee_sheet_classes';
  info: {
    description: 'Class-level fee sheet row with class and teacher snapshots.';
    displayName: 'Fee Sheet Class';
    pluralName: 'fee-sheet-classes';
    singularName: 'fee-sheet-class';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    class: Schema.Attribute.Relation<'manyToOne', 'api::class.class'> &
      Schema.Attribute.Required;
    classNameSnapshot: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    feeItems: Schema.Attribute.Relation<'oneToMany', 'api::fee-item.fee-item'>;
    feeSheet: Schema.Attribute.Relation<
      'manyToOne',
      'api::fee-sheet.fee-sheet'
    > &
      Schema.Attribute.Required;
    feeSheetClassStatus: Schema.Attribute.Enumeration<
      ['draft', 'submitted', 'approved']
    > &
      Schema.Attribute.DefaultTo<'draft'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::fee-sheet-class.fee-sheet-class'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    teacher: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    teacherNameSnapshot: Schema.Attribute.String;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFeeSheetFeeSheet extends Struct.CollectionTypeSchema {
  collectionName: 'fee_sheets';
  info: {
    description: 'Tenant-scoped fee sheet periods for learner billing.';
    displayName: 'Fee Sheet';
    pluralName: 'fee-sheets';
    singularName: 'fee-sheet';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    feeSheetClasses: Schema.Attribute.Relation<
      'oneToMany',
      'api::fee-sheet-class.fee-sheet-class'
    >;
    feeSheetStatus: Schema.Attribute.Enumeration<
      ['draft', 'open', 'closed', 'approved']
    > &
      Schema.Attribute.DefaultTo<'draft'>;
    fromDate: Schema.Attribute.Date & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::fee-sheet.fee-sheet'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    toDate: Schema.Attribute.Date & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiFileAssetFileAsset extends Struct.CollectionTypeSchema {
  collectionName: 'file_assets';
  info: {
    description: 'Logical metadata records for uploaded files across all modules.';
    displayName: 'File Asset';
    pluralName: 'file-assets';
    singularName: 'file-asset';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    checksum: Schema.Attribute.String;
    code: Schema.Attribute.UID<'fileName'> &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    downloadCount: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    entityId: Schema.Attribute.String;
    entityType: Schema.Attribute.String;
    extension: Schema.Attribute.String;
    fileName: Schema.Attribute.String & Schema.Attribute.Required;
    isDeleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    isPublic: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    lastAccessAt: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::file-asset.file-asset'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    mimeType: Schema.Attribute.String;
    moduleKey: Schema.Attribute.String & Schema.Attribute.Required;
    originalName: Schema.Attribute.String & Schema.Attribute.Required;
    provider: Schema.Attribute.Enumeration<
      ['local', 's3', 'minio', 'wasabi', 'azure', 'gcs']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'local'>;
    publishedAt: Schema.Attribute.DateTime;
    relativePath: Schema.Attribute.String & Schema.Attribute.Required;
    size: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'0'>;
    status: Schema.Attribute.Enumeration<['ACTIVE', 'DELETED', 'ARCHIVED']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'ACTIVE'>;
    storageConfig: Schema.Attribute.Relation<
      'manyToOne',
      'api::tenant-storage.tenant-storage'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    uploadedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ApiFitnessChallengeFitnessChallenge
  extends Struct.CollectionTypeSchema {
  collectionName: 'fitness_challenges';
  info: {
    description: 'Tenant-scoped configuration for a sports or wellness challenge.';
    displayName: 'Fitness Challenge';
    pluralName: 'fitness-challenges';
    singularName: 'fitness-challenge';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activityAcceptMode: Schema.Attribute.Enumeration<
      ['AUTO_ACCEPT', 'USER_CONFIRM', 'MANUAL_SUBMIT']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'USER_CONFIRM'>;
    allowReuseActivity: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    challengeActivities: Schema.Attribute.Relation<
      'oneToMany',
      'api::challenge-activity.challenge-activity'
    >;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    coverImageUrl: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    endAt: Schema.Attribute.DateTime;
    goalUnit: Schema.Attribute.String;
    goalValue: Schema.Attribute.Decimal;
    isPublic: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    leaderboardMode: Schema.Attribute.Enumeration<
      ['TOTAL', 'BEST_ACTIVITY', 'FIRST_FINISH']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'TOTAL'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::fitness-challenge.fitness-challenge'
    > &
      Schema.Attribute.Private;
    maxParticipants: Schema.Attribute.Integer;
    metric: Schema.Attribute.Enumeration<
      ['DISTANCE', 'MOVING_TIME', 'ELEVATION_GAIN', 'ACTIVITY_COUNT']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'DISTANCE'>;
    participants: Schema.Attribute.Relation<
      'oneToMany',
      'api::challenge-participant.challenge-participant'
    >;
    publishedAt: Schema.Attribute.DateTime;
    requireAdminReview: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    rulesText: Schema.Attribute.Text;
    slug: Schema.Attribute.String;
    sportTypes: Schema.Attribute.JSON;
    startAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['DRAFT', 'PUBLISHED', 'ACTIVE', 'FINISHED', 'CANCELLED']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'DRAFT'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    visibility: Schema.Attribute.Enumeration<['PRIVATE', 'TENANT', 'PUBLIC']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'TENANT'>;
  };
}

export interface ApiFormTemplateFormTemplate
  extends Struct.CollectionTypeSchema {
  collectionName: 'form_templates';
  info: {
    description: 'Tenant-scoped versioned dynamic form templates.';
    displayName: 'FormTemplate';
    pluralName: 'form-templates';
    singularName: 'form-template';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    campaigns: Schema.Attribute.Relation<'oneToMany', 'api::campaign.campaign'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    formTemplateStatus: Schema.Attribute.Enumeration<
      ['draft', 'published', 'archived']
    > &
      Schema.Attribute.DefaultTo<'draft'>;
    isLocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    leadCampaigns: Schema.Attribute.Relation<
      'oneToMany',
      'api::lead-campaign.lead-campaign'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::form-template.form-template'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    schema: Schema.Attribute.JSON & Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Integer & Schema.Attribute.Required;
  };
}

export interface ApiFormulaFormula extends Struct.CollectionTypeSchema {
  collectionName: 'formulas';
  info: {
    description: 'Tenant-scoped formulas and symbolic knowledge.';
    displayName: 'Formula';
    pluralName: 'formulas';
    singularName: 'formula';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required;
    contentBlocks: Schema.Attribute.Relation<
      'oneToMany',
      'api::content-block.content-block'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    examples: Schema.Attribute.JSON;
    formulaStatus: Schema.Attribute.Enumeration<['active', 'archived']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    grade: Schema.Attribute.Relation<'manyToOne', 'api::grade.grade'>;
    knowledgeNode: Schema.Attribute.Relation<
      'manyToOne',
      'api::knowledge-node.knowledge-node'
    >;
    latex: Schema.Attribute.Text;
    learningObjects: Schema.Attribute.Relation<
      'manyToMany',
      'api::learning-object.learning-object'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::formula.formula'
    > &
      Schema.Attribute.Private;
    plainText: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    questions: Schema.Attribute.Relation<
      'manyToMany',
      'api::question.question'
    >;
    subject: Schema.Attribute.Relation<'manyToOne', 'api::subject.subject'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiGlobalGlobal extends Struct.SingleTypeSchema {
  collectionName: 'globals';
  info: {
    description: 'Define global settings';
    displayName: 'Global';
    pluralName: 'globals';
    singularName: 'global';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultSeo: Schema.Attribute.Component<'shared.seo', false>;
    favicon: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::global.global'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    siteDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    siteName: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiGradeGrade extends Struct.CollectionTypeSchema {
  collectionName: 'grades';
  info: {
    description: 'Tenant-scoped grade taxonomy.';
    displayName: 'Grade';
    pluralName: 'grades';
    singularName: 'grade';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    formulas: Schema.Attribute.Relation<'oneToMany', 'api::formula.formula'>;
    gradeStatus: Schema.Attribute.Enumeration<['active', 'archived']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    knowledgeNodes: Schema.Attribute.Relation<
      'oneToMany',
      'api::knowledge-node.knowledge-node'
    >;
    learningObjects: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-object.learning-object'
    >;
    learningPaths: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-path.learning-path'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::grade.grade'> &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    questions: Schema.Attribute.Relation<'oneToMany', 'api::question.question'>;
    skills: Schema.Attribute.Relation<'oneToMany', 'api::skill.skill'>;
    studentLearningProfiles: Schema.Attribute.Relation<
      'oneToMany',
      'api::student-learning-profile.student-learning-profile'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    visualAssets: Schema.Attribute.Relation<
      'oneToMany',
      'api::visual-asset.visual-asset'
    >;
  };
}

export interface ApiJournalCategoryJournalCategory
  extends Struct.CollectionTypeSchema {
  collectionName: 'journal_categories';
  info: {
    description: 'Tenant-scoped master data for journal issue categories.';
    displayName: 'JournalCategory';
    pluralName: 'journal-categories';
    singularName: 'journal-category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    journalIssues: Schema.Attribute.Relation<
      'oneToMany',
      'api::journal-issue.journal-issue'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::journal-category.journal-category'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'title'> & Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiJournalIssueItemJournalIssueItem
  extends Struct.CollectionTypeSchema {
  collectionName: 'journal_issue_items';
  info: {
    description: 'Tenant-scoped table-of-contents rows for a journal issue.';
    displayName: 'JournalIssueItem';
    pluralName: 'journal-issue-items';
    singularName: 'journal-issue-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    article: Schema.Attribute.Relation<'manyToOne', 'api::article.article'>;
    articleTitle: Schema.Attribute.String & Schema.Attribute.Required;
    authorsText: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    doi: Schema.Attribute.String;
    endPage: Schema.Attribute.Integer;
    journalIssue: Schema.Attribute.Relation<
      'manyToOne',
      'api::journal-issue.journal-issue'
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::journal-issue-item.journal-issue-item'
    > &
      Schema.Attribute.Private;
    orderNo: Schema.Attribute.Integer & Schema.Attribute.Required;
    pageText: Schema.Attribute.String;
    pdfFile: Schema.Attribute.Media<'files'>;
    publishedAt: Schema.Attribute.DateTime;
    startPage: Schema.Attribute.Integer;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiJournalIssueJournalIssue
  extends Struct.CollectionTypeSchema {
  collectionName: 'journal_issues';
  info: {
    description: 'Tenant-scoped journal issues for the public journal module.';
    displayName: 'JournalIssue';
    pluralName: 'journal-issues';
    singularName: 'journal-issue';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    coverImage: Schema.Attribute.Media<'images'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    issueItems: Schema.Attribute.Relation<
      'oneToMany',
      'api::journal-issue-item.journal-issue-item'
    >;
    issueNumber: Schema.Attribute.String & Schema.Attribute.Required;
    journalCategory: Schema.Attribute.Relation<
      'manyToOne',
      'api::journal-category.journal-category'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::journal-issue.journal-issue'
    > &
      Schema.Attribute.Private;
    pdfFile: Schema.Attribute.Media<'files'>;
    publicAt: Schema.Attribute.DateTime;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'title'> & Schema.Attribute.Required;
    summary: Schema.Attribute.RichText;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    volume: Schema.Attribute.String;
    year: Schema.Attribute.Integer & Schema.Attribute.Required;
  };
}

export interface ApiKnowledgeNodeKnowledgeNode
  extends Struct.CollectionTypeSchema {
  collectionName: 'knowledge_nodes';
  info: {
    description: 'Tenant-scoped knowledge tree node.';
    displayName: 'Knowledge Node';
    pluralName: 'knowledge-nodes';
    singularName: 'knowledge-node';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    children: Schema.Attribute.Relation<
      'oneToMany',
      'api::knowledge-node.knowledge-node'
    >;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    formulas: Schema.Attribute.Relation<'oneToMany', 'api::formula.formula'>;
    grade: Schema.Attribute.Relation<'manyToOne', 'api::grade.grade'>;
    knowledgeNodeStatus: Schema.Attribute.Enumeration<['active', 'archived']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    learningObjects: Schema.Attribute.Relation<
      'manyToMany',
      'api::learning-object.learning-object'
    >;
    level: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::knowledge-node.knowledge-node'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    parent: Schema.Attribute.Relation<
      'manyToOne',
      'api::knowledge-node.knowledge-node'
    >;
    publishedAt: Schema.Attribute.DateTime;
    questions: Schema.Attribute.Relation<'oneToMany', 'api::question.question'>;
    skills: Schema.Attribute.Relation<'oneToMany', 'api::skill.skill'>;
    subject: Schema.Attribute.Relation<'manyToOne', 'api::subject.subject'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    visualAssets: Schema.Attribute.Relation<
      'oneToMany',
      'api::visual-asset.visual-asset'
    >;
  };
}

export interface ApiLeadActivityLeadActivity
  extends Struct.CollectionTypeSchema {
  collectionName: 'lead_activities';
  info: {
    description: 'Tenant-scoped care and audit activities for captured leads.';
    displayName: 'LeadActivity';
    pluralName: 'lead-activities';
    singularName: 'lead-activity';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activityAt: Schema.Attribute.DateTime;
    actor: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    content: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    lead: Schema.Attribute.Relation<
      'manyToOne',
      'api::lead-capture.lead-capture'
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::lead-activity.lead-activity'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    newStatus: Schema.Attribute.String;
    oldStatus: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<
      [
        'note',
        'call',
        'sms',
        'email',
        'zalo',
        'status_change',
        'assign',
        'convert',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'note'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiLeadCampaignLeadCampaign
  extends Struct.CollectionTypeSchema {
  collectionName: 'lead_campaigns';
  info: {
    description: 'Tenant-scoped marketing campaigns for public lead capture forms.';
    displayName: 'LeadCampaign';
    pluralName: 'lead-campaigns';
    singularName: 'lead-campaign';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    autoReplyEnabled: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    autoReplyHtml: Schema.Attribute.RichText;
    autoReplySubject: Schema.Attribute.String;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    endDate: Schema.Attribute.DateTime;
    formTemplate: Schema.Attribute.Relation<
      'manyToOne',
      'api::form-template.form-template'
    >;
    internalNotifyEmails: Schema.Attribute.JSON;
    internalNotifyEnabled: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    isDeleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    leadCampaignStatus: Schema.Attribute.Enumeration<
      ['draft', 'active', 'paused', 'closed', 'archived']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    leads: Schema.Attribute.Relation<
      'oneToMany',
      'api::lead-capture.lead-capture'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::lead-campaign.lead-campaign'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publicPages: Schema.Attribute.Relation<
      'oneToMany',
      'api::public-page.public-page'
    >;
    publishedAt: Schema.Attribute.DateTime;
    startDate: Schema.Attribute.DateTime;
    submitButtonText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'\u0110\u0103ng k\u00FD'>;
    successMessage: Schema.Attribute.Text;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiLeadCaptureLeadCapture extends Struct.CollectionTypeSchema {
  collectionName: 'lead_captures';
  info: {
    description: 'Tenant-scoped submitted lead records captured from dynamic forms.';
    displayName: 'Lead';
    pluralName: 'lead-captures';
    singularName: 'lead-capture';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activities: Schema.Attribute.Relation<
      'oneToMany',
      'api::lead-activity.lead-activity'
    >;
    assignedAt: Schema.Attribute.DateTime;
    assignedTo: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    campaign: Schema.Attribute.Relation<
      'manyToOne',
      'api::lead-campaign.lead-campaign'
    > &
      Schema.Attribute.Required;
    contactedAt: Schema.Attribute.DateTime;
    convertedAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    data: Schema.Attribute.JSON & Schema.Attribute.Required;
    email: Schema.Attribute.Email;
    fullName: Schema.Attribute.String;
    ipAddress: Schema.Attribute.String;
    isDeleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    leadStatus: Schema.Attribute.Enumeration<
      ['new', 'contacted', 'qualified', 'converted', 'lost', 'spam']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'new'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::lead-capture.lead-capture'
    > &
      Schema.Attribute.Private;
    lostReason: Schema.Attribute.Text;
    note: Schema.Attribute.Text;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    referrer: Schema.Attribute.Text;
    source: Schema.Attribute.String;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userAgent: Schema.Attribute.Text;
  };
}

export interface ApiLeadLead extends Struct.CollectionTypeSchema {
  collectionName: 'leads';
  info: {
    displayName: 'Lead';
    pluralName: 'leads';
    singularName: 'lead';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    channel: Schema.Attribute.Enumeration<
      ['web', 'zalo', 'facebook', 'phone', 'other']
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    fromAt: Schema.Attribute.DateTime;
    fullName: Schema.Attribute.String;
    leadStatus: Schema.Attribute.Enumeration<
      ['new', 'processing', 'contacted', 'closed', 'spam']
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::lead.lead'> &
      Schema.Attribute.Private;
    message: Schema.Attribute.String;
    noteInternal: Schema.Attribute.Text;
    pageUrl: Schema.Attribute.String;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    toAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vehicle: Schema.Attribute.Relation<'manyToOne', 'api::vehicle.vehicle'>;
    vehicleType: Schema.Attribute.Relation<
      'manyToOne',
      'api::vehicle-type.vehicle-type'
    >;
  };
}

export interface ApiLearnerLearner extends Struct.CollectionTypeSchema {
  collectionName: 'learners';
  info: {
    description: 'Tenant-scoped learners linked to an optional parent account.';
    displayName: 'Learner';
    pluralName: 'learners';
    singularName: 'learner';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dateOfBirth: Schema.Attribute.Date;
    enrollments: Schema.Attribute.Relation<
      'oneToMany',
      'api::enrollment.enrollment'
    >;
    feeItems: Schema.Attribute.Relation<'oneToMany', 'api::fee-item.fee-item'>;
    fullName: Schema.Attribute.String & Schema.Attribute.Required;
    learnerStatus: Schema.Attribute.Enumeration<['active', 'inactive']> &
      Schema.Attribute.DefaultTo<'active'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::learner.learner'
    > &
      Schema.Attribute.Private;
    oldUserId: Schema.Attribute.String;
    parentName: Schema.Attribute.String;
    parentPhone: Schema.Attribute.String;
    payments: Schema.Attribute.Relation<'oneToMany', 'api::payment.payment'>;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiLearningObjectLearningObject
  extends Struct.CollectionTypeSchema {
  collectionName: 'learning_objects';
  info: {
    description: 'Tenant-scoped reusable learning object.';
    displayName: 'Learning Object';
    pluralName: 'learning-objects';
    singularName: 'learning-object';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required;
    contentBlocks: Schema.Attribute.Relation<
      'oneToMany',
      'api::content-block.content-block'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dependentLearningObjects: Schema.Attribute.Relation<
      'manyToMany',
      'api::learning-object.learning-object'
    >;
    description: Schema.Attribute.Text;
    difficulty: Schema.Attribute.Enumeration<['easy', 'medium', 'hard']>;
    estimatedMinutes: Schema.Attribute.Integer;
    formulas: Schema.Attribute.Relation<'manyToMany', 'api::formula.formula'>;
    grade: Schema.Attribute.Relation<'manyToOne', 'api::grade.grade'>;
    knowledgeNodes: Schema.Attribute.Relation<
      'manyToMany',
      'api::knowledge-node.knowledge-node'
    >;
    learningObjectives: Schema.Attribute.JSON;
    learningObjectStatus: Schema.Attribute.Enumeration<
      ['draft', 'active', 'archived']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    learningPathItems: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-path-item.learning-path-item'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-object.learning-object'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    prerequisites: Schema.Attribute.Relation<
      'manyToMany',
      'api::learning-object.learning-object'
    >;
    publishedAt: Schema.Attribute.DateTime;
    questions: Schema.Attribute.Relation<
      'manyToMany',
      'api::question.question'
    >;
    skills: Schema.Attribute.Relation<'manyToMany', 'api::skill.skill'>;
    slug: Schema.Attribute.UID<'title'> & Schema.Attribute.Required;
    studentProgressRecords: Schema.Attribute.Relation<
      'oneToMany',
      'api::student-learning-object-progress.student-learning-object-progress'
    >;
    subject: Schema.Attribute.Relation<'manyToOne', 'api::subject.subject'>;
    tags: Schema.Attribute.JSON;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.String;
    visualAssets: Schema.Attribute.Relation<
      'manyToMany',
      'api::visual-asset.visual-asset'
    >;
  };
}

export interface ApiLearningPathItemLearningPathItem
  extends Struct.CollectionTypeSchema {
  collectionName: 'learning_path_items';
  info: {
    description: 'Tenant-scoped ordered item inside a learning path.';
    displayName: 'Learning Path Item';
    pluralName: 'learning-path-items';
    singularName: 'learning-path-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    learningObject: Schema.Attribute.Relation<
      'manyToOne',
      'api::learning-object.learning-object'
    > &
      Schema.Attribute.Required;
    learningPath: Schema.Attribute.Relation<
      'manyToOne',
      'api::learning-path.learning-path'
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-path-item.learning-path-item'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    required: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    unlockCondition: Schema.Attribute.JSON;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiLearningPathLearningPath
  extends Struct.CollectionTypeSchema {
  collectionName: 'learning_paths';
  info: {
    description: 'Tenant-scoped ordered learning path.';
    displayName: 'Learning Path';
    pluralName: 'learning-paths';
    singularName: 'learning-path';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    grade: Schema.Attribute.Relation<'manyToOne', 'api::grade.grade'>;
    items: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-path-item.learning-path-item'
    >;
    learningPathStatus: Schema.Attribute.Enumeration<
      ['draft', 'active', 'archived']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-path.learning-path'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    subject: Schema.Attribute.Relation<'manyToOne', 'api::subject.subject'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMailLogMailLog extends Struct.CollectionTypeSchema {
  collectionName: 'mail_logs';
  info: {
    description: 'Queued and delivered email audit log.';
    displayName: 'MailLog';
    pluralName: 'mail-logs';
    singularName: 'mail-log';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    attempts: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    bcc: Schema.Attribute.JSON;
    cc: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    failedAt: Schema.Attribute.DateTime;
    fallbackError: Schema.Attribute.Text;
    fallbackProvider: Schema.Attribute.String;
    html: Schema.Attribute.Text;
    lastError: Schema.Attribute.Text;
    lastProviderError: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::mail-log.mail-log'
    > &
      Schema.Attribute.Private;
    mailType: Schema.Attribute.String & Schema.Attribute.Required;
    metadata: Schema.Attribute.JSON;
    provider: Schema.Attribute.String;
    providerMessageId: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    queuedAt: Schema.Attribute.DateTime;
    replyTo: Schema.Attribute.String;
    sendStatus: Schema.Attribute.Enumeration<
      ['QUEUED', 'SENDING', 'SENT', 'FAILED', 'RETRYING', 'CANCELLED']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'QUEUED'>;
    sentAt: Schema.Attribute.DateTime;
    subject: Schema.Attribute.String & Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'>;
    text: Schema.Attribute.Text;
    toEmail: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNotificationTemplateNotificationTemplate
  extends Struct.CollectionTypeSchema {
  collectionName: 'notification_templates';
  info: {
    description: 'Tenant-scoped notification templates for admission invite, OTP, and result messages.';
    displayName: 'NotificationTemplate';
    pluralName: 'notification-templates';
    singularName: 'notification-template';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required;
    content: Schema.Attribute.RichText & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::notification-template.notification-template'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    subject: Schema.Attribute.String & Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<['email', 'sms', 'ui']> &
      Schema.Attribute.DefaultTo<'email'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    variables: Schema.Attribute.JSON;
  };
}

export interface ApiPaymentAllocationPaymentAllocation
  extends Struct.CollectionTypeSchema {
  collectionName: 'payment_allocations';
  info: {
    description: 'Allocation of learner payments to fee items.';
    displayName: 'Payment Allocation';
    pluralName: 'payment-allocations';
    singularName: 'payment-allocation';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    feeItem: Schema.Attribute.Relation<'manyToOne', 'api::fee-item.fee-item'> &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment-allocation.payment-allocation'
    > &
      Schema.Attribute.Private;
    payment: Schema.Attribute.Relation<'manyToOne', 'api::payment.payment'> &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPaymentTransactionPaymentTransaction
  extends Struct.CollectionTypeSchema {
  collectionName: 'payment_transactions';
  info: {
    displayName: 'Payment Transaction';
    pluralName: 'payment-transactions';
    singularName: 'payment-transaction';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
    collectedBy: Schema.Attribute.Relation<
      'manyToOne',
      'api::employee.employee'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'manyToOne', 'api::customer.customer'>;
    department: Schema.Attribute.Relation<
      'manyToOne',
      'api::department.department'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment-transaction.payment-transaction'
    > &
      Schema.Attribute.Private;
    method: Schema.Attribute.Enumeration<
      ['CASH', 'TRANSFER', 'MOMO', 'OTHER']
    > &
      Schema.Attribute.DefaultTo<'CASH'>;
    note: Schema.Attribute.Text;
    order: Schema.Attribute.Relation<
      'manyToOne',
      'api::service-order.service-order'
    >;
    paidAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPaymentPayment extends Struct.CollectionTypeSchema {
  collectionName: 'payments';
  info: {
    description: 'Tenant-scoped learner payment records.';
    displayName: 'Payment';
    pluralName: 'payments';
    singularName: 'payment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allocations: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment-allocation.payment-allocation'
    >;
    amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'> &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment.payment'
    > &
      Schema.Attribute.Private;
    method: Schema.Attribute.Enumeration<['cash', 'transfer', 'other']> &
      Schema.Attribute.DefaultTo<'cash'>;
    note: Schema.Attribute.Text;
    paymentDate: Schema.Attribute.DateTime & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPlatformSettingPlatformSetting
  extends Struct.CollectionTypeSchema {
  collectionName: 'platform_settings';
  info: {
    description: 'Global platform-level configuration entries';
    displayName: 'Platform Setting';
    pluralName: 'platform-settings';
    singularName: 'platform-setting';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dataType: Schema.Attribute.String;
    description: Schema.Attribute.Text;
    group: Schema.Attribute.String;
    key: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::platform-setting.platform-setting'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.String & Schema.Attribute.DefaultTo<'active'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    value: Schema.Attribute.JSON;
  };
}

export interface ApiPositionPosition extends Struct.CollectionTypeSchema {
  collectionName: 'positions';
  info: {
    displayName: 'Position';
    pluralName: 'positions';
    singularName: 'position';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    isLeadership: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    level: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<1>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::position.position'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPublicPagePublicPage extends Struct.CollectionTypeSchema {
  collectionName: 'public_pages';
  info: {
    description: 'Tenant-scoped public landing/content pages rendered in the shared public layout.';
    displayName: 'PublicPage';
    pluralName: 'public-pages';
    singularName: 'public-page';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    contentHtml: Schema.Attribute.RichText;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deletedAt: Schema.Attribute.DateTime;
    deletedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    deleteReason: Schema.Attribute.Text;
    isDeleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    leadCampaign: Schema.Attribute.Relation<
      'manyToOne',
      'api::lead-campaign.lead-campaign'
    >;
    leadFormPosition: Schema.Attribute.Enumeration<
      ['top', 'bottom', 'shortcode']
    > &
      Schema.Attribute.DefaultTo<'bottom'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::public-page.public-page'
    > &
      Schema.Attribute.Private;
    pageType: Schema.Attribute.Enumeration<
      ['page', 'landing', 'lead', 'thank_you', 'default_page']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'page'>;
    publicPageStatus: Schema.Attribute.Enumeration<
      ['draft', 'published', 'archived']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    publishedAt: Schema.Attribute.DateTime;
    restoredAt: Schema.Attribute.DateTime;
    restoredBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    restoreReason: Schema.Attribute.Text;
    seoDescription: Schema.Attribute.Text;
    seoImage: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    seoKeywords: Schema.Attribute.Text;
    seoTitle: Schema.Attribute.String;
    slug: Schema.Attribute.String & Schema.Attribute.Required;
    summary: Schema.Attribute.Text;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiQuestionOptionQuestionOption
  extends Struct.CollectionTypeSchema {
  collectionName: 'question_options';
  info: {
    description: 'Tenant-scoped answer option for a question.';
    displayName: 'Question Option';
    pluralName: 'question-options';
    singularName: 'question-option';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    content: Schema.Attribute.RichText;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    explanation: Schema.Attribute.Text;
    isCorrect: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::question-option.question-option'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    question: Schema.Attribute.Relation<'manyToOne', 'api::question.question'> &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    value: Schema.Attribute.String;
  };
}

export interface ApiQuestionQuestion extends Struct.CollectionTypeSchema {
  collectionName: 'questions';
  info: {
    description: 'Tenant-scoped learning assessment question bank.';
    displayName: 'Question';
    pluralName: 'questions';
    singularName: 'question';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required;
    contentBlocks: Schema.Attribute.Relation<
      'oneToMany',
      'api::content-block.content-block'
    >;
    correctAnswer: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    difficulty: Schema.Attribute.Enumeration<['easy', 'medium', 'hard']>;
    explanation: Schema.Attribute.RichText;
    formulas: Schema.Attribute.Relation<'manyToMany', 'api::formula.formula'>;
    grade: Schema.Attribute.Relation<'manyToOne', 'api::grade.grade'>;
    knowledgeNode: Schema.Attribute.Relation<
      'manyToOne',
      'api::knowledge-node.knowledge-node'
    >;
    learningObjects: Schema.Attribute.Relation<
      'manyToMany',
      'api::learning-object.learning-object'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::question.question'
    > &
      Schema.Attribute.Private;
    options: Schema.Attribute.Relation<
      'oneToMany',
      'api::question-option.question-option'
    >;
    publishedAt: Schema.Attribute.DateTime;
    questionStatus: Schema.Attribute.Enumeration<
      ['draft', 'active', 'archived']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    questionText: Schema.Attribute.RichText & Schema.Attribute.Required;
    rubric: Schema.Attribute.JSON;
    skills: Schema.Attribute.Relation<'manyToMany', 'api::skill.skill'>;
    subject: Schema.Attribute.Relation<'manyToOne', 'api::subject.subject'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<
      [
        'single_choice',
        'multiple_choice',
        'true_false',
        'short_answer',
        'essay',
        'ordering',
        'matching',
        'fill_blank',
      ]
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiRequestAssigneeRequestAssignee
  extends Struct.CollectionTypeSchema {
  collectionName: 'request_assignees';
  info: {
    displayName: 'RequestAssignee';
    pluralName: 'request-assignees';
    singularName: 'request-assignee';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    acceptedAt: Schema.Attribute.DateTime;
    assignedAt: Schema.Attribute.DateTime;
    assignedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    doneAt: Schema.Attribute.DateTime;
    dueAt: Schema.Attribute.DateTime;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::request-assignee.request-assignee'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    progress: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    removedAt: Schema.Attribute.DateTime;
    request: Schema.Attribute.Relation<'manyToOne', 'api::request.request'>;
    requestAssigneeStatus: Schema.Attribute.Enumeration<
      ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'REJECTED']
    >;
    roleType: Schema.Attribute.Enumeration<['ASSIGNEE', 'OBSERVER']>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    weight: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
  };
}

export interface ApiRequestCategoryRequestCategory
  extends Struct.CollectionTypeSchema {
  collectionName: 'request_categories';
  info: {
    displayName: 'RequestCategory';
    pluralName: 'request-categories';
    singularName: 'request-category';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    children: Schema.Attribute.Relation<
      'oneToMany',
      'api::request-category.request-category'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    isActive: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::request-category.request-category'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    parent: Schema.Attribute.Relation<
      'manyToOne',
      'api::request-category.request-category'
    >;
    publishedAt: Schema.Attribute.DateTime;
    requests: Schema.Attribute.Relation<'oneToMany', 'api::request.request'>;
    slug: Schema.Attribute.UID<'name'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiRequestMessageRequestMessage
  extends Struct.CollectionTypeSchema {
  collectionName: 'request_messages';
  info: {
    displayName: 'RequestMessage';
    pluralName: 'request-messages';
    singularName: 'request-message';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    attachments: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    author: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    content: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    linksText: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::request-message.request-message'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    request: Schema.Attribute.Relation<'manyToOne', 'api::request.request'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    visibility: Schema.Attribute.Boolean;
    visible_to_users: Schema.Attribute.Relation<
      'manyToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiRequestTagRequestTag extends Struct.CollectionTypeSchema {
  collectionName: 'request_tags';
  info: {
    displayName: 'RequestTag';
    pluralName: 'request-tags';
    singularName: 'request-tag';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    group: Schema.Attribute.Enumeration<
      ['PRIORITY', 'PROJECT', 'VENDOR', 'RISK', 'CUSTOM']
    >;
    isActive: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::request-tag.request-tag'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    requests: Schema.Attribute.Relation<'manyToMany', 'api::request.request'>;
    slug: Schema.Attribute.UID<'name'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiRequestRequest extends Struct.CollectionTypeSchema {
  collectionName: 'requests';
  info: {
    displayName: 'Request';
    pluralName: 'requests';
    singularName: 'request';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amountApproved: Schema.Attribute.Decimal;
    amountProposed: Schema.Attribute.Decimal;
    attachments: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    closedAt: Schema.Attribute.DateTime;
    closedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    closedDecision: Schema.Attribute.Enumeration<['APPROVED', 'REJECTED']>;
    closeNote: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.Enumeration<['VND', 'USD']>;
    departmentContext: Schema.Attribute.Relation<
      'manyToOne',
      'api::department.department'
    >;
    description: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::request.request'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    request_assignees: Schema.Attribute.Relation<
      'oneToMany',
      'api::request-assignee.request-assignee'
    >;
    request_category: Schema.Attribute.Relation<
      'manyToOne',
      'api::request-category.request-category'
    >;
    request_messages: Schema.Attribute.Relation<
      'oneToMany',
      'api::request-message.request-message'
    >;
    request_tags: Schema.Attribute.Relation<
      'manyToMany',
      'api::request-tag.request-tag'
    >;
    requester: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    requestStatus: Schema.Attribute.Enumeration<
      ['OPEN', 'IN_PROGRESS', 'WAITING', 'DONE', 'CLOSED', 'CANCELLED']
    >;
    submittedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'>;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    visibilityMode: Schema.Attribute.Enumeration<['COLLABORATIVE', 'PRIVATE']>;
    watchers: Schema.Attribute.Relation<
      'manyToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiRoleFeatureRoleFeature extends Struct.CollectionTypeSchema {
  collectionName: 'role_features';
  info: {
    description: 'Maps users-permissions roles to business features';
    displayName: 'Role Feature';
    pluralName: 'role-features';
    singularName: 'role-feature';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    feature: Schema.Attribute.Relation<'manyToOne', 'api::feature.feature'> &
      Schema.Attribute.Required;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::role-feature.role-feature'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiServiceCategoryServiceCategory
  extends Struct.CollectionTypeSchema {
  collectionName: 'service_categories';
  info: {
    displayName: 'Service Category';
    pluralName: 'service-categories';
    singularName: 'service-category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::service-category.service-category'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    service_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::service-item.service-item'
    >;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiServiceItemServiceItem extends Struct.CollectionTypeSchema {
  collectionName: 'service_items';
  info: {
    displayName: 'Service Item';
    pluralName: 'service-items';
    singularName: 'service-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    category: Schema.Attribute.Relation<
      'manyToOne',
      'api::service-category.service-category'
    >;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultPrice: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    description: Schema.Attribute.Text;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::service-item.service-item'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    service_order_items: Schema.Attribute.Relation<
      'oneToMany',
      'api::service-order-item.service-order-item'
    >;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    unit: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiServiceOrderItemServiceOrderItem
  extends Struct.CollectionTypeSchema {
  collectionName: 'service_order_items';
  info: {
    displayName: 'Service Order Item';
    pluralName: 'service-order-items';
    singularName: 'service-order-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    attachments: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::service-order-item.service-order-item'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    order: Schema.Attribute.Relation<
      'manyToOne',
      'api::service-order.service-order'
    >;
    publishedAt: Schema.Attribute.DateTime;
    quantity: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<1>;
    serviceItem: Schema.Attribute.Relation<
      'manyToOne',
      'api::service-item.service-item'
    >;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    unitPrice: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiServiceOrderServiceOrder
  extends Struct.CollectionTypeSchema {
  collectionName: 'service_orders';
  info: {
    displayName: 'Service Order';
    pluralName: 'service-orders';
    singularName: 'service-order';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assignedEmployee: Schema.Attribute.Relation<
      'manyToOne',
      'api::employee.employee'
    >;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'manyToOne', 'api::customer.customer'>;
    debtAmount: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    deliveredAt: Schema.Attribute.DateTime;
    department: Schema.Attribute.Relation<
      'manyToOne',
      'api::department.department'
    >;
    description: Schema.Attribute.Text;
    items: Schema.Attribute.Relation<
      'oneToMany',
      'api::service-order-item.service-order-item'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::service-order.service-order'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    orderDate: Schema.Attribute.DateTime & Schema.Attribute.Required;
    paidAmount: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    payments: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment-transaction.payment-transaction'
    >;
    paymentStatus: Schema.Attribute.Enumeration<['UNPAID', 'PARTIAL', 'PAID']> &
      Schema.Attribute.DefaultTo<'UNPAID'>;
    publishedAt: Schema.Attribute.DateTime;
    serviceOrderStatus: Schema.Attribute.Enumeration<
      ['NEW', 'PROCESSING', 'READY', 'DELIVERED', 'CANCELLED']
    > &
      Schema.Attribute.DefaultTo<'NEW'>;
    source: Schema.Attribute.Enumeration<
      ['ZALO', 'DIRECT', 'PHONE', 'FACEBOOK', 'OTHER']
    > &
      Schema.Attribute.DefaultTo<'DIRECT'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    totalAmount: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSettingSetting extends Struct.SingleTypeSchema {
  collectionName: 'settings';
  info: {
    displayName: 'Setting';
    pluralName: 'settings';
    singularName: 'setting';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    address: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultVehicleImage: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios'
    >;
    defaultVehicleTypeCover: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios'
    >;
    facebookPage: Schema.Attribute.String;
    favicon: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    ga4Id: Schema.Attribute.String;
    heroBadge: Schema.Attribute.String;
    heroCtas: Schema.Attribute.JSON;
    heroDesc: Schema.Attribute.Blocks;
    heroImages: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    heroTitle: Schema.Attribute.String;
    hotline: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::setting.setting'
    > &
      Schema.Attribute.Private;
    logo: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    metaPixelId: Schema.Attribute.String;
    ogImage: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    publishedAt: Schema.Attribute.DateTime;
    seoDescription: Schema.Attribute.String;
    seoKeywords: Schema.Attribute.String;
    seoTitle: Schema.Attribute.String;
    siteName: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workingHours: Schema.Attribute.String;
    zaloLink: Schema.Attribute.String;
    zaloPhone: Schema.Attribute.String;
  };
}

export interface ApiSkillSkill extends Struct.CollectionTypeSchema {
  collectionName: 'skills';
  info: {
    description: 'Tenant-scoped learning skill graph.';
    displayName: 'Skill';
    pluralName: 'skills';
    singularName: 'skill';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    childSkills: Schema.Attribute.Relation<'oneToMany', 'api::skill.skill'>;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    grade: Schema.Attribute.Relation<'manyToOne', 'api::grade.grade'>;
    knowledgeNode: Schema.Attribute.Relation<
      'manyToOne',
      'api::knowledge-node.knowledge-node'
    >;
    learningObjects: Schema.Attribute.Relation<
      'manyToMany',
      'api::learning-object.learning-object'
    >;
    level: Schema.Attribute.Enumeration<
      ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::skill.skill'> &
      Schema.Attribute.Private;
    parentSkill: Schema.Attribute.Relation<'manyToOne', 'api::skill.skill'>;
    publishedAt: Schema.Attribute.DateTime;
    questions: Schema.Attribute.Relation<
      'manyToMany',
      'api::question.question'
    >;
    skillStatus: Schema.Attribute.Enumeration<['active', 'archived']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    studentSkillProgressRecords: Schema.Attribute.Relation<
      'oneToMany',
      'api::student-skill-progress.student-skill-progress'
    >;
    subject: Schema.Attribute.Relation<'manyToOne', 'api::subject.subject'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSliderItemSliderItem extends Struct.CollectionTypeSchema {
  collectionName: 'slider_items';
  info: {
    description: 'Items belonging to a tenant slider';
    displayName: 'SliderItem';
    pluralName: 'slider-items';
    singularName: 'slider-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Media<'images'>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    link: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::slider-item.slider-item'
    > &
      Schema.Attribute.Private;
    openInNewTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    showDescription: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showTitle: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    slider: Schema.Attribute.Relation<'manyToOne', 'api::slider.slider'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSliderSlider extends Struct.CollectionTypeSchema {
  collectionName: 'sliders';
  info: {
    description: 'Tenant-scoped slider configuration';
    displayName: 'Slider';
    pluralName: 'sliders';
    singularName: 'slider';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    interval: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    items: Schema.Attribute.Relation<
      'oneToMany',
      'api::slider-item.slider-item'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::slider.slider'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiStravaActivityStravaActivity
  extends Struct.CollectionTypeSchema {
  collectionName: 'strava_activities';
  info: {
    description: 'Tenant-scoped activity snapshot synchronized from Strava for a user.';
    displayName: 'Strava Activity';
    pluralName: 'strava-activities';
    singularName: 'strava-activity';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    achievementCount: Schema.Attribute.Integer;
    averageHeartrate: Schema.Attribute.Decimal;
    averageSpeed: Schema.Attribute.Decimal;
    calories: Schema.Attribute.Decimal;
    challengeActivities: Schema.Attribute.Relation<
      'oneToMany',
      'api::challenge-activity.challenge-activity'
    >;
    connection: Schema.Attribute.Relation<
      'manyToOne',
      'api::strava-connection.strava-connection'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    distance: Schema.Attribute.Decimal;
    elapsedTime: Schema.Attribute.Integer;
    hasMap: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    kudosCount: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-activity.strava-activity'
    > &
      Schema.Attribute.Private;
    locationCity: Schema.Attribute.String;
    locationCountry: Schema.Attribute.String;
    mapSummaryPolyline: Schema.Attribute.Text & Schema.Attribute.Private;
    maxHeartrate: Schema.Attribute.Decimal;
    maxSpeed: Schema.Attribute.Decimal;
    movingTime: Schema.Attribute.Integer;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    rawActivity: Schema.Attribute.JSON & Schema.Attribute.Private;
    sportType: Schema.Attribute.String;
    startDate: Schema.Attribute.DateTime;
    startDateLocal: Schema.Attribute.DateTime;
    stravaActivityId: Schema.Attribute.String & Schema.Attribute.Required;
    syncStatus: Schema.Attribute.Enumeration<
      ['SYNCED', 'DELETED_ON_STRAVA', 'ERROR']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'SYNCED'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    totalElevationGain: Schema.Attribute.Decimal;
    type: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    visibility: Schema.Attribute.Enumeration<
      ['PRIVATE', 'SHARED_WITH_GROUP', 'PUBLIC']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'PRIVATE'>;
  };
}

export interface ApiStravaConnectionStravaConnection
  extends Struct.CollectionTypeSchema {
  collectionName: 'strava_connections';
  info: {
    description: 'Tenant-scoped Strava connection for an internal user.';
    displayName: 'Strava Connection';
    pluralName: 'strava-connections';
    singularName: 'strava-connection';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    accessToken: Schema.Attribute.Text & Schema.Attribute.Private;
    activities: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-activity.strava-activity'
    >;
    athleteFirstname: Schema.Attribute.String;
    athleteLastname: Schema.Attribute.String;
    athleteUsername: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    disconnectedAt: Schema.Attribute.DateTime;
    lastSyncAt: Schema.Attribute.DateTime;
    lastSyncError: Schema.Attribute.Text;
    lastSyncStatus: Schema.Attribute.Enumeration<
      ['NEVER', 'SUCCESS', 'FAILED', 'PARTIAL']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'NEVER'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-connection.strava-connection'
    > &
      Schema.Attribute.Private;
    profileUrl: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    rawAthlete: Schema.Attribute.JSON & Schema.Attribute.Private;
    refreshToken: Schema.Attribute.Text & Schema.Attribute.Private;
    scope: Schema.Attribute.String;
    status: Schema.Attribute.Enumeration<['ACTIVE', 'DISCONNECTED', 'ERROR']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'ACTIVE'>;
    stravaAthleteId: Schema.Attribute.String & Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    tokenExpiresAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
  };
}

export interface ApiStravaOauthStateStravaOauthState
  extends Struct.CollectionTypeSchema {
  collectionName: 'strava_oauth_states';
  info: {
    description: 'Tenant-scoped one-time OAuth state verifier for Strava connect callback.';
    displayName: 'Strava OAuth State';
    pluralName: 'strava-oauth-states';
    singularName: 'strava-oauth-state';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-oauth-state.strava-oauth-state'
    > &
      Schema.Attribute.Private;
    nonce: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    stateHash: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    usedAt: Schema.Attribute.DateTime;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
  };
}

export interface ApiStudentLearningObjectProgressStudentLearningObjectProgress
  extends Struct.CollectionTypeSchema {
  collectionName: 'student_learning_object_progresses';
  info: {
    description: 'Tenant-scoped progress for a student working through a learning object.';
    displayName: 'Student Learning Object Progress';
    pluralName: 'student-learning-object-progresses';
    singularName: 'student-learning-object-progress';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    aiNote: Schema.Attribute.RichText;
    attemptCount: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    completedAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    learningObject: Schema.Attribute.Relation<
      'manyToOne',
      'api::learning-object.learning-object'
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::student-learning-object-progress.student-learning-object-progress'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    progressStatus: Schema.Attribute.Enumeration<
      ['not_started', 'in_progress', 'completed', 'needs_review']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_started'>;
    publishedAt: Schema.Attribute.DateTime;
    score: Schema.Attribute.Decimal;
    startedAt: Schema.Attribute.DateTime;
    student: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    teacherNote: Schema.Attribute.RichText;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    timeSpent: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiStudentLearningProfileStudentLearningProfile
  extends Struct.CollectionTypeSchema {
  collectionName: 'student_learning_profiles';
  info: {
    description: 'Tenant-scoped student learning profile by subject and grade.';
    displayName: 'Student Learning Profile';
    pluralName: 'student-learning-profiles';
    singularName: 'student-learning-profile';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currentLevel: Schema.Attribute.String;
    grade: Schema.Attribute.Relation<'manyToOne', 'api::grade.grade'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::student-learning-profile.student-learning-profile'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    notes: Schema.Attribute.RichText;
    publishedAt: Schema.Attribute.DateTime;
    strengths: Schema.Attribute.JSON;
    student: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    subject: Schema.Attribute.Relation<'manyToOne', 'api::subject.subject'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    weaknesses: Schema.Attribute.JSON;
  };
}

export interface ApiStudentSkillProgressStudentSkillProgress
  extends Struct.CollectionTypeSchema {
  collectionName: 'student_skill_progresses';
  info: {
    description: 'Tenant-scoped mastery progress for a student skill.';
    displayName: 'Student Skill Progress';
    pluralName: 'student-skill-progresses';
    singularName: 'student-skill-progress';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    attemptCount: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    correctCount: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    lastPracticedAt: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::student-skill-progress.student-skill-progress'
    > &
      Schema.Attribute.Private;
    masteryScore: Schema.Attribute.Decimal;
    metadata: Schema.Attribute.JSON;
    progressStatus: Schema.Attribute.Enumeration<
      ['not_started', 'learning', 'practicing', 'mastered', 'needs_review']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_started'>;
    publishedAt: Schema.Attribute.DateTime;
    skill: Schema.Attribute.Relation<'manyToOne', 'api::skill.skill'> &
      Schema.Attribute.Required;
    student: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    wrongCount: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface ApiSubjectSubject extends Struct.CollectionTypeSchema {
  collectionName: 'subjects';
  info: {
    description: 'Tenant-scoped learning subject taxonomy.';
    displayName: 'Subject';
    pluralName: 'subjects';
    singularName: 'subject';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    formulas: Schema.Attribute.Relation<'oneToMany', 'api::formula.formula'>;
    knowledgeNodes: Schema.Attribute.Relation<
      'oneToMany',
      'api::knowledge-node.knowledge-node'
    >;
    learningObjects: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-object.learning-object'
    >;
    learningPaths: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-path.learning-path'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::subject.subject'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    questions: Schema.Attribute.Relation<'oneToMany', 'api::question.question'>;
    skills: Schema.Attribute.Relation<'oneToMany', 'api::skill.skill'>;
    studentLearningProfiles: Schema.Attribute.Relation<
      'oneToMany',
      'api::student-learning-profile.student-learning-profile'
    >;
    subjectStatus: Schema.Attribute.Enumeration<['active', 'archived']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    visualAssets: Schema.Attribute.Relation<
      'oneToMany',
      'api::visual-asset.visual-asset'
    >;
  };
}

export interface ApiSurveyAnswerSurveyAnswer
  extends Struct.CollectionTypeSchema {
  collectionName: 'survey_answers';
  info: {
    description: 'Future extension: feature-based permission (survey.*), tenantFeature, roleFeature, reporting later.';
    displayName: 'Survey Answer';
    pluralName: 'survey-answers';
    singularName: 'survey-answer';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-answer.survey-answer'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    survey_question: Schema.Attribute.Relation<
      'manyToOne',
      'api::survey-question.survey-question'
    > &
      Schema.Attribute.Required;
    survey_question_option: Schema.Attribute.Relation<
      'manyToOne',
      'api::survey-question-option.survey-question-option'
    >;
    survey_response: Schema.Attribute.Relation<
      'manyToOne',
      'api::survey-response.survey-response'
    > &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    text: Schema.Attribute.Text;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    value: Schema.Attribute.String;
  };
}

export interface ApiSurveyAssignmentSurveyAssignment
  extends Struct.CollectionTypeSchema {
  collectionName: 'survey_assignments';
  info: {
    description: 'Future extension: feature-based permission (survey.*), tenantFeature, roleFeature, reporting later. Unique constraint note: COURSE_LECTURER => unique(campaign + user + classSectionId + lecturerId), GRADUATION_EXIT => unique(campaign + user).';
    displayName: 'Survey Assignment';
    pluralName: 'survey-assignments';
    singularName: 'survey-assignment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    classSectionId: Schema.Attribute.String;
    cohortId: Schema.Attribute.String;
    contextType: Schema.Attribute.Enumeration<
      ['COURSE_LECTURER', 'GRADUATION_EXIT']
    > &
      Schema.Attribute.Required;
    courseId: Schema.Attribute.String;
    courseName: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deletedAt: Schema.Attribute.DateTime;
    deletedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    isCompleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    isDeleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    lecturerId: Schema.Attribute.String;
    lecturerName: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-assignment.survey-assignment'
    > &
      Schema.Attribute.Private;
    programId: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    respondent: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    survey_campaign: Schema.Attribute.Relation<
      'manyToOne',
      'api::survey-campaign.survey-campaign'
    > &
      Schema.Attribute.Required;
    survey_responses: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-response.survey-response'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSurveyCampaignSurveyCampaign
  extends Struct.CollectionTypeSchema {
  collectionName: 'survey_campaigns';
  info: {
    description: 'Future extension: feature-based permission (survey.*), tenantFeature, roleFeature, reporting later.';
    displayName: 'Survey Campaign';
    pluralName: 'survey-campaigns';
    singularName: 'survey-campaign';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    academicYear: Schema.Attribute.String;
    campaignStatus: Schema.Attribute.Enumeration<['DRAFT', 'OPEN', 'CLOSED']> &
      Schema.Attribute.DefaultTo<'DRAFT'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deletedAt: Schema.Attribute.DateTime;
    deletedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    description: Schema.Attribute.Text;
    endAt: Schema.Attribute.DateTime;
    isDeleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-campaign.survey-campaign'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    semester: Schema.Attribute.String;
    startAt: Schema.Attribute.DateTime;
    survey_assignments: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-assignment.survey-assignment'
    >;
    survey_template: Schema.Attribute.Relation<
      'manyToOne',
      'api::survey-template.survey-template'
    > &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSurveyQuestionOptionSurveyQuestionOption
  extends Struct.CollectionTypeSchema {
  collectionName: 'survey_question_options';
  info: {
    description: 'Future extension: feature-based permission (survey.*), tenantFeature, roleFeature, reporting later.';
    displayName: 'Survey Question Option';
    pluralName: 'survey-question-options';
    singularName: 'survey-question-option';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    label: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-question-option.survey-question-option'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    survey_answers: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-answer.survey-answer'
    >;
    survey_question: Schema.Attribute.Relation<
      'manyToOne',
      'api::survey-question.survey-question'
    > &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    value: Schema.Attribute.String;
  };
}

export interface ApiSurveyQuestionSurveyQuestion
  extends Struct.CollectionTypeSchema {
  collectionName: 'survey_questions';
  info: {
    description: 'Future extension: feature-based permission (survey.*), tenantFeature, roleFeature, reporting later.';
    displayName: 'Survey Question';
    pluralName: 'survey-questions';
    singularName: 'survey-question';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    content: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isRequired: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-question.survey-question'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    survey_answers: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-answer.survey-answer'
    >;
    survey_question_options: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-question-option.survey-question-option'
    >;
    survey_section: Schema.Attribute.Relation<
      'manyToOne',
      'api::survey-section.survey-section'
    > &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<
      ['LIKERT_1_5', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'TEXT']
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSurveyResponseSurveyResponse
  extends Struct.CollectionTypeSchema {
  collectionName: 'survey_responses';
  info: {
    description: 'Future extension: feature-based permission (survey.*), tenantFeature, roleFeature, reporting later.';
    displayName: 'Survey Response';
    pluralName: 'survey-responses';
    singularName: 'survey-response';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-response.survey-response'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    respondentSnapshot: Schema.Attribute.JSON;
    responseStatus: Schema.Attribute.Enumeration<
      ['IN_PROGRESS', 'SUBMITTED', 'RESET']
    > &
      Schema.Attribute.DefaultTo<'IN_PROGRESS'>;
    submittedAt: Schema.Attribute.DateTime;
    survey_answers: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-answer.survey-answer'
    >;
    survey_assignment: Schema.Attribute.Relation<
      'manyToOne',
      'api::survey-assignment.survey-assignment'
    > &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSurveySectionSurveySection
  extends Struct.CollectionTypeSchema {
  collectionName: 'survey_sections';
  info: {
    description: 'Future extension: feature-based permission (survey.*), tenantFeature, roleFeature, reporting later.';
    displayName: 'Survey Section';
    pluralName: 'survey-sections';
    singularName: 'survey-section';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-section.survey-section'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    survey_questions: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-question.survey-question'
    >;
    survey_template: Schema.Attribute.Relation<
      'manyToOne',
      'api::survey-template.survey-template'
    > &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSurveyTemplateSurveyTemplate
  extends Struct.CollectionTypeSchema {
  collectionName: 'survey_templates';
  info: {
    description: 'Future extension: feature-based permission (survey.*), tenantFeature, roleFeature, reporting later.';
    displayName: 'Survey Template';
    pluralName: 'survey-templates';
    singularName: 'survey-template';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-template.survey-template'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    survey_campaigns: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-campaign.survey-campaign'
    >;
    survey_sections: Schema.Attribute.Relation<
      'oneToMany',
      'api::survey-section.survey-section'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<
      ['TEACHING_EVALUATION', 'GRADUATION_EXIT']
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTenantConfigTenantConfig
  extends Struct.CollectionTypeSchema {
  collectionName: 'tenant_configs';
  info: {
    description: 'Tenant-scoped JSON configuration entries';
    displayName: 'TenantConfig';
    pluralName: 'tenant-configs';
    singularName: 'tenant-config';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    jsonContent: Schema.Attribute.JSON & Schema.Attribute.Required;
    key: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tenant-config.tenant-config'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTenantDomainTenantDomain
  extends Struct.CollectionTypeSchema {
  collectionName: 'tenant_domains';
  info: {
    displayName: 'Tenant Domain';
    pluralName: 'tenant-domains';
    singularName: 'tenant-domain';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    domain: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    isPrimary: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tenant-domain.tenant-domain'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    tenantDomainStatus: Schema.Attribute.Enumeration<['active', 'inactive']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTenantFeatureTenantFeature
  extends Struct.CollectionTypeSchema {
  collectionName: 'tenant_features';
  info: {
    displayName: 'Tenant Feature';
    pluralName: 'tenant-features';
    singularName: 'tenant-feature';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    feature: Schema.Attribute.Relation<'manyToOne', 'api::feature.feature'> &
      Schema.Attribute.Required;
    isEnabled: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tenant-feature.tenant-feature'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTenantRoleTenantRole extends Struct.CollectionTypeSchema {
  collectionName: 'tenant_roles';
  info: {
    displayName: 'Tenant Role';
    pluralName: 'tenant-roles';
    singularName: 'tenant-role';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activatedAt: Schema.Attribute.DateTime;
    activatedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deactivatedAt: Schema.Attribute.DateTime;
    deactivatedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    inactiveReason: Schema.Attribute.String;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tenant-role.tenant-role'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTenantStorageTenantStorage
  extends Struct.CollectionTypeSchema {
  collectionName: 'tenant_storages';
  info: {
    description: 'Tenant-scoped storage configuration and quota settings';
    displayName: 'Tenant Storage';
    pluralName: 'tenant-storages';
    singularName: 'tenant-storage';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    basePath: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    fileAssets: Schema.Attribute.Relation<
      'oneToMany',
      'api::file-asset.file-asset'
    >;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    isDefault: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tenant-storage.tenant-storage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    notes: Schema.Attribute.Text;
    provider: Schema.Attribute.Enumeration<
      ['local', 's3', 'minio', 'wasabi', 'azure', 'gcs']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'local'>;
    publicBaseUrl: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    quotaGB: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<5>;
    settings: Schema.Attribute.JSON;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    usedBytes: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
  };
}

export interface ApiTenantTenant extends Struct.CollectionTypeSchema {
  collectionName: 'tenants';
  info: {
    displayName: 'Tenant';
    pluralName: 'tenants';
    singularName: 'tenant';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    admissionApplicationActivities: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application-activity.admission-application-activity'
    >;
    admissionApplicationMessages: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application-message.admission-application-message'
    >;
    admissionApplications: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application.admission-application'
    >;
    aiAssistants: Schema.Attribute.Relation<
      'oneToMany',
      'api::ai-assistant.ai-assistant'
    >;
    aiKnowledges: Schema.Attribute.Relation<
      'oneToMany',
      'api::ai-knowledge.ai-knowledge'
    >;
    banner: Schema.Attribute.Media<'images'>;
    campaigns: Schema.Attribute.Relation<'oneToMany', 'api::campaign.campaign'>;
    challengeActivities: Schema.Attribute.Relation<
      'oneToMany',
      'api::challenge-activity.challenge-activity'
    >;
    challengeParticipants: Schema.Attribute.Relation<
      'oneToMany',
      'api::challenge-participant.challenge-participant'
    >;
    chatAvatar: Schema.Attribute.Media<'images'>;
    chatMessages: Schema.Attribute.Relation<
      'oneToMany',
      'api::chat-message.chat-message'
    >;
    chatSessions: Schema.Attribute.Relation<
      'oneToMany',
      'api::chat-session.chat-session'
    >;
    code: Schema.Attribute.UID<'name'> &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    contentBlocks: Schema.Attribute.Relation<
      'oneToMany',
      'api::content-block.content-block'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultFeatureCode: Schema.Attribute.String;
    defaultLocale: Schema.Attribute.String;
    defaultMetaImage: Schema.Attribute.Media<'images'>;
    defaultPageTitle: Schema.Attribute.String;
    defaultProtectedRoute: Schema.Attribute.String;
    defaultPublicRoute: Schema.Attribute.String;
    departments: Schema.Attribute.Relation<
      'oneToMany',
      'api::department.department'
    >;
    description: Schema.Attribute.Text;
    endDate: Schema.Attribute.Date;
    facebookPixelId: Schema.Attribute.String;
    favicon: Schema.Attribute.Media<'images'>;
    fileAssets: Schema.Attribute.Relation<
      'oneToMany',
      'api::file-asset.file-asset'
    >;
    fitnessChallenges: Schema.Attribute.Relation<
      'oneToMany',
      'api::fitness-challenge.fitness-challenge'
    >;
    formTemplates: Schema.Attribute.Relation<
      'oneToMany',
      'api::form-template.form-template'
    >;
    formulas: Schema.Attribute.Relation<'oneToMany', 'api::formula.formula'>;
    googleAnalyticsId: Schema.Attribute.String;
    googleSearchConsoleVerification: Schema.Attribute.String;
    googleTagManagerId: Schema.Attribute.String;
    grades: Schema.Attribute.Relation<'oneToMany', 'api::grade.grade'>;
    knowledgeNodes: Schema.Attribute.Relation<
      'oneToMany',
      'api::knowledge-node.knowledge-node'
    >;
    leadActivities: Schema.Attribute.Relation<
      'oneToMany',
      'api::lead-activity.lead-activity'
    >;
    leadCampaigns: Schema.Attribute.Relation<
      'oneToMany',
      'api::lead-campaign.lead-campaign'
    >;
    leadCaptures: Schema.Attribute.Relation<
      'oneToMany',
      'api::lead-capture.lead-capture'
    >;
    learningObjects: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-object.learning-object'
    >;
    learningPathItems: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-path-item.learning-path-item'
    >;
    learningPaths: Schema.Attribute.Relation<
      'oneToMany',
      'api::learning-path.learning-path'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tenant.tenant'
    > &
      Schema.Attribute.Private;
    logo: Schema.Attribute.Media<'images'>;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    note: Schema.Attribute.Text;
    notificationTemplates: Schema.Attribute.Relation<
      'oneToMany',
      'api::notification-template.notification-template'
    >;
    primaryColor: Schema.Attribute.String;
    publicPages: Schema.Attribute.Relation<
      'oneToMany',
      'api::public-page.public-page'
    >;
    publishedAt: Schema.Attribute.DateTime;
    questionOptions: Schema.Attribute.Relation<
      'oneToMany',
      'api::question-option.question-option'
    >;
    questions: Schema.Attribute.Relation<'oneToMany', 'api::question.question'>;
    settings: Schema.Attribute.JSON;
    shortName: Schema.Attribute.String;
    siteDescription: Schema.Attribute.Text;
    siteKeywords: Schema.Attribute.Text;
    siteLogo: Schema.Attribute.Media<'images'>;
    siteShortTitle: Schema.Attribute.String;
    siteTitle: Schema.Attribute.String;
    skills: Schema.Attribute.Relation<'oneToMany', 'api::skill.skill'>;
    slogan: Schema.Attribute.Text;
    startDate: Schema.Attribute.Date;
    storageDefaultConfigId: Schema.Attribute.Integer;
    stravaActivities: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-activity.strava-activity'
    >;
    stravaConnections: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-connection.strava-connection'
    >;
    stravaOAuthStates: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-oauth-state.strava-oauth-state'
    >;
    studentLearningObjectProgressRecords: Schema.Attribute.Relation<
      'oneToMany',
      'api::student-learning-object-progress.student-learning-object-progress'
    >;
    studentLearningProfiles: Schema.Attribute.Relation<
      'oneToMany',
      'api::student-learning-profile.student-learning-profile'
    >;
    studentSkillProgressRecords: Schema.Attribute.Relation<
      'oneToMany',
      'api::student-skill-progress.student-skill-progress'
    >;
    subjects: Schema.Attribute.Relation<'oneToMany', 'api::subject.subject'>;
    tenantDomains: Schema.Attribute.Relation<
      'oneToMany',
      'api::tenant-domain.tenant-domain'
    >;
    tenantRoles: Schema.Attribute.Relation<
      'oneToMany',
      'api::tenant-role.tenant-role'
    >;
    tenantStatus: Schema.Attribute.Enumeration<
      ['draft', 'active', 'inactive', 'suspended']
    > &
      Schema.Attribute.Required;
    tenantStorages: Schema.Attribute.Relation<
      'oneToMany',
      'api::tenant-storage.tenant-storage'
    >;
    timezone: Schema.Attribute.String;
    titleSuffix: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userTenants: Schema.Attribute.Relation<
      'oneToMany',
      'api::user-tenant.user-tenant'
    >;
    visualAssets: Schema.Attribute.Relation<
      'oneToMany',
      'api::visual-asset.visual-asset'
    >;
  };
}

export interface ApiUserDuplicateCleanupLogUserDuplicateCleanupLog
  extends Struct.CollectionTypeSchema {
  collectionName: 'user_duplicate_cleanup_logs';
  info: {
    displayName: 'User Duplicate Cleanup Log';
    pluralName: 'user-duplicate-cleanup-logs';
    singularName: 'user-duplicate-cleanup-log';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    cleanedAt: Schema.Attribute.DateTime;
    cleanupStatus: Schema.Attribute.Enumeration<
      ['success', 'warning', 'failed']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'success'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deletedAnswers: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    deletedAssignments: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>;
    deletedResponses: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    deletedUserIds: Schema.Attribute.JSON;
    errors: Schema.Attribute.JSON;
    keepUserId: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::user-duplicate-cleanup-log.user-duplicate-cleanup-log'
    > &
      Schema.Attribute.Private;
    previewGroup: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    tenantId: Schema.Attribute.Integer & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String & Schema.Attribute.Required;
    warnings: Schema.Attribute.JSON;
  };
}

export interface ApiUserTenantRoleUserTenantRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'user_tenant_roles';
  info: {
    displayName: 'User Tenant Role';
    pluralName: 'user-tenant-roles';
    singularName: 'user-tenant-role';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assignedAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    inactiveReason: Schema.Attribute.String;
    isPrimary: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::user-tenant-role.user-tenant-role'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    revokedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userTenant: Schema.Attribute.Relation<
      'manyToOne',
      'api::user-tenant.user-tenant'
    > &
      Schema.Attribute.Required;
    userTenantRoleStatus: Schema.Attribute.Enumeration<['active', 'inactive']> &
      Schema.Attribute.Required;
  };
}

export interface ApiUserTenantUserTenant extends Struct.CollectionTypeSchema {
  collectionName: 'user_tenants';
  info: {
    displayName: 'User Tenant';
    pluralName: 'user-tenants';
    singularName: 'user-tenant';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isDefault: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    joinedAt: Schema.Attribute.DateTime;
    label: Schema.Attribute.String;
    leftAt: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::user-tenant.user-tenant'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    userTenantRoles: Schema.Attribute.Relation<
      'oneToMany',
      'api::user-tenant-role.user-tenant-role'
    >;
    userTenantStatus: Schema.Attribute.Enumeration<
      ['pending', 'active', 'inactive', 'suspended']
    > &
      Schema.Attribute.Required;
  };
}

export interface ApiVehicleTypeVehicleType extends Struct.CollectionTypeSchema {
  collectionName: 'vehicle_types';
  info: {
    displayName: 'VehicleType';
    pluralName: 'vehicle-types';
    singularName: 'vehicle-type';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    cover: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isActive: Schema.Attribute.Boolean;
    leads: Schema.Attribute.Relation<'oneToMany', 'api::lead.lead'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::vehicle-type.vehicle-type'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    shortDesc: Schema.Attribute.Text;
    slug: Schema.Attribute.UID<'name'>;
    sortOrder: Schema.Attribute.Integer;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vehicles: Schema.Attribute.Relation<'oneToMany', 'api::vehicle.vehicle'>;
  };
}

export interface ApiVehicleVehicle extends Struct.CollectionTypeSchema {
  collectionName: 'vehicles';
  info: {
    displayName: 'Vehicle';
    pluralName: 'vehicles';
    singularName: 'vehicle';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    code: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    depositFrom: Schema.Attribute.Decimal;
    features: Schema.Attribute.JSON;
    images: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    isActive: Schema.Attribute.Boolean;
    isFeatured: Schema.Attribute.Boolean;
    leads: Schema.Attribute.Relation<'oneToMany', 'api::lead.lead'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::vehicle.vehicle'
    > &
      Schema.Attribute.Private;
    location: Schema.Attribute.String;
    pricePerDayFrom: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    shortDesc: Schema.Attribute.Text;
    slug: Schema.Attribute.UID<'title'>;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vehicleType: Schema.Attribute.Relation<
      'manyToOne',
      'api::vehicle-type.vehicle-type'
    >;
  };
}

export interface ApiVisualAssetVisualAsset extends Struct.CollectionTypeSchema {
  collectionName: 'visual_assets';
  info: {
    description: 'Tenant-scoped reusable media and visual learning asset.';
    displayName: 'Visual Asset';
    pluralName: 'visual-assets';
    singularName: 'visual-asset';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    altText: Schema.Attribute.String;
    code: Schema.Attribute.String;
    contentBlocks: Schema.Attribute.Relation<
      'oneToMany',
      'api::content-block.content-block'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    file: Schema.Attribute.Media;
    grade: Schema.Attribute.Relation<'manyToOne', 'api::grade.grade'>;
    knowledgeNode: Schema.Attribute.Relation<
      'manyToOne',
      'api::knowledge-node.knowledge-node'
    >;
    learningObjects: Schema.Attribute.Relation<
      'manyToMany',
      'api::learning-object.learning-object'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::visual-asset.visual-asset'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    subject: Schema.Attribute.Relation<'manyToOne', 'api::subject.subject'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<
      [
        'image',
        'video',
        'audio',
        'diagram',
        'animation',
        'simulation',
        'pdf',
        'other',
      ]
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String;
    visualAssetStatus: Schema.Attribute.Enumeration<['active', 'archived']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.Text;
    caption: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.Text;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.Text & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    fullName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    isPlatformAdmin: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    phone: Schema.Attribute.String;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    request_assignees: Schema.Attribute.Relation<
      'oneToMany',
      'api::request-assignee.request-assignee'
    >;
    request_messages: Schema.Attribute.Relation<
      'manyToMany',
      'api::request-message.request-message'
    >;
    requests: Schema.Attribute.Relation<'oneToMany', 'api::request.request'>;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    watcher_requests: Schema.Attribute.Relation<
      'manyToMany',
      'api::request.request'
    >;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::audit-log': AdminAuditLog;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::session': AdminSession;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::about.about': ApiAboutAbout;
      'api::activation-token.activation-token': ApiActivationTokenActivationToken;
      'api::admission-application-activity.admission-application-activity': ApiAdmissionApplicationActivityAdmissionApplicationActivity;
      'api::admission-application-file.admission-application-file': ApiAdmissionApplicationFileAdmissionApplicationFile;
      'api::admission-application-message.admission-application-message': ApiAdmissionApplicationMessageAdmissionApplicationMessage;
      'api::admission-application.admission-application': ApiAdmissionApplicationAdmissionApplication;
      'api::ai-assistant.ai-assistant': ApiAiAssistantAiAssistant;
      'api::ai-knowledge.ai-knowledge': ApiAiKnowledgeAiKnowledge;
      'api::article.article': ApiArticleArticle;
      'api::author.author': ApiAuthorAuthor;
      'api::campaign.campaign': ApiCampaignCampaign;
      'api::candidate-exam-log.candidate-exam-log': ApiCandidateExamLogCandidateExamLog;
      'api::candidate-exam.candidate-exam': ApiCandidateExamCandidateExam;
      'api::category.category': ApiCategoryCategory;
      'api::challenge-activity.challenge-activity': ApiChallengeActivityChallengeActivity;
      'api::challenge-participant.challenge-participant': ApiChallengeParticipantChallengeParticipant;
      'api::chat-message.chat-message': ApiChatMessageChatMessage;
      'api::chat-session.chat-session': ApiChatSessionChatSession;
      'api::class-teacher-assignment.class-teacher-assignment': ApiClassTeacherAssignmentClassTeacherAssignment;
      'api::class.class': ApiClassClass;
      'api::content-block.content-block': ApiContentBlockContentBlock;
      'api::customer.customer': ApiCustomerCustomer;
      'api::department-membership.department-membership': ApiDepartmentMembershipDepartmentMembership;
      'api::department.department': ApiDepartmentDepartment;
      'api::employee-history.employee-history': ApiEmployeeHistoryEmployeeHistory;
      'api::employee.employee': ApiEmployeeEmployee;
      'api::enrollment.enrollment': ApiEnrollmentEnrollment;
      'api::feature-group.feature-group': ApiFeatureGroupFeatureGroup;
      'api::feature.feature': ApiFeatureFeature;
      'api::fee-item.fee-item': ApiFeeItemFeeItem;
      'api::fee-sheet-class.fee-sheet-class': ApiFeeSheetClassFeeSheetClass;
      'api::fee-sheet.fee-sheet': ApiFeeSheetFeeSheet;
      'api::file-asset.file-asset': ApiFileAssetFileAsset;
      'api::fitness-challenge.fitness-challenge': ApiFitnessChallengeFitnessChallenge;
      'api::form-template.form-template': ApiFormTemplateFormTemplate;
      'api::formula.formula': ApiFormulaFormula;
      'api::global.global': ApiGlobalGlobal;
      'api::grade.grade': ApiGradeGrade;
      'api::journal-category.journal-category': ApiJournalCategoryJournalCategory;
      'api::journal-issue-item.journal-issue-item': ApiJournalIssueItemJournalIssueItem;
      'api::journal-issue.journal-issue': ApiJournalIssueJournalIssue;
      'api::knowledge-node.knowledge-node': ApiKnowledgeNodeKnowledgeNode;
      'api::lead-activity.lead-activity': ApiLeadActivityLeadActivity;
      'api::lead-campaign.lead-campaign': ApiLeadCampaignLeadCampaign;
      'api::lead-capture.lead-capture': ApiLeadCaptureLeadCapture;
      'api::lead.lead': ApiLeadLead;
      'api::learner.learner': ApiLearnerLearner;
      'api::learning-object.learning-object': ApiLearningObjectLearningObject;
      'api::learning-path-item.learning-path-item': ApiLearningPathItemLearningPathItem;
      'api::learning-path.learning-path': ApiLearningPathLearningPath;
      'api::mail-log.mail-log': ApiMailLogMailLog;
      'api::notification-template.notification-template': ApiNotificationTemplateNotificationTemplate;
      'api::payment-allocation.payment-allocation': ApiPaymentAllocationPaymentAllocation;
      'api::payment-transaction.payment-transaction': ApiPaymentTransactionPaymentTransaction;
      'api::payment.payment': ApiPaymentPayment;
      'api::platform-setting.platform-setting': ApiPlatformSettingPlatformSetting;
      'api::position.position': ApiPositionPosition;
      'api::public-page.public-page': ApiPublicPagePublicPage;
      'api::question-option.question-option': ApiQuestionOptionQuestionOption;
      'api::question.question': ApiQuestionQuestion;
      'api::request-assignee.request-assignee': ApiRequestAssigneeRequestAssignee;
      'api::request-category.request-category': ApiRequestCategoryRequestCategory;
      'api::request-message.request-message': ApiRequestMessageRequestMessage;
      'api::request-tag.request-tag': ApiRequestTagRequestTag;
      'api::request.request': ApiRequestRequest;
      'api::role-feature.role-feature': ApiRoleFeatureRoleFeature;
      'api::service-category.service-category': ApiServiceCategoryServiceCategory;
      'api::service-item.service-item': ApiServiceItemServiceItem;
      'api::service-order-item.service-order-item': ApiServiceOrderItemServiceOrderItem;
      'api::service-order.service-order': ApiServiceOrderServiceOrder;
      'api::setting.setting': ApiSettingSetting;
      'api::skill.skill': ApiSkillSkill;
      'api::slider-item.slider-item': ApiSliderItemSliderItem;
      'api::slider.slider': ApiSliderSlider;
      'api::strava-activity.strava-activity': ApiStravaActivityStravaActivity;
      'api::strava-connection.strava-connection': ApiStravaConnectionStravaConnection;
      'api::strava-oauth-state.strava-oauth-state': ApiStravaOauthStateStravaOauthState;
      'api::student-learning-object-progress.student-learning-object-progress': ApiStudentLearningObjectProgressStudentLearningObjectProgress;
      'api::student-learning-profile.student-learning-profile': ApiStudentLearningProfileStudentLearningProfile;
      'api::student-skill-progress.student-skill-progress': ApiStudentSkillProgressStudentSkillProgress;
      'api::subject.subject': ApiSubjectSubject;
      'api::survey-answer.survey-answer': ApiSurveyAnswerSurveyAnswer;
      'api::survey-assignment.survey-assignment': ApiSurveyAssignmentSurveyAssignment;
      'api::survey-campaign.survey-campaign': ApiSurveyCampaignSurveyCampaign;
      'api::survey-question-option.survey-question-option': ApiSurveyQuestionOptionSurveyQuestionOption;
      'api::survey-question.survey-question': ApiSurveyQuestionSurveyQuestion;
      'api::survey-response.survey-response': ApiSurveyResponseSurveyResponse;
      'api::survey-section.survey-section': ApiSurveySectionSurveySection;
      'api::survey-template.survey-template': ApiSurveyTemplateSurveyTemplate;
      'api::tenant-config.tenant-config': ApiTenantConfigTenantConfig;
      'api::tenant-domain.tenant-domain': ApiTenantDomainTenantDomain;
      'api::tenant-feature.tenant-feature': ApiTenantFeatureTenantFeature;
      'api::tenant-role.tenant-role': ApiTenantRoleTenantRole;
      'api::tenant-storage.tenant-storage': ApiTenantStorageTenantStorage;
      'api::tenant.tenant': ApiTenantTenant;
      'api::user-duplicate-cleanup-log.user-duplicate-cleanup-log': ApiUserDuplicateCleanupLogUserDuplicateCleanupLog;
      'api::user-tenant-role.user-tenant-role': ApiUserTenantRoleUserTenantRole;
      'api::user-tenant.user-tenant': ApiUserTenantUserTenant;
      'api::vehicle-type.vehicle-type': ApiVehicleTypeVehicleType;
      'api::vehicle.vehicle': ApiVehicleVehicle;
      'api::visual-asset.visual-asset': ApiVisualAssetVisualAsset;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
