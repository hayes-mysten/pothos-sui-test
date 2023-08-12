// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { EpochInfo } from '@mysten/sui.js/dist/cjs/client';
import { suiClient } from '../client';

const allEpochs: EpochInfo[] = [];
let latestEpoch = -1;
let epochCursor: string | null = null;

export async function getEpochs(keys: string[]) {
	const max = Math.max(...keys.map((key) => Number.parseInt(key, 10)));

	while (max > latestEpoch) {
		const page = await suiClient.getEpochs({
			cursor: epochCursor,
		});
		epochCursor = page.nextCursor;

		// eslint-disable-next-line no-loop-func
		page.data.forEach((epoch) => {
			allEpochs.push(epoch);
			const currentEpoch = Number.parseInt(epoch.epoch, 10);
			latestEpoch = Math.max(latestEpoch, currentEpoch);
		});

		if (!page.hasNextPage) {
			break;
		}
	}

	return keys.map(
		(key) => allEpochs.find((epoch) => epoch.epoch === String(key)) || new Error('Epoch not found'),
	);
}
