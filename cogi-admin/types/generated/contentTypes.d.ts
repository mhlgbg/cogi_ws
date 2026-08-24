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

export interface ApiAssessmentAnswerScoreAssessmentAnswerScore
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_answer_scores';
  info: {
    description: 'Tenant-scoped scoring record for one answer inside one scoring result.';
    displayName: 'Assessment Answer Score';
    pluralName: 'assessment-answer-scores';
    singularName: 'assessment-answer-score';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    answer: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-answer.assessment-answer'
    >;
    assessmentQuestion: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-question.assessment-question'
    > &
      Schema.Attribute.Required;
    attempt: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-attempt.assessment-attempt'
    > &
      Schema.Attribute.Required;
    awardedPoints: Schema.Attribute.Decimal;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isCorrect: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-answer-score.assessment-answer-score'
    > &
      Schema.Attribute.Private;
    manualScoredAt: Schema.Attribute.DateTime;
    manualScoreNote: Schema.Attribute.Text;
    manualScoreRequired: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    maxPoints: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    question: Schema.Attribute.Relation<'manyToOne', 'api::question.question'> &
      Schema.Attribute.Required;
    result: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-result.assessment-result'
    > &
      Schema.Attribute.Required;
    scoredBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    scoringDetail: Schema.Attribute.JSON & Schema.Attribute.Private;
    scoringMethod: Schema.Attribute.Enumeration<['auto', 'manual', 'none']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'none'>;
    status: Schema.Attribute.Enumeration<
      ['pending', 'auto_scored', 'manual_scored', 'not_scored', 'invalid']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAssessmentAnswerAssessmentAnswer
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_answers';
  info: {
    description: 'Tenant-scoped canonical answer state for one attempt and one assessment question.';
    displayName: 'Assessment Answer';
    pluralName: 'assessment-answers';
    singularName: 'assessment-answer';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    answerData: Schema.Attribute.JSON;
    assessmentQuestion: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-question.assessment-question'
    > &
      Schema.Attribute.Required;
    attempt: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-attempt.assessment-attempt'
    > &
      Schema.Attribute.Required;
    audioPlayCount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    firstAnsweredAt: Schema.Attribute.DateTime;
    lastAnsweredAt: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-answer.assessment-answer'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    question: Schema.Attribute.Relation<'manyToOne', 'api::question.question'> &
      Schema.Attribute.Required;
    questionSnapshot: Schema.Attribute.JSON;
    scores: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-answer-score.assessment-answer-score'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    timeSpentSeconds: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAssessmentAttemptAssessmentAttempt
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_attempts';
  info: {
    description: 'Tenant-scoped runtime attempt against a specific assessment version.';
    displayName: 'Assessment Attempt';
    pluralName: 'assessment-attempts';
    singularName: 'assessment-attempt';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    answers: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-answer.assessment-answer'
    >;
    assessment: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment.assessment'
    > &
      Schema.Attribute.Required;
    assessmentVersion: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-version.assessment-version'
    > &
      Schema.Attribute.Required;
    cancelledAt: Schema.Attribute.DateTime;
    cancelledBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    cancelNote: Schema.Attribute.Text;
    cancelReason: Schema.Attribute.Enumeration<
      [
        'wrong_assessment',
        'technical_issue',
        'test_data',
        'candidate_mistake',
        'admin_decision',
        'other',
      ]
    >;
    candidateEmailSnapshot: Schema.Attribute.String;
    candidateNameSnapshot: Schema.Attribute.String;
    candidatePhoneSnapshot: Schema.Attribute.String;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    definitionSnapshot: Schema.Attribute.JSON;
    expiresAt: Schema.Attribute.DateTime;
    lead: Schema.Attribute.Relation<'manyToOne', 'api::lead.lead'>;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-attempt.assessment-attempt'
    > &
      Schema.Attribute.Private;
    progressState: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    results: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-result.assessment-result'
    >;
    scoringSnapshot: Schema.Attribute.JSON & Schema.Attribute.Private;
    sourceRef: Schema.Attribute.String;
    sourceType: Schema.Attribute.Enumeration<
      ['admin', 'campaign', 'public', 'learner', 'exam', 'other']
    >;
    startedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['created', 'in_progress', 'submitted', 'expired', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'created'>;
    submittedAt: Schema.Attribute.DateTime;
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

export interface ApiAssessmentCampaignFieldAssessmentCampaignField
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_campaign_fields';
  info: {
    description: 'Tenant-scoped configurable data collection field for an assessment campaign.';
    displayName: 'Assessment Campaign Field';
    pluralName: 'assessment-campaign-fields';
    singularName: 'assessment-campaign-field';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assessmentCampaign: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-campaign.assessment-campaign'
    > &
      Schema.Attribute.Required;
    collectStage: Schema.Attribute.Enumeration<
      ['before_start', 'before_result', 'optional']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'before_start'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    fieldType: Schema.Attribute.Enumeration<
      [
        'text',
        'email',
        'phone',
        'number',
        'date',
        'select',
        'radio',
        'checkbox',
        'textarea',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'text'>;
    helpText: Schema.Attribute.Text;
    key: Schema.Attribute.String & Schema.Attribute.Required;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-campaign-field.assessment-campaign-field'
    > &
      Schema.Attribute.Private;
    options: Schema.Attribute.JSON;
    order: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    placeholder: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    required: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    status: Schema.Attribute.Enumeration<['active', 'inactive']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAssessmentCampaignParticipationAssessmentCampaignParticipation
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_campaign_participations';
  info: {
    description: 'Tenant-scoped participation record linking a lead/candidate to an assessment campaign and an assessment attempt.';
    displayName: 'Assessment Campaign Participation';
    pluralName: 'assessment-campaign-participations';
    singularName: 'assessment-campaign-participation';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assessmentAttempt: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-attempt.assessment-attempt'
    >;
    assessmentCampaign: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-campaign.assessment-campaign'
    > &
      Schema.Attribute.Required;
    assessmentStartedAt: Schema.Attribute.DateTime;
    assessmentVersion: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-version.assessment-version'
    >;
    assessmentVersionSnapshot: Schema.Attribute.JSON;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    collectedData: Schema.Attribute.JSON;
    completedAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    lead: Schema.Attribute.Relation<'manyToOne', 'api::lead.lead'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-campaign-participation.assessment-campaign-participation'
    > &
      Schema.Attribute.Private;
    matchedRule: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-campaign-rule.assessment-campaign-rule'
    >;
    publishedAt: Schema.Attribute.DateTime;
    retakeAllowed: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    retakeAllowedAt: Schema.Attribute.DateTime;
    retakeAllowedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    retakeCount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    retakeNote: Schema.Attribute.Text;
    retakeReason: Schema.Attribute.Enumeration<
      [
        'wrong_assessment',
        'technical_issue',
        'test_data',
        'candidate_mistake',
        'admin_decision',
        'other',
      ]
    >;
    sourceMetadata: Schema.Attribute.JSON;
    startedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      [
        'created',
        'verified',
        'ready',
        'in_progress',
        'submitted',
        'result_pending',
        'completed',
        'cancelled',
        'expired',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'created'>;
    submittedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    verifiedAt: Schema.Attribute.DateTime;
  };
}

export interface ApiAssessmentCampaignRuleAssessmentCampaignRule
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_campaign_rules';
  info: {
    description: 'Tenant-scoped resolver rule for selecting an assessment version within an assessment campaign.';
    displayName: 'Assessment Campaign Rule';
    pluralName: 'assessment-campaign-rules';
    singularName: 'assessment-campaign-rule';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    ageFrom: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    ageTo: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    assessmentCampaign: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-campaign.assessment-campaign'
    > &
      Schema.Attribute.Required;
    assessmentVersion: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-version.assessment-version'
    > &
      Schema.Attribute.Required;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    conditions: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    gradeFrom: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    gradeTo: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-campaign-rule.assessment-campaign-rule'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    priority: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['draft', 'active', 'inactive']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAssessmentCampaignAssessmentCampaign
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_campaigns';
  info: {
    description: 'Tenant-scoped orchestration campaign for lead capture, assessment assignment, and result tracking.';
    displayName: 'Assessment Campaign';
    pluralName: 'assessment-campaigns';
    singularName: 'assessment-campaign';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    endAt: Schema.Attribute.DateTime;
    fields: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-campaign-field.assessment-campaign-field'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-campaign.assessment-campaign'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    participations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-campaign-participation.assessment-campaign-participation'
    >;
    publicContent: Schema.Attribute.RichText;
    publicDescription: Schema.Attribute.Text;
    publicTitle: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resultIntro: Schema.Attribute.Text;
    rules: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-campaign-rule.assessment-campaign-rule'
    >;
    settings: Schema.Attribute.JSON;
    slug: Schema.Attribute.String & Schema.Attribute.Required;
    startAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['draft', 'active', 'paused', 'ended', 'archived']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    successMessage: Schema.Attribute.Text;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAssessmentPlacementConfirmationAssessmentPlacementConfirmation
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_placement_confirmations';
  info: {
    description: 'Tenant-scoped teacher confirmation history for one assessment result.';
    displayName: 'Assessment Placement Confirmation';
    pluralName: 'assessment-placement-confirmations';
    singularName: 'assessment-placement-confirmation';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assessment: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment.assessment'
    > &
      Schema.Attribute.Required;
    assessmentAttempt: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-attempt.assessment-attempt'
    > &
      Schema.Attribute.Required;
    assessmentResult: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-result.assessment-result'
    > &
      Schema.Attribute.Required;
    assessmentSpeakingReview: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-speaking-review.assessment-speaking-review'
    >;
    assessmentVersion: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-version.assessment-version'
    > &
      Schema.Attribute.Required;
    confirmationNote: Schema.Attribute.Text;
    confirmedAt: Schema.Attribute.DateTime;
    confirmedBandCode: Schema.Attribute.String;
    confirmedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    confirmedLabel: Schema.Attribute.String;
    confirmedLevel: Schema.Attribute.Enumeration<
      ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    decision: Schema.Attribute.Enumeration<
      ['keep', 'raise', 'lower', 'manual']
    >;
    isCurrent: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-placement-confirmation.assessment-placement-confirmation'
    > &
      Schema.Attribute.Private;
    provisionalBandCodeSnapshot: Schema.Attribute.String;
    provisionalLabelSnapshot: Schema.Attribute.String;
    provisionalLevelSnapshot: Schema.Attribute.Enumeration<
      ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    >;
    publishedAt: Schema.Attribute.DateTime;
    resultSnapshot: Schema.Attribute.JSON;
    speakingSuggestedLevelSnapshot: Schema.Attribute.Enumeration<
      ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    >;
    speakingSummarySnapshot: Schema.Attribute.JSON;
    status: Schema.Attribute.Enumeration<
      ['draft', 'confirmed', 'superseded', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAssessmentPlacementRuleAssessmentPlacementRule
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_placement_rules';
  info: {
    description: 'Tenant-scoped configurable placement band rules for one assessment version.';
    displayName: 'Assessment Placement Rule';
    pluralName: 'assessment-placement-rules';
    singularName: 'assessment-placement-rule';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assessmentVersion: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-version.assessment-version'
    > &
      Schema.Attribute.Required;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    level: Schema.Attribute.Enumeration<
      ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-placement-rule.assessment-placement-rule'
    > &
      Schema.Attribute.Private;
    maxPercentage: Schema.Attribute.Decimal;
    maxRawScore: Schema.Attribute.Decimal;
    minPercentage: Schema.Attribute.Decimal;
    minRawScore: Schema.Attribute.Decimal;
    order: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    placementBandCode: Schema.Attribute.String;
    placementLabel: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    ruleType: Schema.Attribute.Enumeration<
      ['percentage', 'raw_score', 'custom']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'percentage'>;
    scoreBasis: Schema.Attribute.Enumeration<
      ['objective_only', 'scored_total', 'final_total']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'objective_only'>;
    status: Schema.Attribute.Enumeration<['active', 'inactive']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAssessmentQuestionAssessmentQuestion
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_questions';
  info: {
    description: 'Question placement and runtime configuration within a specific assessment section.';
    displayName: 'Assessment Question';
    pluralName: 'assessment-questions';
    singularName: 'assessment-question';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allowSeek: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    audioPlayLimit: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    config: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-question.assessment-question'
    > &
      Schema.Attribute.Private;
    maxWords: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    minWords: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    order: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    points: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<1>;
    publishedAt: Schema.Attribute.DateTime;
    question: Schema.Attribute.Relation<'manyToOne', 'api::question.question'> &
      Schema.Attribute.Required;
    required: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    section: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-section.assessment-section'
    > &
      Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAssessmentResultAssessmentResult
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_results';
  info: {
    description: 'Tenant-scoped scoring result snapshot for one assessment attempt.';
    displayName: 'Assessment Result';
    pluralName: 'assessment-results';
    singularName: 'assessment-result';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    answerScores: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-answer-score.assessment-answer-score'
    >;
    assessment: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment.assessment'
    > &
      Schema.Attribute.Required;
    assessmentVersion: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-version.assessment-version'
    > &
      Schema.Attribute.Required;
    attempt: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-attempt.assessment-attempt'
    > &
      Schema.Attribute.Required;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    configuredTotalMaxScore: Schema.Attribute.Decimal;
    confirmationStatus: Schema.Attribute.Enumeration<
      ['draft', 'confirmed', 'superseded', 'cancelled']
    >;
    confirmedAt: Schema.Attribute.DateTime;
    confirmedBandCode: Schema.Attribute.String;
    confirmedLabel: Schema.Attribute.String;
    confirmedLevel: Schema.Attribute.Enumeration<
      ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isCurrent: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-result.assessment-result'
    > &
      Schema.Attribute.Private;
    manualMaxScore: Schema.Attribute.Decimal;
    manualScore: Schema.Attribute.Decimal;
    maxScore: Schema.Attribute.Decimal;
    objectiveMaxScore: Schema.Attribute.Decimal;
    objectiveScore: Schema.Attribute.Decimal;
    pendingManualCount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    pendingManualMaxScore: Schema.Attribute.Decimal;
    percentage: Schema.Attribute.Decimal;
    placementBandCode: Schema.Attribute.String;
    placementLabel: Schema.Attribute.String;
    placementNotes: Schema.Attribute.Text;
    provisionalLevel: Schema.Attribute.Enumeration<
      ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    >;
    publishedAt: Schema.Attribute.DateTime;
    rawScore: Schema.Attribute.Decimal;
    resultMode: Schema.Attribute.Enumeration<['provisional', 'final']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'provisional'>;
    resultSnapshot: Schema.Attribute.JSON;
    scoredAt: Schema.Attribute.DateTime;
    scoreSummary: Schema.Attribute.JSON;
    scoringStartedAt: Schema.Attribute.DateTime;
    scoringVersion: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    sectionScores: Schema.Attribute.JSON;
    speakingReviewedAt: Schema.Attribute.DateTime;
    speakingReviewStatus: Schema.Attribute.Enumeration<
      ['pending', 'in_review', 'completed', 'cancelled']
    >;
    speakingSuggestedLevel: Schema.Attribute.Enumeration<
      ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    >;
    status: Schema.Attribute.Enumeration<
      [
        'pending',
        'partially_scored',
        'provisional',
        'confirmed',
        'superseded',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAssessmentSectionAssessmentSection
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_sections';
  info: {
    description: 'Logical assessment section grouping questions within a specific assessment version.';
    displayName: 'Assessment Section';
    pluralName: 'assessment-sections';
    singularName: 'assessment-section';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assessmentVersion: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-version.assessment-version'
    > &
      Schema.Attribute.Required;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.RichText;
    instruction: Schema.Attribute.RichText;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-section.assessment-section'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    questions: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-question.assessment-question'
    >;
    skill: Schema.Attribute.Relation<'manyToOne', 'api::skill.skill'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAssessmentSpeakingCriterionAssessmentSpeakingCriterion
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_speaking_criteria';
  info: {
    description: 'Tenant-scoped speaking review criterion configuration for one assessment version.';
    displayName: 'Assessment Speaking Criterion';
    pluralName: 'assessment-speaking-criteria';
    singularName: 'assessment-speaking-criterion';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assessmentVersion: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-version.assessment-version'
    > &
      Schema.Attribute.Required;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    guidance: Schema.Attribute.Text;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-speaking-criterion.assessment-speaking-criterion'
    > &
      Schema.Attribute.Private;
    maxScore: Schema.Attribute.Decimal & Schema.Attribute.Required;
    order: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    required: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    status: Schema.Attribute.Enumeration<['active', 'inactive']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    weight: Schema.Attribute.Decimal;
  };
}

export interface ApiAssessmentSpeakingReviewAssessmentSpeakingReview
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_speaking_reviews';
  info: {
    description: 'Tenant-scoped speaking review record for one assessment result.';
    displayName: 'Assessment Speaking Review';
    pluralName: 'assessment-speaking-reviews';
    singularName: 'assessment-speaking-review';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    areasForImprovement: Schema.Attribute.Text;
    assessment: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment.assessment'
    > &
      Schema.Attribute.Required;
    assessmentAttempt: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-attempt.assessment-attempt'
    > &
      Schema.Attribute.Required;
    assessmentResult: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-result.assessment-result'
    > &
      Schema.Attribute.Required;
    assessmentVersion: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment-version.assessment-version'
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    criteriaScores: Schema.Attribute.JSON;
    criteriaSnapshot: Schema.Attribute.JSON;
    lead: Schema.Attribute.Relation<'manyToOne', 'api::lead.lead'>;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-speaking-review.assessment-speaking-review'
    > &
      Schema.Attribute.Private;
    maxScore: Schema.Attribute.Decimal;
    overallScore: Schema.Attribute.Decimal;
    percentage: Schema.Attribute.Decimal;
    promptNotes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    recordingAsset: Schema.Attribute.Relation<
      'manyToOne',
      'api::file-asset.file-asset'
    >;
    reviewedAt: Schema.Attribute.DateTime;
    reviewer: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    reviewMode: Schema.Attribute.Enumeration<['live', 'recording']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'live'>;
    reviewNotes: Schema.Attribute.Text;
    reviewStartedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['pending', 'in_review', 'completed', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    strengths: Schema.Attribute.Text;
    suggestedLevel: Schema.Attribute.Enumeration<
      ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    >;
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

export interface ApiAssessmentVersionAssessmentVersion
  extends Struct.CollectionTypeSchema {
  collectionName: 'assessment_versions';
  info: {
    description: 'Versioned snapshot of an assessment definition, including grade range, candidate level range and runtime rules.';
    displayName: 'Assessment Version';
    pluralName: 'assessment-versions';
    singularName: 'assessment-version';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assessment: Schema.Attribute.Relation<
      'manyToOne',
      'api::assessment.assessment'
    > &
      Schema.Attribute.Required;
    candidateLevelFrom: Schema.Attribute.Enumeration<
      ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    >;
    candidateLevelTo: Schema.Attribute.Enumeration<
      ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    >;
    ceilingLevel: Schema.Attribute.Enumeration<
      ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    >;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.RichText;
    durationMinutes: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    gradeFrom: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    gradeTo: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    instructions: Schema.Attribute.RichText;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-version.assessment-version'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    requiresSpeaking: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    requiresTeacherConfirmation: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    resultMode: Schema.Attribute.Enumeration<['provisional', 'final']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'provisional'>;
    sections: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-section.assessment-section'
    >;
    speakingCriteria: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-speaking-criterion.assessment-speaking-criterion'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    versionStatus: Schema.Attribute.Enumeration<
      ['draft', 'published', 'retired']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
  };
}

export interface ApiAssessmentAssessment extends Struct.CollectionTypeSchema {
  collectionName: 'assessments';
  info: {
    description: 'Tenant-scoped reusable assessment definition independent from a specific published version.';
    displayName: 'Assessment';
    pluralName: 'assessments';
    singularName: 'assessment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assessmentType: Schema.Attribute.Enumeration<
      ['placement', 'diagnostic', 'practice', 'quiz', 'exam', 'other']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'placement'>;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.RichText;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment.assessment'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['draft', 'active', 'archived']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    subject: Schema.Attribute.Relation<'manyToOne', 'api::subject.subject'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    versions: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-version.assessment-version'
    >;
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

export interface ApiCampaignRegistrationCampaignRegistration
  extends Struct.CollectionTypeSchema {
  collectionName: 'campaign_registrations';
  info: {
    description: 'A user registration record under a tenant registration campaign.';
    displayName: 'Campaign Registration';
    pluralName: 'campaign-registrations';
    singularName: 'campaign-registration';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approvedAt: Schema.Attribute.DateTime;
    approvedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    campaign: Schema.Attribute.Relation<
      'manyToOne',
      'api::registration-campaign.registration-campaign'
    > &
      Schema.Attribute.Required;
    cancelledAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deletedAt: Schema.Attribute.DateTime;
    deletedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    email: Schema.Attribute.Email & Schema.Attribute.Required;
    emailChangedAt: Schema.Attribute.DateTime;
    formData: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    fullName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    isDeleted: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    lastVerificationRequestAt: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::campaign-registration.campaign-registration'
    > &
      Schema.Attribute.Private;
    membership: Schema.Attribute.Relation<
      'manyToOne',
      'api::user-tenant.user-tenant'
    >;
    metadata: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    phone: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    registeredAt: Schema.Attribute.DateTime;
    registrationSource: Schema.Attribute.Enumeration<
      [
        'campaign_link',
        'manual_code',
        'invite',
        'admin',
        'import',
        'api',
        'other',
      ]
    > &
      Schema.Attribute.DefaultTo<'campaign_link'>;
    rejectedAt: Schema.Attribute.DateTime;
    rejectedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    rejectionReason: Schema.Attribute.Text;
    status: Schema.Attribute.Enumeration<
      [
        'pending_verification',
        'verified',
        'approved',
        'rejected',
        'cancelled',
        'expired',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending_verification'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    termsAccepted: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    termsAcceptedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    verificationExpiresAt: Schema.Attribute.DateTime;
    verificationSendCount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    verificationSentAt: Schema.Attribute.DateTime;
    verificationTokenHash: Schema.Attribute.String & Schema.Attribute.Private;
    verifiedAt: Schema.Attribute.DateTime;
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

export interface ApiClubMembershipHistoryClubMembershipHistory
  extends Struct.CollectionTypeSchema {
  collectionName: 'club_membership_histories';
  info: {
    description: 'Append-only history events for meaningful sports club membership lifecycle changes.';
    displayName: 'Club Membership History';
    pluralName: 'club-membership-histories';
    singularName: 'club-membership-history';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    eventAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    eventType: Schema.Attribute.Enumeration<
      [
        'joined',
        'approved',
        'rejected',
        'left',
        'rejoined',
        'activated',
        'deactivated',
        'suspended',
        'reactivated',
        'role_changed',
        'position_changed',
        'member_code_changed',
        'info_updated',
        'other',
      ]
    > &
      Schema.Attribute.Required;
    fromPositionTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    fromRole: Schema.Attribute.Enumeration<
      ['member', 'manager', 'admin', 'owner']
    >;
    fromStatus: Schema.Attribute.Enumeration<
      ['pending', 'active', 'inactive', 'left', 'suspended', 'rejected']
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::club-membership-history.club-membership-history'
    > &
      Schema.Attribute.Private;
    membership: Schema.Attribute.Relation<
      'manyToOne',
      'api::club-membership.club-membership'
    > &
      Schema.Attribute.Required;
    metadata: Schema.Attribute.JSON;
    note: Schema.Attribute.Text;
    performedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    publishedAt: Schema.Attribute.DateTime;
    source: Schema.Attribute.Enumeration<
      [
        'system',
        'admin',
        'self_service',
        'import',
        'campaign',
        'invite',
        'other',
      ]
    > &
      Schema.Attribute.DefaultTo<'admin'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    toPositionTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    toRole: Schema.Attribute.Enumeration<
      ['member', 'manager', 'admin', 'owner']
    >;
    toStatus: Schema.Attribute.Enumeration<
      ['pending', 'active', 'inactive', 'left', 'suspended', 'rejected']
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiClubMembershipClubMembership
  extends Struct.CollectionTypeSchema {
  collectionName: 'club_memberships';
  info: {
    description: 'Tenant-scoped current membership relation between one sports profile and one sports club.';
    displayName: 'Club Membership';
    pluralName: 'club-memberships';
    singularName: 'club-membership';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approvedAt: Schema.Attribute.DateTime;
    approvedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    club: Schema.Attribute.Relation<
      'manyToOne',
      'api::sports-club.sports-club'
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    joinedAt: Schema.Attribute.Date;
    joinMessage: Schema.Attribute.Text;
    leftAt: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::club-membership.club-membership'
    > &
      Schema.Attribute.Private;
    memberCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    note: Schema.Attribute.Text;
    oldMemberCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    positionTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Enumeration<
      ['member', 'manager', 'admin', 'owner']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'member'>;
    source: Schema.Attribute.Enumeration<
      [
        'manual_import',
        'self_registration',
        'campaign',
        'invite',
        'admin_created',
        'other',
      ]
    >;
    sourceReference: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    sportsProfile: Schema.Attribute.Relation<
      'manyToOne',
      'api::sports-profile.sports-profile'
    > &
      Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<
      ['pending', 'active', 'inactive', 'left', 'suspended', 'rejected']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
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

export interface ApiExamCandidateListExamCandidateList
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_candidate_lists';
  info: {
    description: 'Tenant-scoped candidate lists for exam schedules.';
    displayName: 'Exam Candidate List';
    pluralName: 'exam-candidate-lists';
    singularName: 'exam-candidate-list';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approvalStatus: Schema.Attribute.Enumeration<
      ['draft', 'pending_approval', 'approved', 'rejected']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    approvedAt: Schema.Attribute.DateTime;
    approvedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    examCandidates: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-candidate.exam-candidate'
    >;
    examRound: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round.exam-round'
    > &
      Schema.Attribute.Required;
    examSchedule: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-schedule.exam-schedule'
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-candidate-list.exam-candidate-list'
    > &
      Schema.Attribute.Private;
    lockedAt: Schema.Attribute.DateTime;
    lockedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    lockStatus: Schema.Attribute.Enumeration<['unlocked', 'locked']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'unlocked'>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    note: Schema.Attribute.Text;
    preparedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    publishedAt: Schema.Attribute.DateTime;
    returnedAt: Schema.Attribute.DateTime;
    returnedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    returnReason: Schema.Attribute.Text;
    submittedAt: Schema.Attribute.DateTime;
    submittedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    unlockedAt: Schema.Attribute.DateTime;
    unlockedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    unlockReason: Schema.Attribute.Text;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
  };
}

export interface ApiExamCandidateExamCandidate
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_candidates';
  info: {
    description: 'Tenant-scoped scheduled candidates in an exam candidate list.';
    displayName: 'Exam Candidate';
    pluralName: 'exam-candidates';
    singularName: 'exam-candidate';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    attendanceStatus: Schema.Attribute.Enumeration<
      [
        'not_checked_in',
        'present',
        'late',
        'absent_excused',
        'absent_unexcused',
        'suspended',
        'technical_issue',
        'rescheduled',
        'completed',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_checked_in'>;
    candidateNumber: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    candidateStatus: Schema.Attribute.Enumeration<
      [
        'scheduled',
        'present',
        'late',
        'absent',
        'suspended',
        'technical_issue',
        'rescheduled',
        'completed',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'scheduled'>;
    componentResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-component-result.exam-component-result'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    examAccount: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    examCandidateList: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-candidate-list.exam-candidate-list'
    > &
      Schema.Attribute.Required;
    examRegistration: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-registration.exam-registration'
    > &
      Schema.Attribute.Required;
    examRegistrationComponent: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-registration-component.exam-registration-component'
    > &
      Schema.Attribute.Required;
    examRegistrationSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-registration-subject.exam-registration-subject'
    > &
      Schema.Attribute.Required;
    externalCandidateId: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'> &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-candidate.exam-candidate'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    seatNumber: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    sequenceNumber: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    synchronizationStatus: Schema.Attribute.Enumeration<
      [
        'not_required',
        'pending',
        'synced',
        'failed',
        'resync_required',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_required'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamComponentResultExamComponentResult
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_component_results';
  info: {
    description: 'Tenant-scoped component-level exam results for learners.';
    displayName: 'Exam Component Result';
    pluralName: 'exam-component-results';
    singularName: 'exam-component-result';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    adjustmentReason: Schema.Attribute.Text;
    approvalStatus: Schema.Attribute.Enumeration<
      ['pending_review', 'verified', 'approved', 'rejected']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending_review'>;
    approvedAt: Schema.Attribute.DateTime;
    approvedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    attemptNumber: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    derivedResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-component-result.exam-component-result'
    >;
    effectiveFrom: Schema.Attribute.DateTime;
    effectiveUntil: Schema.Attribute.DateTime;
    enteredBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    examCandidate: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-candidate.exam-candidate'
    >;
    examRegistration: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-registration.exam-registration'
    >;
    examRegistrationComponent: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-registration-component.exam-registration-component'
    >;
    examRound: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round.exam-round'
    >;
    examRoundComponent: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round-component.exam-round-component'
    >;
    examRoundSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round-subject.exam-round-subject'
    >;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'> &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-component-result.exam-component-result'
    > &
      Schema.Attribute.Private;
    lockedAt: Schema.Attribute.DateTime;
    lockedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    lockStatus: Schema.Attribute.Enumeration<['unlocked', 'locked']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'unlocked'>;
    maximumScoreSnapshot: Schema.Attribute.Decimal;
    minimumScoreSnapshot: Schema.Attribute.Decimal;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    reconciliationStatus: Schema.Attribute.Enumeration<
      [
        'pending',
        'matched',
        'unmatched',
        'invalid',
        'duplicate',
        'reconciliation_required',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    score: Schema.Attribute.Decimal;
    sourceRegistrations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration-component.exam-registration-component'
    >;
    sourceResult: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-component-result.exam-component-result'
    >;
    sourceType: Schema.Attribute.Enumeration<
      [
        'itest',
        'manual',
        'import',
        'preserved_result',
        'equivalent_result',
        'exemption',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'manual'>;
    subjectResultLinks: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject-result-component.exam-subject-result-component'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    validityStatus: Schema.Attribute.Enumeration<
      ['active', 'expired', 'replaced', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    verifiedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiExamComponentExamComponent
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_components';
  info: {
    description: 'Tenant-scoped skill or exam part catalog.';
    displayName: 'Exam Component';
    pluralName: 'exam-components';
    singularName: 'exam-component';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    componentType: Schema.Attribute.Enumeration<['skill', 'part']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'skill'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultDurationMinutes: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    description: Schema.Attribute.Text;
    displayOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    eliminationScore: Schema.Attribute.Decimal;
    examMethod: Schema.Attribute.Enumeration<
      ['computer', 'paper', 'oral', 'practical', 'mixed', 'other']
    > &
      Schema.Attribute.DefaultTo<'other'>;
    examRoundComponents: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-round-component.exam-round-component'
    >;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-component.exam-component'
    > &
      Schema.Attribute.Private;
    maximumScore: Schema.Attribute.Decimal & Schema.Attribute.Required;
    minimumScore: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    passingScore: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    subjectComponents: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject-component.exam-subject-component'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamEligibilityExamEligibility
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_eligibilities';
  info: {
    description: 'Tenant-scoped learner eligibility records for an exam round.';
    displayName: 'Exam Eligibility';
    pluralName: 'exam-eligibilities';
    singularName: 'exam-eligibility';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    eligibilityStatus: Schema.Attribute.Enumeration<
      ['pending', 'eligible', 'temporarily_ineligible', 'ineligible']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    examRound: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round.exam-round'
    > &
      Schema.Attribute.Required;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'> &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-eligibility.exam-eligibility'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    reason: Schema.Attribute.Text;
    reviewedAt: Schema.Attribute.DateTime;
    reviewedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    source: Schema.Attribute.Enumeration<
      ['synchronized', 'imported', 'manual', 'rule_based']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'manual'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamIntegrationItemExamIntegrationItem
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_integration_items';
  info: {
    description: 'Tenant-scoped integration item records for exam data exchange.';
    displayName: 'Exam Integration Item';
    pluralName: 'exam-integration-items';
    singularName: 'exam-integration-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    actionType: Schema.Attribute.Enumeration<
      ['create', 'update', 'cancel', 'import']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'create'>;
    attempts: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entityId: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    entityType: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    externalId: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    idempotencyKey: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    integrationJob: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-integration-job.exam-integration-job'
    > &
      Schema.Attribute.Required;
    lastError: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-integration-item.exam-integration-item'
    > &
      Schema.Attribute.Private;
    processedAt: Schema.Attribute.DateTime;
    publishedAt: Schema.Attribute.DateTime;
    requestPayload: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    responsePayload: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    status: Schema.Attribute.Enumeration<
      [
        'pending',
        'processing',
        'success',
        'failed',
        'retry_required',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamIntegrationJobExamIntegrationJob
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_integration_jobs';
  info: {
    description: 'Tenant-scoped integration jobs for exam data exchange.';
    displayName: 'Exam Integration Job';
    pluralName: 'exam-integration-jobs';
    singularName: 'exam-integration-job';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    completedAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    examRound: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round.exam-round'
    >;
    failedItems: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    initiatedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    integrationItems: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-integration-item.exam-integration-item'
    >;
    integrationType: Schema.Attribute.Enumeration<
      [
        'student_import',
        'candidate_export',
        'candidate_update',
        'candidate_cancel',
        'score_import',
        'recognition_export',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'student_import'>;
    lastError: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-integration-job.exam-integration-job'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    requestMetadata: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    responseMetadata: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    sourceSystem: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    startedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      [
        'pending',
        'processing',
        'completed',
        'partially_completed',
        'failed',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    successItems: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    targetSystem: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    totalItems: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamPaymentExamPayment extends Struct.CollectionTypeSchema {
  collectionName: 'exam_payments';
  info: {
    description: 'Tenant-scoped payment reports and confirmations for exam registrations.';
    displayName: 'Exam Payment';
    pluralName: 'exam-payments';
    singularName: 'exam-payment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    evidenceFiles: Schema.Attribute.Relation<
      'manyToMany',
      'api::file-asset.file-asset'
    >;
    examRegistration: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-registration.exam-registration'
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-payment.exam-payment'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    paidAt: Schema.Attribute.DateTime;
    payerName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    paymentMethod: Schema.Attribute.Enumeration<
      ['bank_transfer', 'cash', 'online', 'accounting_confirmation', 'other']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'bank_transfer'>;
    publishedAt: Schema.Attribute.DateTime;
    refundAmount: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    refundedAt: Schema.Attribute.DateTime;
    rejectionReason: Schema.Attribute.Text;
    reportedAt: Schema.Attribute.DateTime;
    reportedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    status: Schema.Attribute.Enumeration<
      [
        'reported',
        'under_review',
        'confirmed',
        'rejected',
        'refund_pending',
        'refunded',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'reported'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    transactionCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    verifiedAt: Schema.Attribute.DateTime;
    verifiedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiExamProgramResultSubjectExamProgramResultSubject
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_program_result_subjects';
  info: {
    description: 'Tenant-scoped bridge between program results and subject results.';
    displayName: 'Exam Program Result Subject';
    pluralName: 'exam-program-result-subjects';
    singularName: 'exam-program-result-subject';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    examProgramResult: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-program-result.exam-program-result'
    > &
      Schema.Attribute.Required;
    examSubjectResult: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-subject-result.exam-subject-result'
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program-result-subject.exam-program-result-subject'
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

export interface ApiExamProgramResultExamProgramResult
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_program_results';
  info: {
    description: 'Tenant-scoped program-level result aggregation for learners.';
    displayName: 'Exam Program Result';
    pluralName: 'exam-program-results';
    singularName: 'exam-program-result';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approvalStatus: Schema.Attribute.Enumeration<
      ['pending_review', 'approved', 'rejected']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending_review'>;
    approvedAt: Schema.Attribute.DateTime;
    approvedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    calculatedAt: Schema.Attribute.DateTime;
    calculationRuleSnapshot: Schema.Attribute.JSON &
      Schema.Attribute.DefaultTo<{}>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    examProgram: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-program.exam-program'
    > &
      Schema.Attribute.Required;
    examRegistration: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-registration.exam-registration'
    >;
    examRound: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round.exam-round'
    >;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'> &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program-result.exam-program-result'
    > &
      Schema.Attribute.Private;
    outcomeAssessmentCandidates: Schema.Attribute.Relation<
      'oneToMany',
      'api::outcome-assessment-candidate.outcome-assessment-candidate'
    >;
    programResultSubjects: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program-result-subject.exam-program-result-subject'
    >;
    publishedAt: Schema.Attribute.DateTime;
    resultStatus: Schema.Attribute.Enumeration<
      ['not_evaluated', 'insufficient_data', 'passed', 'failed', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_evaluated'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamProgramSubjectExamProgramSubject
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_program_subjects';
  info: {
    description: 'Tenant-scoped subject membership for an exam program.';
    displayName: 'Exam Program Subject';
    pluralName: 'exam-program-subjects';
    singularName: 'exam-program-subject';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    displayOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    examProgram: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-program.exam-program'
    > &
      Schema.Attribute.Required;
    examRoundSubjects: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-round-subject.exam-round-subject'
    >;
    examSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-subject.exam-subject'
    > &
      Schema.Attribute.Required;
    feeOverride: Schema.Attribute.Decimal;
    isRequired: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program-subject.exam-program-subject'
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

export interface ApiExamProgramExamProgram extends Struct.CollectionTypeSchema {
  collectionName: 'exam_programs';
  info: {
    description: 'Tenant-scoped exam program catalog.';
    displayName: 'Exam Program';
    pluralName: 'exam-programs';
    singularName: 'exam-program';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultFee: Schema.Attribute.Decimal;
    examRounds: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-round.exam-round'
    >;
    feeCalculationMethod: Schema.Attribute.Enumeration<
      ['sum_subject_fees', 'fixed']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'sum_subject_fees'>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program.exam-program'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    outcomeAssessmentRounds: Schema.Attribute.Relation<
      'oneToMany',
      'api::outcome-assessment-round.outcome-assessment-round'
    >;
    outcomeStandards: Schema.Attribute.Relation<
      'oneToMany',
      'api::outcome-standard.outcome-standard'
    >;
    passingMethod: Schema.Attribute.Enumeration<
      ['all_subjects_pass', 'any_subject_pass', 'custom']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'all_subjects_pass'>;
    programResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program-result.exam-program-result'
    >;
    programSubjects: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program-subject.exam-program-subject'
    >;
    publishedAt: Schema.Attribute.DateTime;
    targetDescription: Schema.Attribute.Text;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    validFrom: Schema.Attribute.Date;
    validTo: Schema.Attribute.Date;
  };
}

export interface ApiExamRegistrationComponentExamRegistrationComponent
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_registration_components';
  info: {
    description: 'Tenant-scoped component registrations within an exam registration.';
    displayName: 'Exam Registration Component';
    pluralName: 'exam-registration-components';
    singularName: 'exam-registration-component';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allowSeparateRegistrationSnapshot: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    attendanceStatus: Schema.Attribute.Enumeration<
      [
        'not_checked_in',
        'present',
        'late',
        'absent_excused',
        'absent_unexcused',
        'suspended',
        'technical_issue',
        'rescheduled',
        'completed',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_checked_in'>;
    componentCodeSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    componentResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-component-result.exam-component-result'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    durationMinutesSnapshot: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    eligibilityStatus: Schema.Attribute.Enumeration<
      ['pending', 'eligible', 'ineligible']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    examCandidates: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-candidate.exam-candidate'
    >;
    examMethodSnapshot: Schema.Attribute.Enumeration<
      ['computer', 'paper', 'oral', 'practical', 'mixed', 'other']
    > &
      Schema.Attribute.DefaultTo<'other'>;
    examRegistration: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-registration.exam-registration'
    > &
      Schema.Attribute.Required;
    examRegistrationSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-registration-subject.exam-registration-subject'
    > &
      Schema.Attribute.Required;
    examRoundComponent: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round-component.exam-round-component'
    > &
      Schema.Attribute.Required;
    examSchedule: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-schedule.exam-schedule'
    >;
    feeAmount: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    isRequiredSnapshot: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration-component.exam-registration-component'
    > &
      Schema.Attribute.Private;
    nameSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    note: Schema.Attribute.Text;
    participationType: Schema.Attribute.Enumeration<
      [
        'new_exam',
        'preserved_result',
        'equivalent_result',
        'exempted',
        'not_required',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'new_exam'>;
    publishedAt: Schema.Attribute.DateTime;
    registrationStatus: Schema.Attribute.Enumeration<
      ['registered', 'accepted', 'cancelled', 'completed']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'registered'>;
    resultStatus: Schema.Attribute.Enumeration<
      [
        'pending',
        'available',
        'insufficient_data',
        'passed',
        'failed',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    schedulingStatus: Schema.Attribute.Enumeration<
      ['not_scheduled', 'scheduled', 'reschedule_required']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_scheduled'>;
    sourceResult: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-component-result.exam-component-result'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamRegistrationSubjectExamRegistrationSubject
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_registration_subjects';
  info: {
    description: 'Tenant-scoped subject registrations within an exam registration.';
    displayName: 'Exam Registration Subject';
    pluralName: 'exam-registration-subjects';
    singularName: 'exam-registration-subject';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allowSeparateRegistrationSnapshot: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    calculationMethodSnapshot: Schema.Attribute.Enumeration<
      ['total', 'average', 'all_components_pass', 'custom']
    > &
      Schema.Attribute.DefaultTo<'total'>;
    componentRegistrations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration-component.exam-registration-component'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    examCandidates: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-candidate.exam-candidate'
    >;
    examRegistration: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-registration.exam-registration'
    > &
      Schema.Attribute.Required;
    examRoundSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round-subject.exam-round-subject'
    > &
      Schema.Attribute.Required;
    feeAmount: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    isRequiredSnapshot: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration-subject.exam-registration-subject'
    > &
      Schema.Attribute.Private;
    nameSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    note: Schema.Attribute.Text;
    participationType: Schema.Attribute.Enumeration<
      [
        'new_exam',
        'preserved_result',
        'equivalent_result',
        'exempted',
        'not_required',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'new_exam'>;
    publishedAt: Schema.Attribute.DateTime;
    registrationStatus: Schema.Attribute.Enumeration<
      ['registered', 'accepted', 'cancelled', 'completed']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'registered'>;
    requireAllComponentsSnapshot: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    requiredAggregateScoreSnapshot: Schema.Attribute.Decimal;
    ruleDescriptionSnapshot: Schema.Attribute.RichText;
    subjectCodeSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    subjectResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject-result.exam-subject-result'
    >;
    subjectResultStatus: Schema.Attribute.Enumeration<
      ['not_evaluated', 'insufficient_data', 'passed', 'failed']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_evaluated'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamRegistrationExamRegistration
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_registrations';
  info: {
    description: 'Tenant-scoped learner exam registrations.';
    displayName: 'Exam Registration';
    pluralName: 'exam-registrations';
    singularName: 'exam-registration';
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
    amountDue: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    calculatedAmount: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    cancellationReason: Schema.Attribute.Text;
    cancelledAt: Schema.Attribute.DateTime;
    classNameSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    cohortSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    completedAt: Schema.Attribute.DateTime;
    componentFeeTotalSnapshot: Schema.Attribute.Decimal &
      Schema.Attribute.DefaultTo<0>;
    componentRegistrations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration-component.exam-registration-component'
    >;
    componentResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-component-result.exam-component-result'
    >;
    confirmedPaidAmount: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 10;
      }> &
      Schema.Attribute.DefaultTo<'VND'>;
    discountAmount: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    eligibilityReason: Schema.Attribute.Text;
    eligibilityStatus: Schema.Attribute.Enumeration<
      ['pending', 'eligible', 'temporarily_ineligible', 'ineligible']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    examCandidates: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-candidate.exam-candidate'
    >;
    examRound: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round.exam-round'
    > &
      Schema.Attribute.Required;
    fixedFeeSnapshot: Schema.Attribute.Decimal;
    fullNameSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'> &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration.exam-registration'
    > &
      Schema.Attribute.Private;
    majorSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    note: Schema.Attribute.Text;
    payableAmount: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    paymentAccountHolderSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    paymentAccountNumberSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    paymentBankBranchSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    paymentBankCodeSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    paymentBankNameSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    paymentCalculationMethodSnapshot: Schema.Attribute.Enumeration<
      ['fixed', 'program_fee', 'subject_fee', 'component_fee']
    > &
      Schema.Attribute.DefaultTo<'program_fee'>;
    paymentConfirmationNote: Schema.Attribute.Text;
    paymentConfirmedAt: Schema.Attribute.DateTime;
    paymentConfirmedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    paymentDueAt: Schema.Attribute.DateTime;
    paymentEvidence: Schema.Attribute.Relation<
      'manyToOne',
      'api::file-asset.file-asset'
    >;
    paymentInstructionSnapshot: Schema.Attribute.RichText;
    paymentMethodSnapshot: Schema.Attribute.Enumeration<
      ['bank_transfer', 'cash', 'other']
    > &
      Schema.Attribute.DefaultTo<'bank_transfer'>;
    paymentProfileCodeSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    paymentProfileNameSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    paymentQrImageSnapshot: Schema.Attribute.Media<'images'>;
    paymentRejectedAt: Schema.Attribute.DateTime;
    paymentRejectedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    paymentRejectionReason: Schema.Attribute.Text;
    paymentReportedAt: Schema.Attribute.DateTime;
    paymentReportedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    paymentReportNote: Schema.Attribute.Text;
    paymentReportUpdatedAt: Schema.Attribute.DateTime;
    payments: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-payment.exam-payment'
    >;
    paymentSenderAccount: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    paymentSenderBank: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    paymentSenderName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    paymentStatus: Schema.Attribute.Enumeration<
      [
        'not_required',
        'unpaid',
        'payment_reported',
        'payment_under_review',
        'partially_paid',
        'paid',
        'payment_rejected',
        'exempted',
        'refund_pending',
        'refunded',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'unpaid'>;
    paymentSupportEmailSnapshot: Schema.Attribute.Email;
    paymentSupportPhoneSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
    paymentTransactionReference: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    paymentTransferAt: Schema.Attribute.DateTime;
    paymentTransferContent: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    paymentTransferContentTemplateSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    programResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program-result.exam-program-result'
    >;
    publishedAt: Schema.Attribute.DateTime;
    registeredAt: Schema.Attribute.DateTime;
    registrationCode: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    registrationSource: Schema.Attribute.Enumeration<
      ['learner', 'staff', 'import']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'learner'>;
    registrationStatus: Schema.Attribute.Enumeration<
      [
        'draft',
        'submitted',
        'pending_review',
        'accepted',
        'returned',
        'rejected',
        'cancelled',
        'completed',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    rejectedAt: Schema.Attribute.DateTime;
    rejectedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    rejectionReason: Schema.Attribute.Text;
    returnedAt: Schema.Attribute.DateTime;
    returnedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    returnReason: Schema.Attribute.Text;
    reviewedAt: Schema.Attribute.DateTime;
    reviewedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    reviewHistory: Schema.Attribute.JSON;
    reviewNote: Schema.Attribute.Text;
    studentCodeSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    subjectFeeTotalSnapshot: Schema.Attribute.Decimal &
      Schema.Attribute.DefaultTo<0>;
    subjectRegistrations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration-subject.exam-registration-subject'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamRoomExamRoom extends Struct.CollectionTypeSchema {
  collectionName: 'exam_rooms';
  info: {
    description: 'Tenant-scoped exam room catalog.';
    displayName: 'Exam Room';
    pluralName: 'exam-rooms';
    singularName: 'exam-room';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    capacity: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    examRounds: Schema.Attribute.Relation<
      'manyToMany',
      'api::exam-round.exam-round'
    >;
    examSchedules: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-schedule.exam-schedule'
    >;
    examVenue: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-venue.exam-venue'
    > &
      Schema.Attribute.Required;
    floor: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-room.exam-room'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    roomType: Schema.Attribute.Enumeration<
      ['computer', 'standard', 'oral', 'practical', 'other']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'standard'>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamRoundComponentExamRoundComponent
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_round_components';
  info: {
    description: 'Tenant-scoped component snapshot inside an exam round subject.';
    displayName: 'Exam Round Component';
    pluralName: 'exam-round-components';
    singularName: 'exam-round-component';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allowSeparateRegistration: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    componentResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-component-result.exam-component-result'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    displayOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    durationMinutes: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    eliminationScoreSnapshot: Schema.Attribute.Decimal;
    examComponent: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-component.exam-component'
    > &
      Schema.Attribute.Required;
    examMethod: Schema.Attribute.Enumeration<
      ['computer', 'paper', 'oral', 'practical', 'mixed', 'other']
    > &
      Schema.Attribute.DefaultTo<'other'>;
    examRound: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round.exam-round'
    > &
      Schema.Attribute.Required;
    examRoundSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round-subject.exam-round-subject'
    > &
      Schema.Attribute.Required;
    examSchedules: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-schedule.exam-schedule'
    >;
    externalExamCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    fee: Schema.Attribute.Decimal;
    isRequired: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-round-component.exam-round-component'
    > &
      Schema.Attribute.Private;
    maximumScoreSnapshot: Schema.Attribute.Decimal;
    minimumScoreSnapshot: Schema.Attribute.Decimal;
    nameSnapshot: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    passingScoreSnapshot: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    registrationComponents: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration-component.exam-registration-component'
    >;
    status: Schema.Attribute.Enumeration<['active', 'inactive', 'cancelled']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamRoundSubjectExamRoundSubject
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_round_subjects';
  info: {
    description: 'Tenant-scoped subject snapshot inside an exam round.';
    displayName: 'Exam Round Subject';
    pluralName: 'exam-round-subjects';
    singularName: 'exam-round-subject';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allowSeparateRegistration: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    calculationMethodSnapshot: Schema.Attribute.Enumeration<
      ['total', 'average', 'all_components_pass', 'custom']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'total'>;
    componentResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-component-result.exam-component-result'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    displayOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    examRound: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round.exam-round'
    > &
      Schema.Attribute.Required;
    examRoundComponents: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-round-component.exam-round-component'
    >;
    examSchedules: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-schedule.exam-schedule'
    >;
    examSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-subject.exam-subject'
    > &
      Schema.Attribute.Required;
    fee: Schema.Attribute.Decimal;
    isRequired: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-round-subject.exam-round-subject'
    > &
      Schema.Attribute.Private;
    nameSnapshot: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    registrationSubjects: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration-subject.exam-registration-subject'
    >;
    requireAllComponentsSnapshot: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    requiredAggregateScoreSnapshot: Schema.Attribute.Decimal;
    ruleDescriptionSnapshot: Schema.Attribute.RichText;
    sourceProgramSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-program-subject.exam-program-subject'
    >;
    status: Schema.Attribute.Enumeration<['active', 'inactive', 'cancelled']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    subjectResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject-result.exam-subject-result'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamRoundExamRound extends Struct.CollectionTypeSchema {
  collectionName: 'exam_rounds';
  info: {
    description: 'Tenant-scoped exam round and registration window configuration.';
    displayName: 'Exam Round';
    pluralName: 'exam-rounds';
    singularName: 'exam-round';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    academicYear: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }>;
    allowCancellation: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    allowComponentSelection: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    allowSubjectSelection: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    approvalNote: Schema.Attribute.Text;
    approvedAt: Schema.Attribute.DateTime;
    approvedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    cancellationDeadline: Schema.Attribute.DateTime;
    candidateListClosingAt: Schema.Attribute.DateTime;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    componentResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-component-result.exam-component-result'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    eligibilities: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-eligibility.exam-eligibility'
    >;
    examCandidateLists: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-candidate-list.exam-candidate-list'
    >;
    examEndAt: Schema.Attribute.DateTime;
    examProgram: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-program.exam-program'
    > &
      Schema.Attribute.Required;
    examRegistrations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration.exam-registration'
    >;
    examRooms: Schema.Attribute.Relation<
      'manyToMany',
      'api::exam-room.exam-room'
    >;
    examRoundComponents: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-round-component.exam-round-component'
    >;
    examRoundSubjects: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-round-subject.exam-round-subject'
    >;
    examSchedules: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-schedule.exam-schedule'
    >;
    examStartAt: Schema.Attribute.DateTime;
    examVenues: Schema.Attribute.Relation<
      'manyToMany',
      'api::exam-venue.exam-venue'
    >;
    fixedFee: Schema.Attribute.Decimal;
    instructions: Schema.Attribute.RichText;
    integrationJobs: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-integration-job.exam-integration-job'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-round.exam-round'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    outcomeAssessmentRounds: Schema.Attribute.Relation<
      'manyToMany',
      'api::outcome-assessment-round.outcome-assessment-round'
    >;
    paymentAccountHolderSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    paymentAccountNumberSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    paymentBankBranchSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    paymentBankCodeSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    paymentBankNameSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    paymentCalculationMethod: Schema.Attribute.Enumeration<
      ['program_fee', 'subject_fee', 'component_fee', 'fixed']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'program_fee'>;
    paymentCurrencySnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 10;
      }>;
    paymentEndAt: Schema.Attribute.DateTime;
    paymentInstructions: Schema.Attribute.RichText;
    paymentInstructionSnapshot: Schema.Attribute.RichText;
    paymentMethodSnapshot: Schema.Attribute.Enumeration<
      ['bank_transfer', 'cash', 'other']
    >;
    paymentProfile: Schema.Attribute.Relation<
      'manyToOne',
      'api::payment-profile.payment-profile'
    >;
    paymentProfileAppliedAt: Schema.Attribute.DateTime;
    paymentProfileAppliedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    paymentProfileCodeSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    paymentProfileCustomized: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    paymentProfileNameSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    paymentQrImageSnapshot: Schema.Attribute.Media<'images'>;
    paymentSettingsUpdatedAt: Schema.Attribute.DateTime;
    paymentSettingsUpdatedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    paymentStartAt: Schema.Attribute.DateTime;
    paymentSupportEmailSnapshot: Schema.Attribute.Email;
    paymentSupportPhoneSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
    paymentTransferContentTemplateSnapshot: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    programResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program-result.exam-program-result'
    >;
    publishedAt: Schema.Attribute.DateTime;
    registrationClosedAt: Schema.Attribute.DateTime;
    registrationClosedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    registrationCloseReason: Schema.Attribute.Text;
    registrationEndAt: Schema.Attribute.DateTime;
    registrationMode: Schema.Attribute.Enumeration<['open', 'restricted']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'open'>;
    registrationOpenedAt: Schema.Attribute.DateTime;
    registrationOpenedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    registrationPausedAt: Schema.Attribute.DateTime;
    registrationPausedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    registrationPauseReason: Schema.Attribute.Text;
    registrationResumedAt: Schema.Attribute.DateTime;
    registrationResumedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    registrationStartAt: Schema.Attribute.DateTime;
    requireConfirmedPayment: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    returnedAt: Schema.Attribute.DateTime;
    returnedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    returnReason: Schema.Attribute.Text;
    semester: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }>;
    status: Schema.Attribute.Enumeration<
      [
        'draft',
        'pending_approval',
        'approved',
        'registration_open',
        'registration_paused',
        'registration_closed',
        'preparing_exam',
        'exam_in_progress',
        'scoring',
        'completed',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    subjectResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject-result.exam-subject-result'
    >;
    submittedAt: Schema.Attribute.DateTime;
    submittedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamScheduleExamSchedule
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_schedules';
  info: {
    description: 'Tenant-scoped exam schedules for round subjects and components.';
    displayName: 'Exam Schedule';
    pluralName: 'exam-schedules';
    singularName: 'exam-schedule';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    cancellationReason: Schema.Attribute.Text;
    cancelledAt: Schema.Attribute.DateTime;
    cancelledBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    capacity: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    durationMinutes: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    endAt: Schema.Attribute.DateTime;
    examCandidateLists: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-candidate-list.exam-candidate-list'
    >;
    examMethod: Schema.Attribute.Enumeration<
      ['computer', 'paper', 'oral', 'practical', 'mixed', 'other']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'other'>;
    examRoom: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-room.exam-room'
    >;
    examRound: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round.exam-round'
    > &
      Schema.Attribute.Required;
    examRoundComponent: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round-component.exam-round-component'
    > &
      Schema.Attribute.Required;
    examRoundSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round-subject.exam-round-subject'
    > &
      Schema.Attribute.Required;
    examVenue: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-venue.exam-venue'
    >;
    externalExamCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-schedule.exam-schedule'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    registrationComponents: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration-component.exam-registration-component'
    >;
    schedulePublishedAt: Schema.Attribute.DateTime;
    schedulePublishedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    startAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<
      [
        'draft',
        'scheduled',
        'published',
        'in_progress',
        'completed',
        'postponed',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamSubjectComponentExamSubjectComponent
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_subject_components';
  info: {
    description: 'Tenant-scoped component membership for an exam subject.';
    displayName: 'Exam Subject Component';
    pluralName: 'exam-subject-components';
    singularName: 'exam-subject-component';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    displayOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    durationMinutesOverride: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    eliminationScoreOverride: Schema.Attribute.Decimal;
    examComponent: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-component.exam-component'
    > &
      Schema.Attribute.Required;
    examSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-subject.exam-subject'
    > &
      Schema.Attribute.Required;
    isRequired: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject-component.exam-subject-component'
    > &
      Schema.Attribute.Private;
    passingScoreOverride: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    weight: Schema.Attribute.Decimal;
  };
}

export interface ApiExamSubjectResultComponentExamSubjectResultComponent
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_subject_result_components';
  info: {
    description: 'Tenant-scoped bridge between subject results and component results.';
    displayName: 'Exam Subject Result Component';
    pluralName: 'exam-subject-result-components';
    singularName: 'exam-subject-result-component';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    examComponentResult: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-component-result.exam-component-result'
    > &
      Schema.Attribute.Required;
    examSubjectResult: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-subject-result.exam-subject-result'
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject-result-component.exam-subject-result-component'
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

export interface ApiExamSubjectResultExamSubjectResult
  extends Struct.CollectionTypeSchema {
  collectionName: 'exam_subject_results';
  info: {
    description: 'Tenant-scoped subject-level result aggregation for learners.';
    displayName: 'Exam Subject Result';
    pluralName: 'exam-subject-results';
    singularName: 'exam-subject-result';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approvalStatus: Schema.Attribute.Enumeration<
      ['pending_review', 'approved', 'rejected']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending_review'>;
    approvedAt: Schema.Attribute.DateTime;
    approvedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    averageScore: Schema.Attribute.Decimal;
    calculatedAt: Schema.Attribute.DateTime;
    calculationRuleSnapshot: Schema.Attribute.JSON &
      Schema.Attribute.DefaultTo<{}>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    examRegistrationSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-registration-subject.exam-registration-subject'
    >;
    examRound: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round.exam-round'
    >;
    examRoundSubject: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-round-subject.exam-round-subject'
    > &
      Schema.Attribute.Required;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'> &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject-result.exam-subject-result'
    > &
      Schema.Attribute.Private;
    programResultLinks: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program-result-subject.exam-program-result-subject'
    >;
    publishedAt: Schema.Attribute.DateTime;
    resultStatus: Schema.Attribute.Enumeration<
      ['not_evaluated', 'insufficient_data', 'passed', 'failed', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_evaluated'>;
    subjectResultComponents: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject-result-component.exam-subject-result-component'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    totalScore: Schema.Attribute.Decimal;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamSubjectExamSubject extends Struct.CollectionTypeSchema {
  collectionName: 'exam_subjects';
  info: {
    description: 'Tenant-scoped exam subject catalog.';
    displayName: 'Exam Subject';
    pluralName: 'exam-subjects';
    singularName: 'exam-subject';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    calculationMethod: Schema.Attribute.Enumeration<
      ['total', 'average', 'all_components_pass', 'custom']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'total'>;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultFee: Schema.Attribute.Decimal;
    examRoundSubjects: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-round-subject.exam-round-subject'
    >;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject.exam-subject'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    programSubjects: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program-subject.exam-program-subject'
    >;
    publishedAt: Schema.Attribute.DateTime;
    requireAllComponents: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    requiredAggregateScore: Schema.Attribute.Decimal;
    ruleDescription: Schema.Attribute.RichText;
    subjectComponents: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject-component.exam-subject-component'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiExamVenueExamVenue extends Struct.CollectionTypeSchema {
  collectionName: 'exam_venues';
  info: {
    description: 'Tenant-scoped exam venue catalog.';
    displayName: 'Exam Venue';
    pluralName: 'exam-venues';
    singularName: 'exam-venue';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    address: Schema.Attribute.Text;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    contactName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    contactPhone: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    examRooms: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-room.exam-room'
    >;
    examRounds: Schema.Attribute.Relation<
      'manyToMany',
      'api::exam-round.exam-round'
    >;
    examSchedules: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-schedule.exam-schedule'
    >;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-venue.exam-venue'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    shortName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
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
    examCandidates: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-candidate.exam-candidate'
    >;
    examComponentResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-component-result.exam-component-result'
    >;
    examEligibilities: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-eligibility.exam-eligibility'
    >;
    examProgramResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-program-result.exam-program-result'
    >;
    examRegistrations: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-registration.exam-registration'
    >;
    examSubjectResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::exam-subject-result.exam-subject-result'
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
    outcomeAssessmentCandidates: Schema.Attribute.Relation<
      'oneToMany',
      'api::outcome-assessment-candidate.outcome-assessment-candidate'
    >;
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

export interface ApiLuckyWheelParticipantLuckyWheelParticipant
  extends Struct.CollectionTypeSchema {
  collectionName: 'lucky_wheel_participants';
  info: {
    description: 'Participants of a Lucky Wheel campaign';
    displayName: 'Lucky Wheel Participant';
    pluralName: 'lucky-wheel-participants';
    singularName: 'lucky-wheel-participant';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    blockedAt: Schema.Attribute.DateTime;
    cancelledAt: Schema.Attribute.DateTime;
    className: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deletedAt: Schema.Attribute.DateTime;
    email: Schema.Attribute.String;
    fullName: Schema.Attribute.String;
    isDeleted: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel-participant.lucky-wheel-participant'
    > &
      Schema.Attribute.Private;
    luckyWheel: Schema.Attribute.Relation<
      'manyToOne',
      'api::lucky-wheel.lucky-wheel'
    > &
      Schema.Attribute.Required;
    note: Schema.Attribute.Text;
    participantCode: Schema.Attribute.String & Schema.Attribute.Required;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registeredAt: Schema.Attribute.DateTime;
    source: Schema.Attribute.Enumeration<
      ['admin_created', 'imported', 'generated', 'self_registered']
    > &
      Schema.Attribute.DefaultTo<'admin_created'>;
    spins: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel-spin.lucky-wheel-spin'
    >;
    status: Schema.Attribute.Enumeration<
      ['eligible', 'used', 'blocked', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'eligible'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    usedAt: Schema.Attribute.DateTime;
  };
}

export interface ApiLuckyWheelPrizeLuckyWheelPrize
  extends Struct.CollectionTypeSchema {
  collectionName: 'lucky_wheel_prizes';
  info: {
    description: 'Prize or outcome segments of a Lucky Wheel campaign';
    displayName: 'Lucky Wheel Prize';
    pluralName: 'lucky-wheel-prizes';
    singularName: 'lucky-wheel-prize';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deletedAt: Schema.Attribute.DateTime;
    description: Schema.Attribute.Text;
    displayColor: Schema.Attribute.String;
    displayOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    image: Schema.Attribute.Media<'images'>;
    imageFile: Schema.Attribute.Relation<
      'manyToOne',
      'api::file-asset.file-asset'
    >;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    isDeleted: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    isNoPrize: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    isUnlimited: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel-prize.lucky-wheel-prize'
    > &
      Schema.Attribute.Private;
    luckyWheel: Schema.Attribute.Relation<
      'manyToOne',
      'api::lucky-wheel.lucky-wheel'
    > &
      Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    quantity: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    remainingQuantity: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    resultMessage: Schema.Attribute.Text;
    shortLabel: Schema.Attribute.String;
    spins: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel-spin.lucky-wheel-spin'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    textColor: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    weight: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
  };
}

export interface ApiLuckyWheelSpinLuckyWheelSpin
  extends Struct.CollectionTypeSchema {
  collectionName: 'lucky_wheel_spins';
  info: {
    description: 'Recorded Lucky Wheel spin results';
    displayName: 'Lucky Wheel Spin';
    pluralName: 'lucky-wheel-spins';
    singularName: 'lucky-wheel-spin';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    claimedAt: Schema.Attribute.DateTime;
    claimedByName: Schema.Attribute.String;
    claimNote: Schema.Attribute.Text;
    claimStatus: Schema.Attribute.Enumeration<
      ['not_applicable', 'unclaimed', 'claimed']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'unclaimed'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deletedAt: Schema.Attribute.DateTime;
    eligiblePrizesSnapshot: Schema.Attribute.JSON;
    ipAddress: Schema.Attribute.String;
    isDeleted: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel-spin.lucky-wheel-spin'
    > &
      Schema.Attribute.Private;
    luckyWheel: Schema.Attribute.Relation<
      'manyToOne',
      'api::lucky-wheel.lucky-wheel'
    > &
      Schema.Attribute.Required;
    participant: Schema.Attribute.Relation<
      'manyToOne',
      'api::lucky-wheel-participant.lucky-wheel-participant'
    > &
      Schema.Attribute.Required;
    participantClassNameSnapshot: Schema.Attribute.String;
    participantCodeSnapshot: Schema.Attribute.String &
      Schema.Attribute.Required;
    participantEmailSnapshot: Schema.Attribute.String;
    participantNameSnapshot: Schema.Attribute.String;
    participantPhoneSnapshot: Schema.Attribute.String;
    prize: Schema.Attribute.Relation<
      'manyToOne',
      'api::lucky-wheel-prize.lucky-wheel-prize'
    >;
    prizeDescriptionSnapshot: Schema.Attribute.Text;
    prizeDisplayColorSnapshot: Schema.Attribute.String;
    prizeDocumentIdSnapshot: Schema.Attribute.String;
    prizeIdSnapshot: Schema.Attribute.String;
    prizeImageSnapshot: Schema.Attribute.JSON;
    prizeIsNoPrizeSnapshot: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    prizeNameSnapshot: Schema.Attribute.String & Schema.Attribute.Required;
    prizeResultMessageSnapshot: Schema.Attribute.Text;
    prizeTextColorSnapshot: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    randomValue: Schema.Attribute.String;
    requestId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    spunAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<
      ['completed', 'claimed', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'completed'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userAgent: Schema.Attribute.Text;
    verificationCode: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
  };
}

export interface ApiLuckyWheelLuckyWheel extends Struct.CollectionTypeSchema {
  collectionName: 'lucky_wheels';
  info: {
    description: 'Lucky Wheel campaigns';
    displayName: 'Lucky Wheel';
    pluralName: 'lucky-wheels';
    singularName: 'lucky-wheel';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allowNoPrize: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    cancelledAt: Schema.Attribute.DateTime;
    closedAt: Schema.Attribute.DateTime;
    code: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deletedAt: Schema.Attribute.DateTime;
    description: Schema.Attribute.Text;
    endAt: Schema.Attribute.DateTime;
    isDeleted: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel.lucky-wheel'
    > &
      Schema.Attribute.Private;
    maxParticipants: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    name: Schema.Attribute.String;
    openedAt: Schema.Attribute.DateTime;
    participantFormConfig: Schema.Attribute.JSON;
    participants: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel-participant.lucky-wheel-participant'
    >;
    participationMode: Schema.Attribute.Enumeration<['predefined', 'open']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'predefined'>;
    prizes: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel-prize.lucky-wheel-prize'
    >;
    publicMessage: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    resultNotice: Schema.Attribute.Text;
    spins: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel-spin.lucky-wheel-spin'
    >;
    startAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['draft', 'opened', 'closed', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
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

export interface ApiOutcomeAssessmentCandidateOutcomeAssessmentCandidate
  extends Struct.CollectionTypeSchema {
  collectionName: 'outcome_assessment_candidates';
  info: {
    description: 'Tenant-scoped learner assessment dossiers for outcome recognition.';
    displayName: 'Outcome Assessment Candidate';
    pluralName: 'outcome-assessment-candidates';
    singularName: 'outcome-assessment-candidate';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approvalStatus: Schema.Attribute.Enumeration<
      ['pending', 'approved', 'rejected']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    automatedResultStatus: Schema.Attribute.Enumeration<
      [
        'not_evaluated',
        'insufficient_data',
        'eligible',
        'ineligible',
        'pending_verification',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_evaluated'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    decisionDate: Schema.Attribute.Date;
    decisionNumber: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    examProgramResult: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-program-result.exam-program-result'
    >;
    learner: Schema.Attribute.Relation<'manyToOne', 'api::learner.learner'> &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::outcome-assessment-candidate.outcome-assessment-candidate'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    outcomeAssessmentRound: Schema.Attribute.Relation<
      'manyToOne',
      'api::outcome-assessment-round.outcome-assessment-round'
    > &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    reason: Schema.Attribute.Text;
    recognitionSource: Schema.Attribute.Enumeration<
      [
        'exam',
        'preserved_result',
        'certificate',
        'exemption',
        'equivalent_result',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'exam'>;
    recognitionStatus: Schema.Attribute.Enumeration<
      ['not_recognized', 'recognized', 'revoked']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_recognized'>;
    recognizedAt: Schema.Attribute.DateTime;
    reviewStatus: Schema.Attribute.Enumeration<
      ['pending', 'verified', 'need_supplement', 'rejected']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    synchronizationStatus: Schema.Attribute.Enumeration<
      ['not_synced', 'pending', 'synced', 'failed', 'resync_required']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'not_synced'>;
    synchronizedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiOutcomeAssessmentRoundOutcomeAssessmentRound
  extends Struct.CollectionTypeSchema {
  collectionName: 'outcome_assessment_rounds';
  info: {
    description: 'Tenant-scoped assessment rounds for graduation outcome decisions.';
    displayName: 'Outcome Assessment Round';
    pluralName: 'outcome-assessment-rounds';
    singularName: 'outcome-assessment-round';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    academicYear: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }>;
    applicableDescription: Schema.Attribute.Text;
    approvedAt: Schema.Attribute.DateTime;
    approvedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    assessmentCandidates: Schema.Attribute.Relation<
      'oneToMany',
      'api::outcome-assessment-candidate.outcome-assessment-candidate'
    >;
    assessmentEndAt: Schema.Attribute.DateTime;
    assessmentStartAt: Schema.Attribute.DateTime;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    decisionDate: Schema.Attribute.Date;
    decisionNumber: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    examProgram: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-program.exam-program'
    >;
    examRounds: Schema.Attribute.Relation<
      'manyToMany',
      'api::exam-round.exam-round'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::outcome-assessment-round.outcome-assessment-round'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    outcomeStandard: Schema.Attribute.Relation<
      'manyToOne',
      'api::outcome-standard.outcome-standard'
    > &
      Schema.Attribute.Required;
    preparedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    publishedAt: Schema.Attribute.DateTime;
    ruleSnapshot: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    status: Schema.Attribute.Enumeration<
      [
        'draft',
        'collecting',
        'pending_review',
        'pending_approval',
        'approved',
        'published',
        'synced',
        'completed',
        'cancelled',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    submittedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiOutcomeStandardOutcomeStandard
  extends Struct.CollectionTypeSchema {
  collectionName: 'outcome_standards';
  info: {
    description: 'Tenant-scoped outcome standard catalog.';
    displayName: 'Outcome Standard';
    pluralName: 'outcome-standards';
    singularName: 'outcome-standard';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    applicableDescription: Schema.Attribute.Text;
    assessmentRounds: Schema.Attribute.Relation<
      'oneToMany',
      'api::outcome-assessment-round.outcome-assessment-round'
    >;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    examProgram: Schema.Attribute.Relation<
      'manyToOne',
      'api::exam-program.exam-program'
    >;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::outcome-standard.outcome-standard'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    recognitionMethod: Schema.Attribute.Enumeration<
      [
        'exam_program',
        'certificate',
        'exemption',
        'equivalent_result',
        'multiple_methods',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'exam_program'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    validFrom: Schema.Attribute.Date;
    validTo: Schema.Attribute.Date;
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

export interface ApiPaymentProfilePaymentProfile
  extends Struct.CollectionTypeSchema {
  collectionName: 'payment_profiles';
  info: {
    description: 'H\u1ED3 s\u01A1 th\u00F4ng tin nh\u1EADn thanh to\u00E1n d\u00F9ng chung c\u1EE7a t\u1EEBng tenant.';
    displayName: 'Payment Profile';
    pluralName: 'payment-profiles';
    singularName: 'payment-profile';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    accountHolder: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    accountNumber: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    bankBranch: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    bankCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    bankName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 10;
      }> &
      Schema.Attribute.DefaultTo<'VND'>;
    description: Schema.Attribute.Text;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    isDefault: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment-profile.payment-profile'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    paymentInstruction: Schema.Attribute.RichText;
    paymentMethod: Schema.Attribute.Enumeration<
      ['bank_transfer', 'cash', 'other']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'bank_transfer'>;
    publishedAt: Schema.Attribute.DateTime;
    qrImage: Schema.Attribute.Media<'images'>;
    sortOrder: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    supportEmail: Schema.Attribute.Email;
    supportPhone: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    transferContentTemplate: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
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
    imageAsset: Schema.Attribute.Relation<
      'manyToOne',
      'api::file-asset.file-asset'
    >;
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

export interface ApiQuestionStimulusQuestionStimulus
  extends Struct.CollectionTypeSchema {
  collectionName: 'question_stimuli';
  info: {
    description: 'Tenant-scoped reusable stimulus or source material shared by one or more assessment questions.';
    displayName: 'Question Stimulus';
    pluralName: 'question-stimuli';
    singularName: 'question-stimulus';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    audioAsset: Schema.Attribute.Relation<
      'manyToOne',
      'api::file-asset.file-asset'
    >;
    code: Schema.Attribute.String & Schema.Attribute.Required;
    content: Schema.Attribute.RichText;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    imageAsset: Schema.Attribute.Relation<
      'manyToOne',
      'api::file-asset.file-asset'
    >;
    instruction: Schema.Attribute.RichText;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::question-stimulus.question-stimulus'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    questions: Schema.Attribute.Relation<'oneToMany', 'api::question.question'>;
    stimulusStatus: Schema.Attribute.Enumeration<
      ['draft', 'active', 'archived']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<['text', 'audio', 'image', 'mixed']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
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
    stimulus: Schema.Attribute.Relation<
      'manyToOne',
      'api::question-stimulus.question-stimulus'
    >;
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

export interface ApiQuickMessageAccessLogQuickMessageAccessLog
  extends Struct.CollectionTypeSchema {
  collectionName: 'quick_message_access_logs';
  info: {
    description: 'Tenant-scoped access and activity events for one quick message access code.';
    displayName: 'Quick Message Access Log';
    pluralName: 'quick-message-access-logs';
    singularName: 'quick-message-access-log';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    access: Schema.Attribute.Relation<
      'manyToOne',
      'api::quick-message-access.quick-message-access'
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    eventType: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    ipAddress: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-access-log.quick-message-access-log'
    > &
      Schema.Attribute.Private;
    message: Schema.Attribute.Relation<
      'manyToOne',
      'api::quick-message.quick-message'
    > &
      Schema.Attribute.Required;
    metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    success: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userAgent: Schema.Attribute.Text;
  };
}

export interface ApiQuickMessageAccessQuickMessageAccess
  extends Struct.CollectionTypeSchema {
  collectionName: 'quick_message_accesses';
  info: {
    description: 'Tenant-scoped public access code for a quick message.';
    displayName: 'Quick Message Access';
    pluralName: 'quick-message-accesses';
    singularName: 'quick-message-access';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    accessLogs: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-access-log.quick-message-access-log'
    >;
    accessVersion: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 12;
        minLength: 6;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime;
    firstViewedAt: Schema.Attribute.DateTime;
    label: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    lastViewedAt: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-access.quick-message-access'
    > &
      Schema.Attribute.Private;
    lockedAt: Schema.Attribute.DateTime;
    maxViews: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    message: Schema.Attribute.Relation<
      'manyToOne',
      'api::quick-message.quick-message'
    > &
      Schema.Attribute.Required;
    messages: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-message.quick-message-message'
    >;
    metadata: Schema.Attribute.JSON;
    pinHash: Schema.Attribute.String & Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    recipientName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    replies: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-reply.quick-message-reply'
    >;
    requirePin: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    status: Schema.Attribute.Enumeration<
      ['active', 'locked', 'expired', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    viewCount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
  };
}

export interface ApiQuickMessageMessageQuickMessageMessage
  extends Struct.CollectionTypeSchema {
  collectionName: 'quick_message_messages';
  info: {
    description: 'Tenant-scoped admin/public conversation messages for one quick message access code.';
    displayName: 'Quick Message Message';
    pluralName: 'quick-message-messages';
    singularName: 'quick-message-message';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    access: Schema.Attribute.Relation<
      'manyToOne',
      'api::quick-message-access.quick-message-access'
    > &
      Schema.Attribute.Required;
    content: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-message.quick-message-message'
    > &
      Schema.Attribute.Private;
    message: Schema.Attribute.Relation<
      'manyToOne',
      'api::quick-message.quick-message'
    > &
      Schema.Attribute.Required;
    metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    readByAdminAt: Schema.Attribute.DateTime;
    readByPublicAt: Schema.Attribute.DateTime;
    senderDisplayName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    senderType: Schema.Attribute.Enumeration<['ADMIN', 'PUBLIC', 'SYSTEM']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'ADMIN'>;
    senderUser: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiQuickMessageReplyQuickMessageReply
  extends Struct.CollectionTypeSchema {
  collectionName: 'quick_message_replies';
  info: {
    description: 'Tenant-scoped reply submitted through a quick message access code.';
    displayName: 'Quick Message Reply';
    pluralName: 'quick-message-replies';
    singularName: 'quick-message-reply';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    access: Schema.Attribute.Relation<
      'manyToOne',
      'api::quick-message-access.quick-message-access'
    > &
      Schema.Attribute.Required;
    clientSessionId: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    content: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ipHash: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 128;
      }>;
    isRead: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-reply.quick-message-reply'
    > &
      Schema.Attribute.Private;
    message: Schema.Attribute.Relation<
      'manyToOne',
      'api::quick-message.quick-message'
    > &
      Schema.Attribute.Required;
    metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    quickResponse: Schema.Attribute.Enumeration<
      [
        'received',
        'opened',
        'understood',
        'need_help',
        'cannot_open',
        'agree',
        'disagree',
      ]
    >;
    readAt: Schema.Attribute.DateTime;
    replyType: Schema.Attribute.Enumeration<['quick', 'text']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'quick'>;
    responderName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userAgent: Schema.Attribute.Text;
  };
}

export interface ApiQuickMessageQuickMessage
  extends Struct.CollectionTypeSchema {
  collectionName: 'quick_messages';
  info: {
    description: 'Tenant-scoped shared quick message content for public access codes.';
    displayName: 'Quick Message';
    pluralName: 'quick-messages';
    singularName: 'quick-message';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    accesses: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-access.quick-message-access'
    >;
    accessLogs: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-access-log.quick-message-access-log'
    >;
    allowReply: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    content: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime;
    links: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message.quick-message'
    > &
      Schema.Attribute.Private;
    messages: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-message.quick-message-message'
    >;
    metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    replies: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-reply.quick-message-reply'
    >;
    replyMode: Schema.Attribute.Enumeration<
      ['quick', 'text', 'quick_and_text']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'quick_and_text'>;
    sender: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    senderDisplayName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    status: Schema.Attribute.Enumeration<
      ['draft', 'active', 'locked', 'expired', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiRegistrationCampaignRegistrationCampaign
  extends Struct.CollectionTypeSchema {
  collectionName: 'registration_campaigns';
  info: {
    description: 'Tenant-scoped campaigns for registering users into a tenant and granting access to a feature.';
    displayName: 'Registration Campaign';
    pluralName: 'registration-campaigns';
    singularName: 'registration-campaign';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    autoApprove: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    completionNotificationTemplate: Schema.Attribute.Relation<
      'manyToOne',
      'api::notification-template.notification-template'
    >;
    coverImage: Schema.Attribute.Media<'images'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultTenantRole: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    deletedAt: Schema.Attribute.DateTime;
    deletedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    description: Schema.Attribute.Text;
    endAt: Schema.Attribute.DateTime;
    formConfig: Schema.Attribute.JSON &
      Schema.Attribute.DefaultTo<{
        fields: [];
      }>;
    isDeleted: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::registration-campaign.registration-campaign'
    > &
      Schema.Attribute.Private;
    maxRegistrations: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    redirectPath: Schema.Attribute.String;
    registrationMode: Schema.Attribute.Enumeration<
      [
        'public_link',
        'public_code',
        'invite_only',
        'approval_required',
        'admin_only',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'public_code'>;
    registrations: Schema.Attribute.Relation<
      'oneToMany',
      'api::campaign-registration.campaign-registration'
    >;
    rejectionNotificationTemplate: Schema.Attribute.Relation<
      'manyToOne',
      'api::notification-template.notification-template'
    >;
    requireTermsAcceptance: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    shortDescription: Schema.Attribute.Text;
    startAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['draft', 'open', 'paused', 'closed', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    successMessage: Schema.Attribute.Text;
    targetFeature: Schema.Attribute.String & Schema.Attribute.Required;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    termsContent: Schema.Attribute.Text;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    verificationExpireMinutes: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1440>;
    verificationMethod: Schema.Attribute.Enumeration<
      ['email_link', 'email_otp', 'none']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'email_link'>;
    verificationNotificationTemplate: Schema.Attribute.Relation<
      'manyToOne',
      'api::notification-template.notification-template'
    >;
    verificationRequired: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
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
    assessmentSections: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-section.assessment-section'
    >;
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

export interface ApiSportsAchievementSubmissionSportsAchievementSubmission
  extends Struct.CollectionTypeSchema {
  collectionName: 'sports_achievement_submissions';
  info: {
    description: 'Tenant-scoped sports achievement proposals that move through submit, verify, reject, or cancel workflow before creating a recognized achievement.';
    displayName: 'Sports Achievement Submission';
    pluralName: 'sports-achievement-submissions';
    singularName: 'sports-achievement-submission';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    achievedAt: Schema.Attribute.DateTime;
    achievement: Schema.Attribute.Relation<
      'oneToOne',
      'api::sports-achievement.sports-achievement'
    >;
    achievementType: Schema.Attribute.Enumeration<
      [
        'personal_best',
        'race_result',
        'champion',
        'podium',
        'finisher',
        'distance_milestone',
        'streak',
        'club_award',
        'system_award',
        'other',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'other'>;
    club: Schema.Attribute.Relation<
      'manyToOne',
      'api::sports-club.sports-club'
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    evidence: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sports-achievement-submission.sports-achievement-submission'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    resultText: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    resultUnit: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }>;
    resultValue: Schema.Attribute.Decimal;
    reviewedAt: Schema.Attribute.DateTime;
    reviewedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    reviewNote: Schema.Attribute.Text;
    source: Schema.Attribute.Enumeration<
      [
        'club_manager',
        'member',
        'event',
        'public_form',
        'import',
        'system',
        'strava',
        'other',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'other'>;
    sourceAchievement: Schema.Attribute.Relation<
      'manyToOne',
      'api::sports-achievement.sports-achievement'
    >;
    sourceReference: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    sportsProfile: Schema.Attribute.Relation<
      'manyToOne',
      'api::sports-profile.sports-profile'
    > &
      Schema.Attribute.Required;
    sportType: Schema.Attribute.Enumeration<
      [
        'running',
        'cycling',
        'badminton',
        'football',
        'swimming',
        'multisport',
        'other',
      ]
    >;
    status: Schema.Attribute.Enumeration<
      ['draft', 'submitted', 'verified', 'rejected', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    submittedAt: Schema.Attribute.DateTime;
    submittedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSportsAchievementSportsAchievement
  extends Struct.CollectionTypeSchema {
  collectionName: 'sports_achievements';
  info: {
    description: 'Tenant-scoped recognized sports achievements that have already been verified or officially recorded.';
    displayName: 'Sports Achievement';
    pluralName: 'sports-achievements';
    singularName: 'sports-achievement';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    achievedAt: Schema.Attribute.DateTime;
    achievementType: Schema.Attribute.Enumeration<
      [
        'personal_best',
        'race_result',
        'champion',
        'podium',
        'finisher',
        'distance_milestone',
        'streak',
        'club_award',
        'system_award',
        'other',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'other'>;
    club: Schema.Attribute.Relation<
      'manyToOne',
      'api::sports-club.sports-club'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    evidence: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sports-achievement.sports-achievement'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    resultText: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    resultUnit: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }>;
    resultValue: Schema.Attribute.Decimal;
    revokedAt: Schema.Attribute.DateTime;
    revokedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    revokeReason: Schema.Attribute.Text;
    source: Schema.Attribute.Enumeration<
      ['club', 'event', 'manual', 'system', 'strava', 'import', 'other']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'manual'>;
    sourceReference: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    sportsProfile: Schema.Attribute.Relation<
      'manyToOne',
      'api::sports-profile.sports-profile'
    > &
      Schema.Attribute.Required;
    sportType: Schema.Attribute.Enumeration<
      [
        'running',
        'cycling',
        'badminton',
        'football',
        'swimming',
        'multisport',
        'other',
      ]
    >;
    status: Schema.Attribute.Enumeration<['active', 'revoked']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    verifiedAt: Schema.Attribute.DateTime;
    verifiedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiSportsClubUserAssignmentSportsClubUserAssignment
  extends Struct.CollectionTypeSchema {
  collectionName: 'sports_club_user_assignments';
  info: {
    description: 'Tenant-scoped assignment of a user to manage a specific sports club.';
    displayName: 'Sports Club User Assignment';
    pluralName: 'sports-club-user-assignments';
    singularName: 'sports-club-user-assignment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assignedAt: Schema.Attribute.DateTime;
    assignedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    club: Schema.Attribute.Relation<
      'manyToOne',
      'api::sports-club.sports-club'
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sports-club-user-assignment.sports-club-user-assignment'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['active', 'inactive']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
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

export interface ApiSportsClubSportsClub extends Struct.CollectionTypeSchema {
  collectionName: 'sports_clubs';
  info: {
    description: 'Tenant-scoped sports clubs, teams, chapters, and communities with optional parent-child hierarchy.';
    displayName: 'Sports Club';
    pluralName: 'sports-clubs';
    singularName: 'sports-club';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    address: Schema.Attribute.Text;
    childClubs: Schema.Attribute.Relation<
      'oneToMany',
      'api::sports-club.sports-club'
    >;
    clubType: Schema.Attribute.Enumeration<
      ['community', 'club', 'team', 'chapter', 'training_group', 'other']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'club'>;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    contactEmail: Schema.Attribute.Email;
    contactPhone: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
    coverImage: Schema.Attribute.Media<'images'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    foundedAt: Schema.Attribute.Date;
    joinPolicy: Schema.Attribute.Enumeration<
      ['open', 'approval', 'invite_only', 'closed']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'approval'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sports-club.sports-club'
    > &
      Schema.Attribute.Private;
    logo: Schema.Attribute.Media<'images'>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    parentClub: Schema.Attribute.Relation<
      'manyToOne',
      'api::sports-club.sports-club'
    >;
    publishedAt: Schema.Attribute.DateTime;
    shortName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    slug: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    sportType: Schema.Attribute.Enumeration<
      [
        'running',
        'cycling',
        'badminton',
        'football',
        'swimming',
        'multisport',
        'other',
      ]
    > &
      Schema.Attribute.DefaultTo<'running'>;
    status: Schema.Attribute.Enumeration<['active', 'inactive', 'archived']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    website: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
  };
}

export interface ApiSportsProfileSportsProfile
  extends Struct.CollectionTypeSchema {
  collectionName: 'sports_profiles';
  info: {
    description: 'Tenant-scoped sports identity profile that may exist before a linked user account.';
    displayName: 'Sports Profile';
    pluralName: 'sports-profiles';
    singularName: 'sports-profile';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    avatar: Schema.Attribute.Media<'images'>;
    bio: Schema.Attribute.Text;
    birthYear: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 2100;
          min: 1900;
        },
        number
      >;
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    contactEmail: Schema.Attribute.Email;
    contactPhone: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 30;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dateOfBirth: Schema.Attribute.Date;
    displayName: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    fullName: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    gender: Schema.Attribute.Enumeration<
      ['male', 'female', 'other', 'unspecified']
    > &
      Schema.Attribute.DefaultTo<'unspecified'>;
    hometown: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sports-profile.sports-profile'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    source: Schema.Attribute.Enumeration<
      [
        'manual_import',
        'self_registration',
        'campaign',
        'admin_created',
        'other',
      ]
    >;
    sourceReference: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    status: Schema.Attribute.Enumeration<['active', 'inactive', 'merged']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
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
    activityDeleteMarkers: Schema.Attribute.JSON & Schema.Attribute.Private;
    athleteFirstname: Schema.Attribute.String;
    athleteLastname: Schema.Attribute.String;
    athleteUsername: Schema.Attribute.String;
    cleanupCompletedAt: Schema.Attribute.DateTime;
    cleanupError: Schema.Attribute.Text;
    cleanupRequestedAt: Schema.Attribute.DateTime;
    cleanupStatus: Schema.Attribute.Enumeration<
      ['NOT_REQUIRED', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'NOT_REQUIRED'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    disconnectedAt: Schema.Attribute.DateTime;
    lastSyncAt: Schema.Attribute.DateTime;
    lastSyncError: Schema.Attribute.Text;
    lastSyncStatus: Schema.Attribute.Enumeration<
      ['NEVER', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL']
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
    stravaAthleteId: Schema.Attribute.String;
    syncJobs: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-sync-job.strava-sync-job'
    >;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    terminationReason: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    tokenExpiresAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    webhookEvents: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-webhook-event.strava-webhook-event'
    >;
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
    frontendOrigin: Schema.Attribute.String;
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

export interface ApiStravaSyncJobStravaSyncJob
  extends Struct.CollectionTypeSchema {
  collectionName: 'strava_sync_jobs';
  info: {
    description: 'Database-backed Strava synchronization job with resumable checkpoints for a tenant-scoped internal user.';
    displayName: 'Strava Sync Job';
    pluralName: 'strava-sync-jobs';
    singularName: 'strava-sync-job';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    cancelledAt: Schema.Attribute.DateTime;
    claimedAt: Schema.Attribute.DateTime;
    claimedBy: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    completedAt: Schema.Attribute.DateTime;
    connection: Schema.Attribute.Relation<
      'manyToOne',
      'api::strava-connection.strava-connection'
    > &
      Schema.Attribute.Required;
    createdActivities: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currentPage: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    failedActivities: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    failedAt: Schema.Attribute.DateTime;
    heartbeatAt: Schema.Attribute.DateTime;
    lastErrorCode: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    lastErrorMessage: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-sync-job.strava-sync-job'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    newestSyncedAt: Schema.Attribute.DateTime;
    nextRetryAt: Schema.Attribute.DateTime;
    oldestSyncedAt: Schema.Attribute.DateTime;
    perPage: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<100>;
    phase: Schema.Attribute.Enumeration<
      [
        'preparing',
        'syncing_recent',
        'syncing_history',
        'rebuilding_snapshot',
        'finalizing',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'preparing'>;
    processedActivities: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    requestedAt: Schema.Attribute.DateTime;
    retryCount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    skippedActivities: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    startedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['queued', 'running', 'partial_ready', 'completed', 'failed', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'queued'>;
    syncMode: Schema.Attribute.Enumeration<
      ['initial', 'incremental', 'retry']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'initial'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedActivities: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
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

export interface ApiStravaWebhookEventStravaWebhookEvent
  extends Struct.CollectionTypeSchema {
  collectionName: 'strava_webhook_events';
  info: {
    description: 'Stores raw Strava webhook events for durable processing, retry, idempotency and audit.';
    displayName: 'Strava Webhook Event';
    pluralName: 'strava-webhook-events';
    singularName: 'strava-webhook-event';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    aspectType: Schema.Attribute.Enumeration<
      ['create', 'update', 'delete', 'unknown']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'unknown'>;
    attempts: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    claimedAt: Schema.Attribute.DateTime;
    claimedBy: Schema.Attribute.String &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    connection: Schema.Attribute.Relation<
      'manyToOne',
      'api::strava-connection.strava-connection'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    eventTime: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 32;
      }>;
    idempotencyKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    lastError: Schema.Attribute.Text & Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-webhook-event.strava-webhook-event'
    > &
      Schema.Attribute.Private;
    nextAttemptAt: Schema.Attribute.DateTime;
    objectId: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    objectType: Schema.Attribute.Enumeration<
      ['activity', 'athlete', 'unknown']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'unknown'>;
    ownerId: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    processedAt: Schema.Attribute.DateTime;
    publishedAt: Schema.Attribute.DateTime;
    rawPayload: Schema.Attribute.JSON & Schema.Attribute.Private;
    status: Schema.Attribute.Enumeration<
      ['pending', 'processing', 'processed', 'ignored', 'failed', 'dead_letter']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    subscriptionId: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    updates: Schema.Attribute.JSON;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
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
    assessments: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment.assessment'
    >;
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
    assessmentAnswers: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-answer.assessment-answer'
    >;
    assessmentAnswerScores: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-answer-score.assessment-answer-score'
    >;
    assessmentAttempts: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-attempt.assessment-attempt'
    >;
    assessmentCampaignFields: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-campaign-field.assessment-campaign-field'
    >;
    assessmentCampaignParticipations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-campaign-participation.assessment-campaign-participation'
    >;
    assessmentCampaignRules: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-campaign-rule.assessment-campaign-rule'
    >;
    assessmentCampaigns: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-campaign.assessment-campaign'
    >;
    assessmentPlacementConfirmations: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-placement-confirmation.assessment-placement-confirmation'
    >;
    assessmentPlacementRules: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-placement-rule.assessment-placement-rule'
    >;
    assessmentQuestions: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-question.assessment-question'
    >;
    assessmentResults: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-result.assessment-result'
    >;
    assessments: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment.assessment'
    >;
    assessmentSections: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-section.assessment-section'
    >;
    assessmentSpeakingCriteria: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-speaking-criterion.assessment-speaking-criterion'
    >;
    assessmentSpeakingReviews: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-speaking-review.assessment-speaking-review'
    >;
    assessmentVersions: Schema.Attribute.Relation<
      'oneToMany',
      'api::assessment-version.assessment-version'
    >;
    banner: Schema.Attribute.Media<'images'>;
    campaignRegistrations: Schema.Attribute.Relation<
      'oneToMany',
      'api::campaign-registration.campaign-registration'
    >;
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
    clubMembershipHistories: Schema.Attribute.Relation<
      'oneToMany',
      'api::club-membership-history.club-membership-history'
    >;
    clubMemberships: Schema.Attribute.Relation<
      'oneToMany',
      'api::club-membership.club-membership'
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
    luckyWheelParticipants: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel-participant.lucky-wheel-participant'
    >;
    luckyWheelPrizes: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel-prize.lucky-wheel-prize'
    >;
    luckyWheels: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel.lucky-wheel'
    >;
    luckyWheelSpins: Schema.Attribute.Relation<
      'oneToMany',
      'api::lucky-wheel-spin.lucky-wheel-spin'
    >;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    note: Schema.Attribute.Text;
    notificationTemplates: Schema.Attribute.Relation<
      'oneToMany',
      'api::notification-template.notification-template'
    >;
    paymentProfiles: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment-profile.payment-profile'
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
    questionStimuli: Schema.Attribute.Relation<
      'oneToMany',
      'api::question-stimulus.question-stimulus'
    >;
    quickMessageAccesses: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-access.quick-message-access'
    >;
    quickMessageAccessLogs: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-access-log.quick-message-access-log'
    >;
    quickMessageMessages: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-message.quick-message-message'
    >;
    quickMessageReplies: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message-reply.quick-message-reply'
    >;
    quickMessages: Schema.Attribute.Relation<
      'oneToMany',
      'api::quick-message.quick-message'
    >;
    registrationCampaigns: Schema.Attribute.Relation<
      'oneToMany',
      'api::registration-campaign.registration-campaign'
    >;
    settings: Schema.Attribute.JSON;
    shortName: Schema.Attribute.String;
    siteDescription: Schema.Attribute.Text;
    siteKeywords: Schema.Attribute.Text;
    siteLogo: Schema.Attribute.Media<'images'>;
    siteShortTitle: Schema.Attribute.String;
    siteTitle: Schema.Attribute.String;
    skills: Schema.Attribute.Relation<'oneToMany', 'api::skill.skill'>;
    slogan: Schema.Attribute.Text;
    sportsAchievements: Schema.Attribute.Relation<
      'oneToMany',
      'api::sports-achievement.sports-achievement'
    >;
    sportsAchievementSubmissions: Schema.Attribute.Relation<
      'oneToMany',
      'api::sports-achievement-submission.sports-achievement-submission'
    >;
    sportsClubs: Schema.Attribute.Relation<
      'oneToMany',
      'api::sports-club.sports-club'
    >;
    sportsClubUserAssignments: Schema.Attribute.Relation<
      'oneToMany',
      'api::sports-club-user-assignment.sports-club-user-assignment'
    >;
    sportsProfiles: Schema.Attribute.Relation<
      'oneToMany',
      'api::sports-profile.sports-profile'
    >;
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
    stravaSyncJobs: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-sync-job.strava-sync-job'
    >;
    stravaWebhookEvents: Schema.Attribute.Relation<
      'oneToMany',
      'api::strava-webhook-event.strava-webhook-event'
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
      'api::assessment-answer-score.assessment-answer-score': ApiAssessmentAnswerScoreAssessmentAnswerScore;
      'api::assessment-answer.assessment-answer': ApiAssessmentAnswerAssessmentAnswer;
      'api::assessment-attempt.assessment-attempt': ApiAssessmentAttemptAssessmentAttempt;
      'api::assessment-campaign-field.assessment-campaign-field': ApiAssessmentCampaignFieldAssessmentCampaignField;
      'api::assessment-campaign-participation.assessment-campaign-participation': ApiAssessmentCampaignParticipationAssessmentCampaignParticipation;
      'api::assessment-campaign-rule.assessment-campaign-rule': ApiAssessmentCampaignRuleAssessmentCampaignRule;
      'api::assessment-campaign.assessment-campaign': ApiAssessmentCampaignAssessmentCampaign;
      'api::assessment-placement-confirmation.assessment-placement-confirmation': ApiAssessmentPlacementConfirmationAssessmentPlacementConfirmation;
      'api::assessment-placement-rule.assessment-placement-rule': ApiAssessmentPlacementRuleAssessmentPlacementRule;
      'api::assessment-question.assessment-question': ApiAssessmentQuestionAssessmentQuestion;
      'api::assessment-result.assessment-result': ApiAssessmentResultAssessmentResult;
      'api::assessment-section.assessment-section': ApiAssessmentSectionAssessmentSection;
      'api::assessment-speaking-criterion.assessment-speaking-criterion': ApiAssessmentSpeakingCriterionAssessmentSpeakingCriterion;
      'api::assessment-speaking-review.assessment-speaking-review': ApiAssessmentSpeakingReviewAssessmentSpeakingReview;
      'api::assessment-version.assessment-version': ApiAssessmentVersionAssessmentVersion;
      'api::assessment.assessment': ApiAssessmentAssessment;
      'api::author.author': ApiAuthorAuthor;
      'api::campaign-registration.campaign-registration': ApiCampaignRegistrationCampaignRegistration;
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
      'api::club-membership-history.club-membership-history': ApiClubMembershipHistoryClubMembershipHistory;
      'api::club-membership.club-membership': ApiClubMembershipClubMembership;
      'api::content-block.content-block': ApiContentBlockContentBlock;
      'api::customer.customer': ApiCustomerCustomer;
      'api::department-membership.department-membership': ApiDepartmentMembershipDepartmentMembership;
      'api::department.department': ApiDepartmentDepartment;
      'api::employee-history.employee-history': ApiEmployeeHistoryEmployeeHistory;
      'api::employee.employee': ApiEmployeeEmployee;
      'api::enrollment.enrollment': ApiEnrollmentEnrollment;
      'api::exam-candidate-list.exam-candidate-list': ApiExamCandidateListExamCandidateList;
      'api::exam-candidate.exam-candidate': ApiExamCandidateExamCandidate;
      'api::exam-component-result.exam-component-result': ApiExamComponentResultExamComponentResult;
      'api::exam-component.exam-component': ApiExamComponentExamComponent;
      'api::exam-eligibility.exam-eligibility': ApiExamEligibilityExamEligibility;
      'api::exam-integration-item.exam-integration-item': ApiExamIntegrationItemExamIntegrationItem;
      'api::exam-integration-job.exam-integration-job': ApiExamIntegrationJobExamIntegrationJob;
      'api::exam-payment.exam-payment': ApiExamPaymentExamPayment;
      'api::exam-program-result-subject.exam-program-result-subject': ApiExamProgramResultSubjectExamProgramResultSubject;
      'api::exam-program-result.exam-program-result': ApiExamProgramResultExamProgramResult;
      'api::exam-program-subject.exam-program-subject': ApiExamProgramSubjectExamProgramSubject;
      'api::exam-program.exam-program': ApiExamProgramExamProgram;
      'api::exam-registration-component.exam-registration-component': ApiExamRegistrationComponentExamRegistrationComponent;
      'api::exam-registration-subject.exam-registration-subject': ApiExamRegistrationSubjectExamRegistrationSubject;
      'api::exam-registration.exam-registration': ApiExamRegistrationExamRegistration;
      'api::exam-room.exam-room': ApiExamRoomExamRoom;
      'api::exam-round-component.exam-round-component': ApiExamRoundComponentExamRoundComponent;
      'api::exam-round-subject.exam-round-subject': ApiExamRoundSubjectExamRoundSubject;
      'api::exam-round.exam-round': ApiExamRoundExamRound;
      'api::exam-schedule.exam-schedule': ApiExamScheduleExamSchedule;
      'api::exam-subject-component.exam-subject-component': ApiExamSubjectComponentExamSubjectComponent;
      'api::exam-subject-result-component.exam-subject-result-component': ApiExamSubjectResultComponentExamSubjectResultComponent;
      'api::exam-subject-result.exam-subject-result': ApiExamSubjectResultExamSubjectResult;
      'api::exam-subject.exam-subject': ApiExamSubjectExamSubject;
      'api::exam-venue.exam-venue': ApiExamVenueExamVenue;
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
      'api::lucky-wheel-participant.lucky-wheel-participant': ApiLuckyWheelParticipantLuckyWheelParticipant;
      'api::lucky-wheel-prize.lucky-wheel-prize': ApiLuckyWheelPrizeLuckyWheelPrize;
      'api::lucky-wheel-spin.lucky-wheel-spin': ApiLuckyWheelSpinLuckyWheelSpin;
      'api::lucky-wheel.lucky-wheel': ApiLuckyWheelLuckyWheel;
      'api::mail-log.mail-log': ApiMailLogMailLog;
      'api::notification-template.notification-template': ApiNotificationTemplateNotificationTemplate;
      'api::outcome-assessment-candidate.outcome-assessment-candidate': ApiOutcomeAssessmentCandidateOutcomeAssessmentCandidate;
      'api::outcome-assessment-round.outcome-assessment-round': ApiOutcomeAssessmentRoundOutcomeAssessmentRound;
      'api::outcome-standard.outcome-standard': ApiOutcomeStandardOutcomeStandard;
      'api::payment-allocation.payment-allocation': ApiPaymentAllocationPaymentAllocation;
      'api::payment-profile.payment-profile': ApiPaymentProfilePaymentProfile;
      'api::payment-transaction.payment-transaction': ApiPaymentTransactionPaymentTransaction;
      'api::payment.payment': ApiPaymentPayment;
      'api::platform-setting.platform-setting': ApiPlatformSettingPlatformSetting;
      'api::position.position': ApiPositionPosition;
      'api::public-page.public-page': ApiPublicPagePublicPage;
      'api::question-option.question-option': ApiQuestionOptionQuestionOption;
      'api::question-stimulus.question-stimulus': ApiQuestionStimulusQuestionStimulus;
      'api::question.question': ApiQuestionQuestion;
      'api::quick-message-access-log.quick-message-access-log': ApiQuickMessageAccessLogQuickMessageAccessLog;
      'api::quick-message-access.quick-message-access': ApiQuickMessageAccessQuickMessageAccess;
      'api::quick-message-message.quick-message-message': ApiQuickMessageMessageQuickMessageMessage;
      'api::quick-message-reply.quick-message-reply': ApiQuickMessageReplyQuickMessageReply;
      'api::quick-message.quick-message': ApiQuickMessageQuickMessage;
      'api::registration-campaign.registration-campaign': ApiRegistrationCampaignRegistrationCampaign;
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
      'api::sports-achievement-submission.sports-achievement-submission': ApiSportsAchievementSubmissionSportsAchievementSubmission;
      'api::sports-achievement.sports-achievement': ApiSportsAchievementSportsAchievement;
      'api::sports-club-user-assignment.sports-club-user-assignment': ApiSportsClubUserAssignmentSportsClubUserAssignment;
      'api::sports-club.sports-club': ApiSportsClubSportsClub;
      'api::sports-profile.sports-profile': ApiSportsProfileSportsProfile;
      'api::strava-activity.strava-activity': ApiStravaActivityStravaActivity;
      'api::strava-connection.strava-connection': ApiStravaConnectionStravaConnection;
      'api::strava-oauth-state.strava-oauth-state': ApiStravaOauthStateStravaOauthState;
      'api::strava-sync-job.strava-sync-job': ApiStravaSyncJobStravaSyncJob;
      'api::strava-webhook-event.strava-webhook-event': ApiStravaWebhookEventStravaWebhookEvent;
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
