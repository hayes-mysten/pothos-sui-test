// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { toB64 } from '@mysten/sui.js/utils';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';
import DataloaderPlugin from '@pothos/plugin-dataloader';

export const builder = new SchemaBuilder<{
	Scalars: {
		ID: {
			Input: string;
			Output: string | number;
		};
		BigInt: {
			Input: string;
			Output: string | number | bigint;
		};
		DateTime: {
			Input: string;
			Output: string | Date;
		};
		Base64: {
			Input: string;
			Output: string | Uint8Array;
		};
		SuiAddress: {
			Input: string;
			Output: string;
		};
	};
}>({
	plugins: [RelayPlugin, SimpleObjectsPlugin, DataloaderPlugin],
	relayOptions: {
		clientMutationId: 'omit',
		cursorType: 'String',
	},
});

builder.scalarType('BigInt', {
	serialize: (value) => {
		return value.toString();
	},
});

builder.scalarType('DateTime', {
	serialize: (value) => {
		return value instanceof Date ? value.toISOString() : value;
	},
});

builder.scalarType('Base64', {
	serialize: (value) => {
		return value instanceof Uint8Array ? toB64(value) : value;
	},
});

builder.scalarType('SuiAddress', {
	serialize: (value) => {
		return value;
	},
});
