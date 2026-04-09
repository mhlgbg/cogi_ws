export default {
	routes: [
		{
			method: 'GET',
			path: '/fee-sheet-classes/:id',
			handler: 'fee-sheet-class.findOne',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/my-fee-sheet-classes',
			handler: 'fee-sheet-class.listMine',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/my-fee-sheet-classes/:id',
			handler: 'fee-sheet-class.findMineOne',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/my-fee-sheet-classes/:id/fee-items/:feeItemId',
			handler: 'fee-sheet-class.updateMineFeeItem',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/my-fee-sheet-classes/:id/submit',
			handler: 'fee-sheet-class.submitMine',
			config: {
				auth: false,
			},
		},
	],
};