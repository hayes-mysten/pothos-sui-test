import { builder } from '../builder';

export const TransactionMetadata = builder.inputType('TransactionMetadata', {
	fields: (t) => ({
		sender: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		gasPrice: t.field({
			type: 'BigInt',
			required: false,
		}),
		gasObjects: t.field({
			type: ['SuiAddress'],
			required: { list: false, items: true },
		}),
	}),
});

export const CheckpointID = builder.inputType('CheckpointID', {
	fields: (t) => ({
		digest: t.string({
			required: false,
		}),
		sequenceNumber: t.int({
			required: false,
		}),
	}),
});
export const TransactionBlockID = builder.inputType('TransactionBlockID', {
	fields: (t) => ({
		transactionDigest: t.string({
			required: false,
		}),
		effectsDigest: t.string({
			required: false,
		}),
	}),
});

export const ObjectFilter = builder.inputType('ObjectFilter', {
	fields: (t) => ({
		package: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		module: t.string({
			required: false,
		}),
		type: t.string({
			required: false,
		}),
		owner: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		objectId: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		version: t.int({
			required: false,
		}),
	}),
});
export const EventFilter = builder.inputType('EventFilter', {
	fields: (t) => ({
		sender: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		transactionDigest: t.string({
			required: false,
		}),
		emittingPackage: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		emittingModule: t.string({
			required: false,
		}),
		eventPackage: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		eventModule: t.string({
			required: false,
		}),
		eventType: t.string({
			required: false,
		}),
		eventField: t.field({
			type: EventField,
			required: false,
		}),
		startTime: t.field({
			type: 'DateTime',
			required: false,
		}),
		endTime: t.field({
			type: 'DateTime',
			required: false,
		}),
	}),
});
export const EventField = builder.inputType('EventField', {
	fields: (t) => ({
		path: t.string({
			required: false,
		}),
		json: t.string({
			required: false,
		}),
	}),
});
export const TransactionBlockFilter = builder.inputType('TransactionBlockFilter', {
	fields: (t) => ({
		package: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		module: t.string({
			required: false,
		}),
		function: t.string({
			required: false,
		}),
		kind: t.field({
			type: TransactionBlockKindInput,
			required: false,
		}),
		checkpoint: t.int({
			required: false,
		}),
		signAddress: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		sentAddress: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		recvAddress: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		paidAddress: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		inputObject: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		changedObject: t.field({
			type: 'SuiAddress',
			required: false,
		}),
	}),
});
export const DynamicFieldFilter = builder.inputType('DynamicFieldFilter', {
	fields: (t) => ({
		namePackage: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		nameModule: t.string({
			required: false,
		}),
		nameType: t.string({
			required: false,
		}),
		valuePackage: t.field({
			type: 'SuiAddress',
			required: false,
		}),
		valueModule: t.string({
			required: false,
		}),
		valueType: t.string({
			required: false,
		}),
	}),
});

const TransactionBlockKindInput = builder.enumType('TransactionBlockKindInput', {
	values: {
		CONSENSUS_COMMIT_PROLOGUE: {
			value: 'CONSENSUS_COMMIT_PROLOGUE',
		},
		GENESIS: {
			value: 'GENESIS',
		},
		CHANGE_EPOCH: {
			value: 'CHANGE_EPOCH',
		},
		PROGRAMMABLE: {
			value: 'PROGRAMMABLE',
		},
	},
} as const);
