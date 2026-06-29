function normalizeText(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value).trim();
}

export function readCampaignStatus(campaign: any): 'draft' | 'open' | 'closed' {
	const normalized = normalizeText(campaign?.campaignStatus || campaign?.status).toLowerCase();
	if (normalized === 'open' || normalized === 'closed') {
		return normalized;
	}
	return 'draft';
}

export function readApplicationStatus(application: any): string {
	return normalizeText(application?.admissionStatus || application?.status || 'draft').toLowerCase() || 'draft';
}

export function readApplicationReviewStatus(application: any): string {
	return normalizeText(application?.reviewStatus).toLowerCase();
}

export function isDraftApplication(application: any): boolean {
	return readApplicationStatus(application) === 'draft';
}

export function isNeedUpdateApplication(application: any): boolean {
	const admissionStatus = readApplicationStatus(application);
	const reviewStatus = readApplicationReviewStatus(application);
	return admissionStatus === 'rejected' || reviewStatus === 'returned' || reviewStatus === 'need_update';
}

export function canCreateApplication(campaign: any): boolean {
	return readCampaignStatus(campaign) === 'open';
}

export function canEditDraftApplication(campaign: any, application: any): boolean {
	return readCampaignStatus(campaign) === 'open' && isDraftApplication(application);
}

export function canSubmitDraftApplication(campaign: any, application: any): boolean {
	return canEditDraftApplication(campaign, application);
}

export function canEditNeedUpdateApplication(_campaign: any, application: any): boolean {
	return isNeedUpdateApplication(application);
}

export function canResubmitNeedUpdateApplication(_campaign: any, application: any): boolean {
	return isNeedUpdateApplication(application);
}

export function canUploadMainEvidence(campaign: any, application: any): boolean {
	return (readCampaignStatus(campaign) === 'open' && isDraftApplication(application)) || isNeedUpdateApplication(application);
}

export function canSendConversationAttachment(_campaign: any, application: any): boolean {
	void application;
	return false;
}

export function canTrackApplication(_campaign: any, application: any): boolean {
	return Boolean(application?.id) && application?.isDeleted !== true;
}

export function canEditApplication(campaign: any, application: any): boolean {
	return canEditDraftApplication(campaign, application) || canEditNeedUpdateApplication(campaign, application);
}

export function canSubmitApplication(campaign: any, application: any): boolean {
	return canSubmitDraftApplication(campaign, application) || canResubmitNeedUpdateApplication(campaign, application);
}

export function isMainFormFileEditAllowed(campaign: any, application: any): boolean {
	return canUploadMainEvidence(campaign, application);
}

export function getCampaignPublicStatusMessage(campaign: any): string {
	const status = readCampaignStatus(campaign);
	if (status === 'draft') {
		return 'Kỳ tuyển sinh chưa mở. Phụ huynh vui lòng quay lại sau khi Nhà trường mở cổng đăng ký.';
	}
	if (status === 'closed') {
		return 'Cổng tiếp nhận hồ sơ mới đã đóng. Phụ huynh chỉ có thể tra cứu, theo dõi hồ sơ đã nộp hoặc bổ sung hồ sơ nếu đã được Nhà trường yêu cầu.';
	}
	return '';
}

export function buildPublicAdmissionV1Permissions(campaign: any, application: any) {
	return {
		campaignStatus: readCampaignStatus(campaign),
		canCreate: !application && canCreateApplication(campaign),
		canTrack: canTrackApplication(campaign, application),
		canEdit: canEditApplication(campaign, application),
		canSubmit: canSubmitApplication(campaign, application),
		canUploadMainEvidence: isMainFormFileEditAllowed(campaign, application),
		canSendConversationAttachment: canSendConversationAttachment(campaign, application),
		canEditNonFileFieldsOnly: false,
		isDraft: isDraftApplication(application),
		isNeedUpdate: isNeedUpdateApplication(application),
		statusMessage: getCampaignPublicStatusMessage(campaign),
	};
}