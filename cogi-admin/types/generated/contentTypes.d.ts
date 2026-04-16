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
    campaign: Schema.Attribute.Relation<'manyToOne', 'api::campaign.campaign'> &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currentSchool: Schema.Attribute.String;
    dob: Schema.Attribute.Date & Schema.Attribute.Required;
    formData: Schema.Attribute.JSON;
    formTemplateVersion: Schema.Attribute.Integer;
    gender: Schema.Attribute.Enumeration<['male', 'female', 'other']>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application.admission-application'
    > &
      Schema.Attribute.Private;
    parent: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    reviewedAt: Schema.Attribute.DateTime;
    reviewedBy: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    reviewNote: Schema.Attribute.Text;
    reviewStatus: Schema.Attribute.Enumeration<
      ['submitted', 'returned', 'accepted']
    >;
    studentName: Schema.Attribute.String & Schema.Attribute.Required;
    submittedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
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
        maxLength: 80;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::article.article'
    > &
      Schema.Attribute.Private;
    publicAt: Schema.Attribute.DateTime;
    publishedAt: Schema.Attribute.DateTime;
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
    startDate: Schema.Attribute.Date;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    year: Schema.Attribute.Integer & Schema.Attribute.Required;
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
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
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
    isCompleted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
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
    description: Schema.Attribute.Text;
    endAt: Schema.Attribute.DateTime;
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
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
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
    admissionApplications: Schema.Attribute.Relation<
      'oneToMany',
      'api::admission-application.admission-application'
    >;
    campaigns: Schema.Attribute.Relation<'oneToMany', 'api::campaign.campaign'>;
    code: Schema.Attribute.UID<'name'> &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    defaultFeatureCode: Schema.Attribute.String;
    defaultLocale: Schema.Attribute.String;
    defaultProtectedRoute: Schema.Attribute.String;
    defaultPublicRoute: Schema.Attribute.String;
    departments: Schema.Attribute.Relation<
      'oneToMany',
      'api::department.department'
    >;
    description: Schema.Attribute.Text;
    endDate: Schema.Attribute.Date;
    formTemplates: Schema.Attribute.Relation<
      'oneToMany',
      'api::form-template.form-template'
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
    publishedAt: Schema.Attribute.DateTime;
    settings: Schema.Attribute.JSON;
    shortName: Schema.Attribute.String;
    startDate: Schema.Attribute.Date;
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
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userTenants: Schema.Attribute.Relation<
      'oneToMany',
      'api::user-tenant.user-tenant'
    >;
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
      'api::admission-application-file.admission-application-file': ApiAdmissionApplicationFileAdmissionApplicationFile;
      'api::admission-application.admission-application': ApiAdmissionApplicationAdmissionApplication;
      'api::article.article': ApiArticleArticle;
      'api::author.author': ApiAuthorAuthor;
      'api::campaign.campaign': ApiCampaignCampaign;
      'api::category.category': ApiCategoryCategory;
      'api::class.class': ApiClassClass;
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
      'api::form-template.form-template': ApiFormTemplateFormTemplate;
      'api::global.global': ApiGlobalGlobal;
      'api::lead.lead': ApiLeadLead;
      'api::learner.learner': ApiLearnerLearner;
      'api::notification-template.notification-template': ApiNotificationTemplateNotificationTemplate;
      'api::payment-allocation.payment-allocation': ApiPaymentAllocationPaymentAllocation;
      'api::payment-transaction.payment-transaction': ApiPaymentTransactionPaymentTransaction;
      'api::payment.payment': ApiPaymentPayment;
      'api::position.position': ApiPositionPosition;
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
      'api::slider-item.slider-item': ApiSliderItemSliderItem;
      'api::slider.slider': ApiSliderSlider;
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
      'api::tenant.tenant': ApiTenantTenant;
      'api::user-tenant-role.user-tenant-role': ApiUserTenantRoleUserTenantRole;
      'api::user-tenant.user-tenant': ApiUserTenantUserTenant;
      'api::vehicle-type.vehicle-type': ApiVehicleTypeVehicleType;
      'api::vehicle.vehicle': ApiVehicleVehicle;
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
