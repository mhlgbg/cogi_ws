export function resolveCommunityComposerSubmitAction({
  allowMemberPost = true,
  memberPostRequiresApproval,
  isTenantMember = false,
  communityRole = 'guest',
  isAdmin = false,
}) {
  const canDirectPublish = Boolean(
    isAdmin ||
    communityRole === 'moderator' ||
    (isTenantMember && memberPostRequiresApproval === false)
  )

  const canShowSubmitAction = Boolean(
    isAdmin ||
    communityRole === 'moderator' ||
    (isTenantMember && allowMemberPost !== false)
  )

  return {
    canDirectPublish,
    canShowSubmitAction,
    actionLabel: canDirectPublish ? 'Lưu và đăng ngay' : 'Lưu và đề nghị phê duyệt',
  }
}

export function resolveCommunityComposerCanSubmit(form = {}) {
  const text = typeof form?.content === 'string' ? form.content : ''
  return Boolean(text.replace(/<[^>]*>/g, '').trim())
}
