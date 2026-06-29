export default {
	beforeCreate(event) {
		const data = event?.params?.data;
		if (data && !data.activityAt) {
			data.activityAt = new Date().toISOString();
		}
	},
};