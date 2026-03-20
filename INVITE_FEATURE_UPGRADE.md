# Multi-Tenant Invite Feature Implementation

## Overview

The invite feature has been upgraded to support multi-tenant architecture. Users can now be invited directly into specific tenants with assigned roles and departments.

---

## How It Works

### CASE A: Existing User Invited to New Tenant

1. Admin visits **Invite User** page
2. Admin enters:
   - Email (existing user's email)
   - Role (must be enabled for this tenant)
   - Department (optional, must belong to this tenant)
3. System checks:
   - User exists in database
   - User doesn't already have membership in this tenant
   - Role is enabled for this tenant
   - Department belongs to this tenant
4. System creates:
   - `userTenant` record (status: active)
   - `userTenantRole` record
   - `departmentMembership` (if department selected)
5. **No email sent** (user already has account)
6. User can now login and access this tenant

### CASE B: New User Invited to Tenant

1. Admin visits **Invite User** page
2. Admin enters:
   - Email (new user's email)
   - Full Name (optional)
   - Role (must be enabled for this tenant)
   - Department (optional, must belong to this tenant)
3. System checks:
   - User doesn't exist
   - Role is enabled for this tenant
   - Department belongs to this tenant
4. System creates:
   - Global `user` record (confirmed: false, password: random strong)
   - `activationToken` (48-hour expiry)
   - `userTenant` record (status: pending)
   - `userTenantRole` record
   - `departmentMembership` (if department selected)
5. **Email sent** with activation link
6. User clicks link to activate account
7. On activation:
   - User's `confirmed` flag set to true
   - Pending `userTenant` records activated to status: active
   - User can now login

---

## Validation Rules

All of the following are validated:

1. **Email validation**
   - Required
   - Valid email format
   - Uniqueness per system (for new users)

2. **Role validation**
   - Required
   - Must exist in `tenantRole` table with `tenant=currentTenant` and `isActive=true`
   - Prevents assigning global roles or roles not enabled for this tenant

3. **Department validation** (if provided)
   - Must exist in `department` table
   - Must have `tenant=currentTenant`
   - Must be published (publishedAt is not null)

4. **Duplicate prevention**
   - Prevents inviting same user twice to same tenant
   - Prevents creating duplicate `userTenant` records

---

## Backend Changes

### 1. New Service: `invite-user.ts`
**File:** `/cogi-admin/src/api/admin/services/invite-user.ts`

**Functions:**
- `validateTenantRole(tenantId, roleId)` → Validates role is enabled for tenant
- `validateTenantDepartment(tenantId, departmentId)` → Validates dept belongs to tenant
- `checkUserTenantExists(userId, tenantId)` → Prevents duplicate membership
- `createUserTenant(userId, tenantId, status)` → Creates userTenant record
- `createUserTenantRole(userTenantId, roleId)` → Creates userTenantRole record
- `ensureDepartmentMembership(userId, departmentId)` → Creates department membership
- `inviteNewUser(options)` → Complete flow for new users (user + userTenant + token + email)
- `inviteExistingUserToTenant(options)` → Complete flow for existing users (just userTenant)

### 2. Updated Controller: `admin.ts`
**File:** `/cogi-admin/src/api/admin/controllers/admin.ts`

**Updated Actions:**

#### `inviteUser()` (POST /admin/invite-user)
- **New Parameters:**
  - `email` (required) - user email
  - `roleId` (required) - tenant role ID (NEW)
  - `fullName` (optional) - user's full name
  - `departmentId` (optional) - tenant department ID

- **New Behavior:**
  - Resolves tenant from context (`ctx.state.tenantId`)
  - Validates role is enabled for this tenant
  - Validates department belongs to this tenant
  - Handles CASE A (existing user) and CASE B (new user)
  - Returns different responses for each case

- **Response Structure:**
  ```json
  {
    "ok": true,
    "caseType": "NEW_USER" | "EXISTING_USER",
    "userId": 123,
    "email": "user@example.com",
    "userTenantId": 456,
    "expiresAt": "2024-01-20T12:34:56Z",
    "emailSent": true,
    "emailError": "optional error message"
  }
  ```

#### `getInviteOptions()` (GET /admin/invite-options) [NEW]
- **Purpose:** Fetch available roles and departments for invite form
- **Returns:**
  ```json
  {
    "ok": true,
    "roles": [
      {
        "id": 1,
        "name": "Manager",
        "description": "Department Manager",
        "type": "standard"
      }
    ],
    "departments": [
      {
        "id": 1,
        "name": "Sales",
        "code": "SALES"
      }
    ]
  }
  ```

### 3. Updated Auth Controller: `auth-extended.ts`
**File:** `/cogi-admin/src/api/auth-extended/controllers/auth-extended.ts`

**Update to `activate()` action:**
- When user activates account, system now also:
  - Finds all pending `userTenant` records for that user
  - Activates them to status: `active`
  - Sets `joinedAt` timestamp
- Enables new users to immediately access their invited tenants after account activation

### 4. Updated Routes
**File:** `/cogi-admin/src/api/admin/routes/admin.ts`

**New Route:**
```
GET /admin/invite-options
```

**Updated Route:**
```
POST /admin/invite-user
```

---

## Frontend Changes

### 1. New Page: `InviteUser.jsx`
**File:** `/cogi-framework/src/pages/InviteUser.jsx`

**Features:**
- Full form with validation
- Dynamic role dropdown (fetched from `GET /admin/invite-options`)
- Dynamic department dropdown (filtered by tenant)
- Email validation
- Submit handling for both new and existing users
- Success/error messaging
- Auto-scroll to success message
- Disabled form during submission
- Clear distinction between NEW_USER and EXISTING_USER cases

**Form Fields:**
1. **Email** (required) - User's email address
2. **Full Name** (optional) - Display name for new users
3. **Role** (required) - Dropdown of tenant-enabled roles
4. **Department** (optional) - Dropdown of tenant departments

### 2. Updated Router
**File:** `/cogi-framework/src/router/AppRouter.jsx`

**New Route:**
```javascript
<Route
  path="invite-user"
  element={
    <FeatureRoute featureKey="user.invite">
      <InviteUser />
    </FeatureRoute>
  }
/>
```

**Access:** `/invite-user` (within tenant context)

**Protection:**
- Requires user to be authenticated
- Requires tenant context (user must select a tenant first)
- Gates access to feature key `user.invite` (see **Setup Required** below)

**Imports Added:**
```javascript
import InviteUser from '../pages/InviteUser'
```

---

## Data Flow

### New User Invitation Flow
```
Frontend: User clicks "Invite User"
          ↓
Frontend: GET /admin/invite-options
   Server: Returns roles and departments for this tenant
          ↓
Frontend: User fills form (email, fullName, roleId, departmentId)
          ↓
Frontend: POST /admin/invite-user
   Server:
   - Validates roleId against tenantRole table
   - Validates departmentId against department table
   - Creates user (confirmed=false)
   - Creates userTenant (status=pending)
   - Creates userTenantRole
   - Creates departmentMembership (if provided)
   - Generates activation token
   - Sends email
          ↓
Frontend: Shows success message
          ↓
Email: User receives invitation with activation link
          ↓
Frontend: User clicks activation link from email
          ↓
Frontend: POST /auth/activate?token=XXX
   Server:
   - Validates token
   - Sets user.confirmed = true
   - Activates pending userTenant records
          ↓
Frontend: Redirects to login / tenant selection
          ↓
User can now login and access the invited tenant
```

### Existing User Invitation Flow
```
Frontend: User clicks "Invite User"
          ↓
Frontend: GET /admin/invite-options
   Server: Returns roles and departments for this tenant
          ↓
Frontend: User fills form (email, roleId, departmentId, skips fullName)
          ↓
Frontend: POST /admin/invite-user
   Server:
   - Validates email exists in system
   - Validates roleId against tenantRole table
   - Validates departmentId against department table
   - Checks userTenant doesn't already exist (prevents duplicate)
   - Creates userTenant (status=active)
   - Creates userTenantRole
   - Creates departmentMembership (if provided)
   - NO email sent
          ↓
Frontend: Shows success message (no email sent)
          ↓
User is immediately added to tenant
User can login and immediately access the tenant
```

---

## Database Schema Relations

### New/Modified Relations

**New Records Created:**

1. `userTenant` - Links user to tenant
   - `user` (manyToOne → plugin::users-permissions.user)
   - `tenant` (manyToOne → api::tenant.tenant)
   - `userTenantStatus` (enum: pending, active, inactive, suspended)
   - `userTenantRoles` (oneToMany → api::user-tenant-role)

2. `userTenantRole` - Assigns role to user within tenant
   - `userTenant` (manyToOne → api::user-tenant)
   - `role` (manyToOne → plugin::users-permissions.role)
   - `userTenantRoleStatus` (enum: active, inactive)

3. `tenantRole` - Enables role for tenant (must exist for invite to work)
   - `tenant` (manyToOne → api::tenant.tenant)
   - `role` (manyToOne → plugin::users-permissions.role)
   - `isActive` (boolean)

4. `department` - Belongs to tenant
   - `tenant` (manyToOne → api::tenant.tenant)

5. `departmentMembership` - Optional, links user to department
   - `user` (manyToOne → plugin::users-permissions.user)
   - `department` (manyToOne → api::department.department)

---

## Setup Required

### 1. Create Feature (for Frontend Access Control)

The frontend route uses a feature guard `user.invite`. You must create this feature:

**Via Strapi Admin:**
1. Navigate to `Content Manager → Feature`
2. Create new record:
   - **name:** "Invite User"
   - **key:** "user.invite"
   - **type:** "feature"
   - **description:** "Allow users to invite new users to tenant"

3. Enable feature for tenants:
   - Navigate to `Content Manager → Tenant Feature`
   - Create record linking your feature to your tenant(s)

### 2. Enable Roles for Tenants

For each role you want to allow invitations:

**Via Strapi Admin:**
1. Navigate to `Content Manager → Tenant Role`
2. Create new record:
   - **tenant:** Select the target tenant
   - **role:** Select the role to enable (e.g., "Manager", "Admin")
   - **isActive:** true

### 3. Email Configuration

Email sending is required for new user invitations. Ensure SMTP is configured:

```env
SMTP_HOST=your.mailserver.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@example.com
SMTP_PASS=password
SMTP_REPLY_TO=admin@example.com
FRONTEND_URL=http://yourapp.com
```

### 4. Navigation Setup (Optional)

To add "Invite User" to the navigation menu:

**Option A: Via Feature Groups**
Create a feature group and link it to a navigation item

**Option B: Manual Navigation Link**
Add to your navigation configuration:
```javascript
{
  label: 'Invite User',
  href: '/invite-user',
  icon: 'icon-users',
  requiresFeature: 'user.invite'
}
```

---

## Testing Checklist

- [ ] Create test tenant with roles enabled
- [ ] Test inviting a NEW user
  - [ ] Verify email sent with activation link
  - [ ] Verify userTenant created with status "pending"
  - [ ] Verify user can activate via link
  - [ ] Verify pending userTenant activated to "active" on account activation
  - [ ] Verify user can login to that tenant

- [ ] Test inviting EXISTING user to NEW tenant
  - [ ] Verify NO email sent
  - [ ] Verify userTenant created with status "active"
  - [ ] Verify user can immediately access the tenant without additional activation

- [ ] Test validation
  - [ ] Attempt invalid email → Error message
  - [ ] Attempt duplicate invite → "Already invited" error
  - [ ] Attempt disabled role → "Role not enabled" error
  - [ ] Attempt department from different tenant → "Department doesn't belong" error

- [ ] Test department assignment
  - [ ] Invite with department → departmentMembership created
  - [ ] Invite without department → No departmentMembership created

- [ ] Permission access
  - [ ] User without `user.invite` feature → Forbidden page
  - [ ] User with `user.invite` feature → Can access form

---

## API Reference

### GET /admin/invite-options

**Authentication:** Required (Bearer token)

**Required Headers:**
- `Authorization: Bearer {token}`
- `x-tenant-code: {tenantCode}` (or authenticated via route)

**Response:**
```json
{
  "ok": true,
  "roles": [
    {
      "id": 1,
      "name": "Manager",
      "description": "Manages department",
      "type": "standard"
    }
  ],
  "departments": [
    {
      "id": 123,
      "name": "Sales Department",
      "code": "SALES"
    }
  ]
}
```

**Errors:**
- `400` - Tenant context required
- `500` - Server error

---

### POST /admin/invite-user

**Authentication:** Required (Bearer token)

**Required Headers:**
- `Authorization: Bearer {token}`
- `x-tenant-code: {tenantCode}` (or authenticated via route)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "email": "user@example.com",
  "roleId": 1,
  "fullName": "John Doe",
  "departmentId": 123
}
```

**Parameters:**
- `email` (string, required) - User's email
- `roleId` (number, required) - Tenant role ID
- `fullName` (string, optional) - Full name
- `departmentId` (number, optional) - Department ID

**Response (New User):**
```json
{
  "ok": true,
  "caseType": "NEW_USER",
  "userId": 456,
  "email": "user@example.com",
  "userTenantId": 789,
  "expiresAt": "2024-01-20T12:34:56.000Z",
  "emailSent": true
}
```

**Response (Existing User):**
```json
{
  "ok": true,
  "caseType": "EXISTING_USER",
  "userId": 456,
  "email": "user@example.com",
  "userTenantId": 789,
  "emailSent": false
}
```

**Errors:**
- `400` - Validation error (invalid email, role not enabled, dept doesn't belong, etc.)
- `409` - Duplicate invite (user already in this tenant)
- `500` - Server error

---

## Backward Compatibility

✅ **Fully compatible** with existing code:
- Old invite flow in cogi-fw/cogi-admin still works for non-tenant invites (if used elsewhere)
- Activation flow unchanged (just enhanced with userTenant activation)
- No breaking changes to existing routes or controllers
- No changes to permission system
- No changes to login flow

---

## Known Limitations & Future Enhancements

### Current Limitations
1. Department assignment is optional - users can be invited without department
2. Only one role per invite action (users can have multiple roles via admin)
3. Email template is hardcoded (could be made dynamic per tenant)

### Suggested Enhancements
1. Bulk invite (CSV upload)
2. Role templates for quick setup
3. Custom email templates per tenant
4. Invite expiration settings per tenant
5. Invite cancellation/revocation
6. Invite history audit log

---

## Support & Debugging

### User still gets 403 on tenant after invite
- [ ] Check `userTenant` exists with `userTenantStatus = active`
- [ ] Check `userTenantRole` exists with `userTenantRoleStatus = active`
- [ ] Check `tenantRole` exists with `isActive = true`
- [ ] For new users, check they clicked activation link (user.confirmed = true)

### Email not sent
- [ ] Check SMTP configuration in env vars
- [ ] Check email service logs in Strapi logs
- [ ] Verify `emailSent` response field (may return warning in response)

### Role dropdown empty on frontend
- [ ] Check `tenantRole` records exist for this tenant with `isActive = true`
- [ ] Verify role is properly linked in tenantRole table

### Department dropdown empty on frontend
- [ ] Check departments exist in database for this tenant
- [ ] Verify departments have `publishedAt` set (not null)

---

## Summary of Files Changed

### Backend
- ✅ Created: `/cogi-admin/src/api/admin/services/invite-user.ts` (NEW)
- ✅ Updated: `/cogi-admin/src/api/admin/controllers/admin.ts`
- ✅ Updated: `/cogi-admin/src/api/admin/routes/admin.ts`
- ✅ Updated: `/cogi-admin/src/api/auth-extended/controllers/auth-extended.ts`

### Frontend
- ✅ Created: `/cogi-framework/src/pages/InviteUser.jsx` (NEW)
- ✅ Updated: `/cogi-framework/src/router/AppRouter.jsx`

### Total: 4 files modified, 2 files created
