import assert from 'node:assert/strict'

function resolveMemberPostRequiresApproval({ routeGroup, activePolicyConfig = {} }) {
  const groupPolicy = routeGroup ? routeGroup.memberPostRequiresApproval : null
  return groupPolicy ?? (activePolicyConfig.memberPostRequiresApproval ?? true)
}

function canDirectPublish({ isAdmin = false, communityRole = 'member', isTenantMember = false, memberPostRequiresApproval }) {
  return Boolean(
    isAdmin ||
    communityRole === 'moderator' ||
    (isTenantMember && memberPostRequiresApproval === false)
  )
}

function resolveComposerSubmitAction({
  allowMemberPost = true,
  memberPostRequiresApproval,
  isTenantMember = false,
  communityRole = 'guest',
  isAdmin = false,
}) {
  const directPublish = canDirectPublish({
    isAdmin,
    communityRole,
    isTenantMember,
    memberPostRequiresApproval,
  })
  const canShowSubmitAction = Boolean(
    isAdmin ||
    communityRole === 'moderator' ||
    (isTenantMember && allowMemberPost !== false)
  )
  return {
    canDirectPublish: directPublish,
    canShowSubmitAction,
    actionLabel: directPublish ? 'Lưu và đăng ngay' : 'Lưu và đề nghị phê duyệt',
  }
}

function test() {
  assert.equal(
    canDirectPublish({ isTenantMember: true, communityRole: 'member', memberPostRequiresApproval: false }),
    true,
    'Member should be allowed to publish directly when approval is false.'
  )

  assert.equal(
    canDirectPublish({ isTenantMember: true, communityRole: 'member', memberPostRequiresApproval: true }),
    false,
    'Member should not be allowed to publish directly when approval is true.'
  )

  assert.equal(
    canDirectPublish({ isTenantMember: true, communityRole: 'member', memberPostRequiresApproval: undefined }),
    false,
    'Undefined policy must not imply direct publish.'
  )

  assert.equal(
    canDirectPublish({ isAdmin: true, memberPostRequiresApproval: true }),
    true,
    'Admin should keep direct-publish privilege.'
  )

  assert.equal(
    canDirectPublish({ communityRole: 'moderator', isTenantMember: true, memberPostRequiresApproval: true }),
    true,
    'Moderator should keep direct-publish privilege.'
  )

  assert.equal(
    resolveMemberPostRequiresApproval({ routeGroup: { memberPostRequiresApproval: false }, activePolicyConfig: { memberPostRequiresApproval: true } }),
    false,
    'Group-level false policy should take precedence over community-level true policy.'
  )

  assert.equal(
    resolveMemberPostRequiresApproval({ routeGroup: { memberPostRequiresApproval: undefined }, activePolicyConfig: { memberPostRequiresApproval: false } }),
    false,
    'Community false policy should be used when group policy is undefined.'
  )

  assert.equal(
    resolveMemberPostRequiresApproval({ routeGroup: null, activePolicyConfig: {} }),
    true,
    'Undefined policy should default to approval required.'
  )

  const directPublishAction = resolveComposerSubmitAction({
    allowMemberPost: true,
    memberPostRequiresApproval: false,
    isTenantMember: true,
    communityRole: 'member',
  })
  assert.equal(directPublishAction.canShowSubmitAction, true, 'Member should see primary submit action when member posting is allowed.')
  assert.equal(directPublishAction.actionLabel, 'Lưu và đăng ngay', 'Direct publish label should be shown when approval is not required.')

  const pendingAction = resolveComposerSubmitAction({
    allowMemberPost: true,
    memberPostRequiresApproval: true,
    isTenantMember: true,
    communityRole: 'member',
  })
  assert.equal(pendingAction.canShowSubmitAction, true, 'Member should still see primary submit action when approval is required.')
  assert.equal(pendingAction.actionLabel, 'Lưu và đề nghị phê duyệt', 'Submit-for-review label should be shown when approval is required.')

  const memberBlocked = resolveComposerSubmitAction({
    allowMemberPost: false,
    memberPostRequiresApproval: true,
    isTenantMember: true,
    communityRole: 'member',
  })
  assert.equal(memberBlocked.canShowSubmitAction, false, 'Member submit action must be hidden when member posting is disabled.')

  const adminAlwaysCanSubmit = resolveComposerSubmitAction({
    allowMemberPost: false,
    memberPostRequiresApproval: true,
    isTenantMember: false,
    communityRole: 'member',
    isAdmin: true,
  })
  assert.equal(adminAlwaysCanSubmit.canShowSubmitAction, true, 'Admin submit action should stay available regardless of member-post policy.')
  assert.equal(adminAlwaysCanSubmit.actionLabel, 'Lưu và đăng ngay', 'Admin action should keep direct publish.')

  console.log('community policy regression checks passed')
}

test()
