import type { Schema, Struct } from '@strapi/strapi';

export interface ApiAdmissionApplicationAdmissionApplication
  extends Struct.CollectionTypeSchema {
  collectionName: 'admission_applications';
  info: {
    displayName: 'AdmissionApplication';
    pluralName: 'admission-applications';
    singularName: 'admission-application';
    description: 'Tenant-scoped admission applications submitted by parents.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    address: Schema.Attribute.Text;
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
    status: Schema.Attribute.Enumeration<[
      'draft',
      'submitted',
      'reviewing',
      'approved',
      'rejected',
      'exam_scheduled',
      'passed',
      'failed',
      'enrolled'
    ]> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    studentName: Schema.Attribute.String & Schema.Attribute.Required;
    submittedAt: Schema.Attribute.DateTime;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAdmissionApplicationFileAdmissionApplicationFile
  extends Struct.CollectionTypeSchema {
  collectionName: 'admission_application_files';
  info: {
    displayName: 'AdmissionApplicationFile';
    pluralName: 'admission-application-files';
    singularName: 'admission-application-file';
    description: 'Uploaded files attached to admission applications.';
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

export interface ApiFormTemplateFormTemplate
  extends Struct.CollectionTypeSchema {
  collectionName: 'form_templates';
  info: {
    displayName: 'FormTemplate';
    pluralName: 'form-templates';
    singularName: 'form-template';
    description: 'Tenant-scoped versioned dynamic form templates.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    campaigns: Schema.Attribute.Relation<'oneToMany', 'api::campaign.campaign'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
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
    status: Schema.Attribute.Enumeration<['draft', 'published', 'archived']> &
      Schema.Attribute.DefaultTo<'draft'>;
    tenant: Schema.Attribute.Relation<'manyToOne', 'api::tenant.tenant'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Integer & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'api::admission-application-file.admission-application-file': ApiAdmissionApplicationFileAdmissionApplicationFile;
      'api::admission-application.admission-application': ApiAdmissionApplicationAdmissionApplication;
      'api::form-template.form-template': ApiFormTemplateFormTemplate;
      'api::notification-template.notification-template': ApiNotificationTemplateNotificationTemplate;
    }
  }
}

export interface ApiNotificationTemplateNotificationTemplate
  extends Struct.CollectionTypeSchema {
  collectionName: 'notification_templates';
  info: {
    displayName: 'NotificationTemplate';
    pluralName: 'notification-templates';
    singularName: 'notification-template';
    description: 'Tenant-scoped notification templates for admission invite, OTP, and result messages.';
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