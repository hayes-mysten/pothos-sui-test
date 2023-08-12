// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable no-import-assign */

import {
	type GasCostSummary,
	type Checkpoint,
	type EndOfEpochData,
	type ProtocolConfig,
	type EpochInfo,
	type SuiValidatorSummary,
	type TransactionBlock,
	type TransactionEffects,
	type SuiEvent,
	SuiTransactionBlockKind,
	SuiTransaction,
	SuiArgument,
	SuiGasData,
} from '@mysten/sui.js/client';
import { normalizeStructTag, parseStructTag } from '@mysten/sui.js/utils';
import { builder } from '../builder';
import { suiClient } from '../client';
import { getEpochs } from './epochs';
import {
	ResolveCursorConnectionArgs,
	resolveCursorConnection,
	resolveArrayConnection,
} from '@pothos/plugin-relay';
import {
	CheckpointID,
	DynamicFieldFilter,
	EventFilter,
	ObjectFilter,
	TransactionBlockFilter,
	TransactionBlockID,
} from './inputs';

builder.queryType({
	fields: (t) => ({
		chainIdentifier: t.string({
			resolve: async () => {
				return 'todo';
			},
		}),
		availableRanges: t.field({
			type: AvailableRanges,
			resolve: () => ({
				// todo get first and last checkpoint
			}),
		}),
		owner: t.field({
			type: Owner,
			nullable: true,
			args: {
				address: t.arg({
					type: 'SuiAddress',
					required: false,
				}),
			},

			resolve: async (root, args) => {
				return args.address;
			},
		}),
		object: t.field({
			type: ObjectRef,
			nullable: true,
			args: {
				address: t.arg({
					type: 'SuiAddress',
					required: false,
				}),
				version: t.arg.int({
					required: false,
				}),
			},
			resolve: async (root, args) => {
				const result = await suiClient.tryGetPastObject({
					id: args.address!,
					version: args.version!,
				});

				if (result.status === 'VersionFound') {
					return result.details;
				}

				return null;
			},
		}),
		address: t.field({
			type: Address,
			nullable: true,
			args: {
				address: t.arg({
					type: 'SuiAddress',
					required: false,
				}),
			},
			resolve: async (root, args) => {
				return args.address;
			},
		}),
		epoch: t.field({
			type: Epoch,
			nullable: true,
			args: {
				epochId: t.arg.int({
					required: false,
				}),
			},
			resolve: async (root, args) => {
				return String(args.epochId);
			},
		}),
		protocolConfig: t.field({
			type: ProtocolConfigs,
			nullable: true,
			args: {
				protocolVersion: t.arg.int({
					required: false,
				}),
			},
			resolve: async (root, args) => {
				const result = await suiClient.getProtocolConfig({
					version: String(args.protocolVersion),
				});

				return result;
			},
		}),
		checkpoint: t.field({
			type: Checkpoint,
			nullable: true,
			args: {
				id: t.arg({
					type: CheckpointID,
					required: false,
				}),
			},
			resolve: async (root, args) => {
				return args.id?.digest;
			},
		}),
		transactionBlock: t.field({
			type: TransactionBlock,
			nullable: true,
			args: {
				filter: t.arg({
					type: TransactionBlockID,
					required: false,
				}),
			},
			resolve: async (root, args) => {
				return args.filter?.transactionDigest;
			},
		}),
		coinMetadata: t.field({
			type: CoinMetadata,
			nullable: true,
			args: {
				coinType: t.arg.string({
					required: false,
				}),
			},
			resolve: async (root, args) => {
				const result = await suiClient.getCoinMetadata({
					coinType: args.coinType!,
				});

				return result;
			},
		}),
		checkpointConnection: t.connection({
			type: Checkpoint,
			nullable: true,
			resolve: async (root, args) => {
				return resolveCursorConnection(
					{
						args,
						toCursor: (data) => data.sequenceNumber,
					},
					async ({ before, after, inverted, limit }: ResolveCursorConnectionArgs) => {
						if (before) {
							throw new Error('backwards pagination not implemented');
						}

						const page = await suiClient.getCheckpoints({
							descendingOrder: !inverted,
							limit,
							cursor: after,
						});

						return page.data;
					},
				);
			},
		}),
		transactionBlockConnection: t.connection({
			type: TransactionBlock,
			nullable: true,
			args: {
				filter: t.arg({
					type: TransactionBlockFilter,
					required: false,
				}),
			},
			resolve: async (root, args) => {
				return resolveCursorConnection(
					{
						args,
						toCursor: (data) => data.digest,
					},
					async ({ before, after, inverted, limit }: ResolveCursorConnectionArgs) => {
						if (before) {
							throw new Error('backwards pagination not implemented');
						}

						const page = await suiClient.queryTransactionBlocks({
							// filter: args.filter,
							limit,
							cursor: after,
							order: inverted ? 'descending' : 'ascending',
						});

						return page.data;
					},
				);
			},
		}),
		eventConnection: t.connection({
			type: Event,
			nullable: true,
			args: {
				filter: t.arg({
					type: EventFilter,
					required: false,
				}),
			},
			resolve: async (root, args) => {
				return resolveCursorConnection(
					{
						args,
						toCursor: (data) => `${data.id.eventSeq},${data.id.txDigest}`,
					},
					async ({ before, after, inverted, limit }: ResolveCursorConnectionArgs) => {
						if (before) {
							throw new Error('backwards pagination not implemented');
						}

						const page = await suiClient.queryEvents({
							// filter: args.filter,
							limit,
							query: {
								All: [],
							},
							// cursor: after,
							// order: inverted ? 'descending' : 'ascending',
						});

						return page.data;
					},
				);
			},
		}),
		objectConnection: t.connection({
			type: ObjectRef,
			nullable: true,
			args: {
				filter: t.arg({
					type: ObjectFilter,
					required: false,
				}),
			},
			resolve: (root, args) => {
				throw new Error('not implemented');
			},
		}),
	}),
});

const AvailableRanges = builder
	.objectRef<{ first?: string; last?: string }>('AvailableRanges')
	.implement({
		fields: (t) => ({
			first: t.expose('first', {
				nullable: true,
				type: Checkpoint,
			}),
			last: t.expose('last', {
				nullable: true,
				type: Checkpoint,
			}),
		}),
	});

const GasCostSummary = builder.objectRef<GasCostSummary>('GasCostSummary').implement({
	fields: (t) => ({
		computationCost: t.expose('computationCost', {
			nullable: true,
			type: 'BigInt',
		}),
		storageCost: t.expose('storageCost', {
			nullable: true,
			type: 'BigInt',
		}),
		storageRebate: t.expose('storageRebate', {
			nullable: true,
			type: 'BigInt',
		}),
		nonRefundableStorageFee: t.expose('nonRefundableStorageFee', {
			nullable: true,
			type: 'BigInt',
		}),
	}),
});

const CommitteeMember = builder.simpleObject('CommitteeMember', {
	fields: (t) => ({
		authorityName: t.string({ nullable: true }),
		stakeUnit: t.string({ nullable: true }),
	}),
});

const EndOfEpochData = builder.objectRef<EndOfEpochData>('EndOfEpochData').implement({
	fields: (t) => ({
		newCommittee: t.field({
			type: [CommitteeMember],
			nullable: true,
			resolve: (root) =>
				root.nextEpochCommittee.map(([authorityName, stakeUnit]) => ({
					authorityName,
					stakeUnit,
				})),
		}),
		nextProtocolVersion: t.exposeString('nextEpochProtocolVersion', { nullable: true }),
	}),
});

const Checkpoint = builder.loadableNodeRef<Checkpoint>('Checkpoint', {
	id: {
		resolve: (checkpoint) => checkpoint.digest,
	},
	load: (keys: string[]) => Promise.all(keys.map((id) => suiClient.getCheckpoint({ id }))),
});

Checkpoint.implement({
	fields: (t) => ({
		digest: t.exposeString('digest'),
		sequenceNumber: t.expose('sequenceNumber', {
			type: 'BigInt',
		}),
		timestamp: t.field({
			type: 'DateTime',
			resolve: (checkpoint) => new Date(checkpoint.timestampMs),
		}),
		validatorSignature: t.field({
			type: 'Base64',
			resolve: (checkpoint) => checkpoint.validatorSignature,
		}),
		previousCheckpointDigest: t.string({
			nullable: true,
			resolve: (checkpoint) => checkpoint.previousDigest,
		}),
		liveObjectSetDigest: t.string({
			nullable: true,
			resolve: (checkpoint) => {
				// TODO
				return null;
			},
		}),
		networkTotalTransactions: t.expose('networkTotalTransactions', {
			type: 'BigInt',
			nullable: true,
		}),
		rollingGasSummary: t.expose('epochRollingGasCostSummary', {
			type: GasCostSummary,
			nullable: true,
		}),

		epoch: t.field({
			type: Epoch,
			resolve: (checkpoint) => checkpoint.epoch,
		}),
		endOfEpoch: t.field({
			type: EndOfEpochData,
			nullable: true,
			resolve: async (checkpoint) => {
				return checkpoint.endOfEpochData;
			},
		}),
		transactionsConnection: t.connection({
			type: TransactionBlock,
			nullable: true,
			resolve: async (checkpoint, args) => {
				return resolveCursorConnection(
					{
						args,
						toCursor: (data) => data.digest,
					},
					async ({ before, after, inverted, limit }: ResolveCursorConnectionArgs) => {
						if (before) {
							throw new Error('backwards pagination not implemented');
						}

						const page = await suiClient.queryTransactionBlocks({
							filter: {
								Checkpoint: checkpoint.digest,
							},
							limit,
							cursor: after,
							order: inverted ? 'descending' : 'ascending',
						});

						return page.data;
					},
				);
			},
		}),
	}),
});

const Epoch = builder.loadableNode('Epoch', {
	id: {
		resolve: (epoch) => epoch.epoch,
	},
	load: (keys: string[]) => getEpochs(keys),
	fields: (t) => ({
		epochId: t.int({
			resolve: (epoch) => Number.parseInt(epoch.epoch, 10),
		}),
		systemStateVersion: t.int({
			nullable: true,
			resolve: (epoch) => {
				// TODO get epoch version
				return null;
			},
		}),
		protocolConfigs: t.field({
			type: ProtocolConfigs,
			resolve: (epoch) => {
				return suiClient.getProtocolConfig({
					// TODO get version, not currently available
				});
			},
		}),
		referenceGasPrice: t.expose('referenceGasPrice', {
			type: 'BigInt',
			nullable: true,
		}),
		systemParameters: t.field({
			type: SystemParameters,
			nullable: true,
			resolve: (epoch) => {
				// TODO get system parameters
				return null;
			},
		}),
		stakeSubsidy: t.field({
			type: StakeSubsidy,
			nullable: true,
			resolve: (epoch) => {
				// TODO get stake subsidy
				return null;
			},
		}),
		validatorSet: t.field({
			type: ValidatorSet,
			nullable: true,
			resolve: (epoch) => ({
				validators: epoch.validators,
			}),
		}),
		storageFund: t.field({
			type: StorageFund,
			nullable: true,
			resolve: (epoch) => {
				// TODO get storage fund
				return null;
			},
		}),
		safeMode: t.field({
			type: SafeMode,
			nullable: true,
			resolve: (epoch) => {
				// TODO get safe mode
				return null;
			},
		}),
		startTimestamp: t.expose('epochStartTimestamp', {
			type: 'DateTime',
			nullable: true,
		}),
		endTimestamp: t.field({
			type: 'DateTime',
			nullable: true,
			resolve: (epoch) => epoch.endOfEpochInfo?.epochEndTimestamp,
		}),

		checkpointsConnection: t.connection({
			type: Checkpoint,
			nullable: true,
			resolve: async (epoch, args) => {
				return resolveCursorConnection(
					{
						args,
						toCursor: (data) => data.sequenceNumber,
					},
					async ({ before, after, inverted, limit }: ResolveCursorConnectionArgs) => {
						if (before) {
							throw new Error('backwards pagination not implemented');
						}

						// TODO this is just getting all checkpoints, not epoch checkpoints
						const page = await suiClient.getCheckpoints({
							descendingOrder: !inverted,
							limit,
							cursor: after,
						});

						return page.data;
					},
				);
			},
		}),

		transactionBlocksConnection: t.connection({
			type: TransactionBlock,
			nullable: true,
			resolve: async (epoch, args) => {
				return resolveCursorConnection(
					{
						args,
						toCursor: (data) => data.digest,
					},
					async ({ before, after, inverted, limit }: ResolveCursorConnectionArgs) => {
						if (before) {
							throw new Error('backwards pagination not implemented');
						}

						const page = await suiClient.queryTransactionBlocks({
							// TODO these transactions are not filtered by epochs
							limit,
							cursor: after,
							order: inverted ? 'descending' : 'ascending',
						});

						return page.data;
					},
				);
			},
		}),
	}),
});

const ProtocolConfigs = builder.objectRef<ProtocolConfig>('ProtocolConfigs').implement({
	fields: (t) => ({
		protocolVersion: t.int({
			resolve: (protocolConfig) => Number.parseInt(protocolConfig.protocolVersion, 10),
		}),
		configs: t.field({
			type: [ProtocolConfig],
			nullable: { list: true, items: true },
			resolve: (protocolConfig) => {
				return Object.entries(protocolConfig.attributes)
					.filter(([_, value]) => value)
					.map(([key, value]) => ({
						key,
						value: String(Object.values(value!)[0]),
					}));
			},
		}),
		config: t.field({
			type: ProtocolConfig,
			nullable: true,
			args: {
				key: t.arg.string({
					required: false,
				}),
			},
			resolve: (protocolConfig, args) => {
				const value = protocolConfig.attributes[args.key!];
				return (
					value && {
						key: args.key,
						value: String(Object.values(value)[0]),
					}
				);
			},
		}),
	}),
});

const SystemParameters = builder.simpleObject('SystemParameters', {
	fields: (t) => ({
		duration: t.field({ type: 'BigInt', nullable: true }),
		stakeSubsidyStartEpoch: t.int({ nullable: true }),
		minValidatorCount: t.int({ nullable: true }),
		maxValidatorCount: t.int({ nullable: true }),
		minValidatorJoiningStake: t.field({ type: 'BigInt', nullable: true }),
		validatorLowStakeThreshold: t.field({ type: 'BigInt', nullable: true }),
		validatorVeryLowStakeThreshold: t.field({ type: 'BigInt', nullable: true }),
		validatorLowStakeGracePeriod: t.int({ nullable: true }),
	}),
});

const StakeSubsidy = builder.simpleObject('StakeSubsidy', {
	fields: (t) => ({
		balance: t.field({ type: 'BigInt', nullable: true }),
		distributionCounter: t.field({ type: 'BigInt', nullable: true }),
		currentDistributionAmount: t.field({ type: 'BigInt', nullable: true }),
		periodLength: t.int({ nullable: true }),
		decreaseRate: t.int({ nullable: true }),
	}),
});

const ValidatorSet = builder
	.objectRef<{ validators: EpochInfo['validators'] }>('ValidatorSet')
	.implement({
		fields: (t) => ({
			totalStake: t.field({
				type: 'BigInt',
				resolve: (root) => {
					return root.validators.reduce((sum, { pendingStake }) => sum + BigInt(pendingStake), 0n);
				},
			}),
			activeValidators: t.field({
				type: [Validator],
				resolve: (root) => root.validators,
			}),
			pendingRemovals: t.intList({
				resolve: (root) => {
					const removals: number[] = [];

					root.validators.forEach(({ nextEpochStake }, i) => {
						if (!(nextEpochStake && BigInt(nextEpochStake) > 0n)) {
							removals.push(i);
						}
					});

					return removals;
				},
			}),
			pendingActiveValidators: t.field({
				type: MoveObject,
				nullable: true,
				resolve: (root) => {
					// TODO
					return null;
				},
			}),
			pendingActiveValidatorsSize: t.field({
				type: 'BigInt',
				nullable: true,
				resolve: (root) => {
					// TODO
					return null;
				},
			}),
			stakePoolMappings: t.field({
				type: MoveObject,
				nullable: true,
				resolve: (root) => {
					// TODO
					return null;
				},
			}),
			stakePoolMappingsSize: t.field({
				type: 'BigInt',
				nullable: true,
				resolve: (root) => {
					// TODO
					return null;
				},
			}),
			inactivePools: t.field({
				type: MoveObject,
				nullable: true,
				resolve: (root) => {
					// TODO
					return null;
				},
			}),
			inactivePoolsSize: t.field({
				type: 'BigInt',
				nullable: true,
				resolve: (root) => {
					// TODO
					return null;
				},
			}),
			validatorCandidates: t.field({
				type: MoveObject,
				nullable: true,
				resolve: (root) => {
					// TODO
					return null;
				},
			}),
			validatorCandidatesSize: t.field({
				type: 'BigInt',
				nullable: true,
				resolve: (root) => {
					// TODO
					return null;
				},
			}),
		}),
	});

const ValidatorCredentials = builder.simpleObject('ValidatorCredentials', {
	fields: (t) => ({
		protocolPubKey: t.field({
			type: 'Base64',
			nullable: true,
		}),
		networkPubKey: t.field({
			type: 'Base64',
			nullable: true,
		}),
		workerPubKey: t.field({
			type: 'Base64',
			nullable: true,
		}),
		proofOfPossession: t.field({
			type: 'Base64',
			nullable: true,
		}),
		netAddress: t.string({ nullable: true }),
		p2pAddress: t.string({ nullable: true }),
		primaryAddress: t.string({ nullable: true }),
		workerAddress: t.string({ nullable: true }),
	}),
});

const Validator = builder.objectRef<SuiValidatorSummary>('Validator').implement({
	fields: (t) => ({
		address: t.field({
			type: Address,
			resolve: (root) => root.suiAddress,
		}),
		credentials: t.field({
			type: ValidatorCredentials,
			resolve: (root) => ({
				protocolPubKey: root.protocolPubkeyBytes,
				networkPubKey: root.networkPubkeyBytes,
				workerPubKey: root.workerPubkeyBytes,
				proofOfPossession: root.proofOfPossessionBytes,
				netAddress: root.netAddress,
				p2pAddreess: root.p2pAddress,
				primaryAddress: root.primaryAddress,
			}),
		}),
		nextEpochCredentials: t.field({
			type: ValidatorCredentials,
			resolve: (root) => ({
				protocolPubKey: root.nextEpochProtocolPubkeyBytes,
				networkPubKey: root.nextEpochNetworkPubkeyBytes,
				workerPubKey: root.nextEpochWorkerPubkeyBytes,
				proofOfPossession: root.nextEpochProofOfPossession,
				netAddress: root.nextEpochNetAddress,
				p2pAddreess: root.nextEpochP2pAddress,
				primaryAddress: root.nextEpochPrimaryAddress,
			}),
		}),
		name: t.exposeString('name', { nullable: true }),
		description: t.exposeString('description', { nullable: true }),
		imageUrl: t.exposeString('imageUrl', { nullable: true }),
		projectUrl: t.exposeString('projectUrl', { nullable: true }),
		operationCap: t.field({
			type: MoveObject,
			nullable: true,
			resolve: (root) => {
				// TODO
				return null;
			},
		}),
		stakingPool: t.field({
			type: MoveObject,
			nullable: true,
			resolve: (root) => {
				// TODO
				return null;
			},
		}),
		exchangeRates: t.field({
			type: MoveObject,
			nullable: true,
			resolve: (root) => {
				// TODO
				return null;
			},
		}),
		stakingPoolActivationEpoch: t.int({
			nullable: true,
			resolve: (root) =>
				root.stakingPoolActivationEpoch == null
					? null
					: Number.parseInt(root.stakingPoolActivationEpoch, 10),
		}),
		stakingPoolSuiBalance: t.expose('stakingPoolSuiBalance', { type: 'BigInt', nullable: true }),
		rewardsPool: t.expose('rewardsPool', { type: 'BigInt', nullable: true }),
		poolTokenBalance: t.expose('poolTokenBalance', { type: 'BigInt', nullable: true }),
		pendingStake: t.expose('pendingStake', { type: 'BigInt', nullable: true }),
		pendingTotalSuiWithdraw: t.expose('pendingTotalSuiWithdraw', {
			type: 'BigInt',
			nullable: true,
		}),
		pendingPoolTokenWithdraw: t.expose('pendingPoolTokenWithdraw', {
			type: 'BigInt',
			nullable: true,
		}),
		exchangeRatesSize: t.expose('exchangeRatesSize', { type: 'BigInt', nullable: true }),
		votingPower: t.int({
			nullable: true,
			resolve: (root) => Number.parseInt(root.votingPower, 10),
		}),
		stakeUnits: t.int({
			nullable: true,
			resolve: (root) => {
				// TODO
				return null;
			},
		}),
		gasPrice: t.expose('gasPrice', { type: 'BigInt', nullable: true }),
		commissionRate: t.expose('commissionRate', { type: 'BigInt', nullable: true }),
		nextEpochStake: t.expose('nextEpochStake', { type: 'BigInt', nullable: true }),
		nextEpochGasPrice: t.expose('nextEpochGasPrice', { type: 'BigInt', nullable: true }),
		nextEpochCommissionRate: t.expose('nextEpochCommissionRate', {
			type: 'BigInt',
			nullable: true,
		}),
		atRisk: t.int({
			nullable: true,
			resolve: (root) => {
				// TODO
				return null;
			},
		}),
		reportRecords: t.field({
			type: ['SuiAddress'],
			nullable: true,
			resolve: (root) => {
				// TODO
				return [];
			},
		}),
		apy: t.float({
			nullable: true,
			resolve: (root) => {
				// TODO
				return null;
			},
		}),
	}),
});

const StorageFund = builder.simpleObject('StorageFund', {
	fields: (t) => ({
		totalObjectStorageRebates: t.field({ type: 'BigInt', nullable: true }),
		nonRefundableBalance: t.field({ type: 'BigInt', nullable: true }),
	}),
});

const SafeMode = builder.simpleObject('SafeMode', {
	fields: (t) => ({
		enabled: t.boolean({ nullable: true }),
		gasSummary: t.field({ type: GasCostSummary, nullable: true }),
	}),
});

const TransactionBlock = builder.loadableNodeRef('TransactionBlock', {
	id: {
		resolve: (txb) => txb.digest,
	},
	load: async (keys: string[]) => {
		const result = await suiClient.multiGetTransactionBlocks({
			digests: keys,
			options: {
				showBalanceChanges: true,
				showEvents: true,
				showRawInput: true,
				showInput: true,
				showEffects: true,
				showObjectChanges: true,
			},
		});

		return keys.map(
			(digest) =>
				result.find((txb) => txb.digest === digest) ??
				new Error(`TransactionBlock ${digest} not found`),
		);
	},
});
TransactionBlock.implement({
	fields: (t) => ({
		digest: t.exposeString('digest'),
		sender: t.field({
			type: Address,
			nullable: true,
			resolve: (txb) => txb.transaction?.data.sender,
		}),
		gasInput: t.field({
			type: GasInput,
			nullable: true,
			resolve: (txb) => txb.transaction?.data.gasData,
		}),
		kind: t.field({
			type: TransactionBlockKind,
			nullable: true,
			resolve: (txb) => {
				return txb.transaction?.data.transaction;
			},
		}),
		signatures: t.field({
			type: [TransactionSignature],
			nullable: true,
			resolve: (txb) => txb.transaction?.txSignatures,
		}),
		effects: t.field({
			type: TransactionBlockEffects,
			nullable: true,
			resolve: (txb) => txb.effects,
		}),
		expiration: t.field({
			type: Epoch,
			nullable: true,
			resolve: (txb) => {
				// TODO
				return null;
			},
		}),
		bcs: t.field({
			type: 'Base64',
			nullable: true,
			resolve: (txb) => {
				// TODO
				return null;
			},
		}),
	}),
});

const TransactionSignature = builder.objectRef<string>('TransactionSignature').implement({
	fields: (t) => ({
		signature: t.string({
			resolve: (txSig) => txSig,
		}),
	}),
});

const Address = builder.objectRef<string>('Address');

Address.implement({
	fields: (t) => ({
		transactionBlockConnection: t.connection({
			type: TransactionBlock,
			nullable: true,
			args: {
				relation: t.arg({
					type: AddressTransactionBlockRelationship,
					required: false,
				}),
				filter: t.arg({
					type: TransactionBlockFilter,
					required: false,
				}),
			},
			resolve: async (address, args) => {
				return resolveCursorConnection(
					{ args, toCursor: (data) => data.digest },
					async ({ before, after, inverted, limit }: ResolveCursorConnectionArgs) => {
						if (before) {
							throw new Error('backwards pagination not implemented');
						}

						const page = await suiClient.queryTransactionBlocks({
							filter: {
								FromOrToAddress: {
									addr: address,
								},
							},
							limit,
							cursor: after,
							order: inverted ? 'descending' : 'ascending',
						});

						return page.data;
					},
				);
			},
		}),
	}),
});

const GenesisTransaction = builder
	.objectRef<Extract<SuiTransactionBlockKind, { kind: 'Genesis' }>>('GenesisTransaction')
	.implement({
		fields: (t) => ({
			objects: t.field({
				type: [ObjectRef],
				resolve: (tx) => tx.objects,
			}),
		}),
	});

const ChangeEpochTransaction = builder
	.objectRef<Extract<SuiTransactionBlockKind, { kind: 'ChangeEpoch' }>>('ChangeEpochTransaction')
	.implement({
		fields: (t) => ({
			epoch: t.field({
				type: Epoch,
				nullable: true,
				resolve: (tx) => tx.epoch,
			}),
			timestamp: t.field({
				type: 'DateTime',
				nullable: true,
				resolve: (tx) => new Date(tx.epoch_start_timestamp_ms),
			}),
			storageCharge: t.field({
				type: 'BigInt',
				nullable: true,
				resolve: (tx) => tx.storage_charge,
			}),
			computationCharge: t.field({
				type: 'BigInt',
				nullable: true,
				resolve: (tx) => tx.computation_charge,
			}),
			storageRebate: t.field({
				type: 'BigInt',
				nullable: true,
				resolve: (tx) => tx.storage_rebate,
			}),
		}),
	});

const GasInput = builder.objectRef<SuiGasData>('GasInput').implement({
	fields: (t) => ({
		gasSponsor: t.field({
			type: Address,
			nullable: true,
			resolve: (gasData) => gasData.owner,
		}),
		gasPayment: t.field({
			type: [ObjectRef],
			nullable: true,
			resolve: (gasData) => gasData.payment,
		}),
		gasPrice: t.field({
			type: 'BigInt',
			nullable: true,
			resolve: (gasData) => gasData.price,
		}),
		gasBudget: t.field({
			type: 'BigInt',
			nullable: true,
			resolve: (gasData) => gasData.budget,
		}),
	}),
});

const ProgrammableTransactionBlock = builder
	.objectRef<Extract<SuiTransactionBlockKind, { kind: 'ProgrammableTransaction' }>>(
		'ProgrammableTransactionBlock',
	)
	.implement({
		fields: (t) => ({
			inputs: t.field({
				type: [TransactionInput],
				resolve: (tx) => tx.inputs,
			}),
			transactions: t.field({
				type: [ProgrammableTransaction],
				resolve: (tx) => tx.transactions.map((tx) => mapSuiTransactions(tx)),
			}),
		}),
	});

const ConsensusCommitPrologueTransaction = builder
	.objectRef<Extract<SuiTransactionBlockKind, { kind: 'ConsensusCommitPrologue' }>>(
		'ConsensusCommitPrologueTransaction',
	)
	.implement({
		fields: (t) => ({
			epoch: t.field({
				type: Epoch,
				nullable: true,
				resolve: (tx) => tx.epoch,
			}),
			timestamp: t.field({
				type: 'DateTime',
				nullable: true,
				resolve: (tx) => new Date(tx.commit_timestamp_ms),
			}),
			round: t.field({
				type: 'BigInt',
				nullable: true,
				resolve: (tx) => tx.round,
			}),
		}),
	});

const TransactionBlockKind = builder.unionType('TransactionBlockKind', {
	types: [
		GenesisTransaction,
		ChangeEpochTransaction,
		ProgrammableTransactionBlock,
		ConsensusCommitPrologueTransaction,
	],
	resolveType: (kind) => {
		switch (kind.kind) {
			case 'Genesis':
				return GenesisTransaction;
			case 'ChangeEpoch':
				return ChangeEpochTransaction;
			case 'ProgrammableTransaction':
				return ProgrammableTransactionBlock;
			case 'ConsensusCommitPrologue':
				return ConsensusCommitPrologueTransaction;
			default:
				throw new Error(`Unknown TransactionBlockKind ${(kind as SuiTransactionBlockKind).kind}`);
		}
	},
});

const MoveCallTransaction = builder
	.objectRef<Extract<SuiTransaction, { MoveCall: unknown }>>('MoveCallTransaction')
	.implement({
		fields: (t) => ({
			function: t.field({
				type: NormalizedFunction,
				nullable: true,
				resolve: (tx) =>
					`${tx.MoveCall.package},${tx.MoveCall.module},${tx.MoveCall.function}` as const,
			}),
			typeArguments: t.field({
				type: [MoveType],
				nullable: true,
				resolve: (tx) => tx.MoveCall.type_arguments,
			}),
			arguments: t.field({
				type: [TransactionArgument],
				nullable: true,
				resolve: (tx) => tx.MoveCall.arguments?.map((arg) => mapTransactionArgument(arg)),
			}),
		}),
	});

const TransferObjectsTransaction = builder
	.objectRef<Extract<SuiTransaction, { TransferObjects: unknown }>>('TransferObjectsTransaction')
	.implement({
		fields: (t) => ({
			objects: t.field({
				type: [TransactionArgument],
				resolve: (tx) => tx.TransferObjects[0].map((arg) => mapTransactionArgument(arg)),
			}),
			address: t.field({
				type: TransactionArgument,
				resolve: (tx) => mapTransactionArgument(tx.TransferObjects[1]),
			}),
		}),
	});

const SplitCoinTransaction = builder
	.objectRef<Extract<SuiTransaction, { SplitCoins: unknown }>>('SplitCoinTransaction')
	.implement({
		fields: (t) => ({
			coin: t.field({
				type: TransactionArgument,
				resolve: (tx) => mapTransactionArgument(tx.SplitCoins[0]),
			}),
			amounts: t.field({
				type: [TransactionArgument],
				resolve: (tx) => tx.SplitCoins[1].map((arg) => mapTransactionArgument(arg)),
			}),
		}),
	});

const MergeCoinsTransaction = builder
	.objectRef<Extract<SuiTransaction, { MergeCoins: unknown }>>('MergeCoinsTransaction')
	.implement({
		fields: (t) => ({
			coin: t.field({
				type: TransactionArgument,
				resolve: (tx) => mapTransactionArgument(tx.MergeCoins[0]),
			}),
			coins: t.field({
				type: [TransactionArgument],
				resolve: (tx) => tx.MergeCoins[1].map((arg) => mapTransactionArgument(arg)),
			}),
		}),
	});

const PublishTransaction = builder
	.objectRef<Extract<SuiTransaction, { Publish: unknown }>>('PublishTransaction')
	.implement({
		fields: (t) => ({
			dependencies: t.field({
				type: [MovePackage],
				resolve: (tx) => tx.Publish,
			}),
		}),
	});

const UpgradeTransaction = builder
	.objectRef<Extract<SuiTransaction, { Upgrade: unknown }>>('UpgradeTransaction')
	.implement({
		fields: (t) => ({
			dependencies: t.field({
				type: [MovePackage],
				resolve: (tx) => tx.Upgrade[0],
			}),
			currentPackage: t.field({
				type: MovePackage,
				resolve: (tx) => tx.Upgrade[1],
			}),
			upgradeTicket: t.field({
				type: TransactionArgument,
				resolve: (tx) => mapTransactionArgument(tx.Upgrade[2]),
			}),
		}),
	});

const MakeMoveVecTransaction = builder
	.objectRef<Extract<SuiTransaction, { MakeMoveVec: unknown }>>('MakeMoveVecTransaction')
	.implement({
		fields: (t) => ({
			type: t.field({
				type: MoveType,
				nullable: true,
				resolve: (tx) => tx.MakeMoveVec[0],
			}),
			elements: t.field({
				type: [TransactionArgument],
				resolve: (tx) => tx.MakeMoveVec[1].map((arg) => mapTransactionArgument(arg)),
			}),
		}),
	});

const ProgrammableTransaction = builder.unionType('ProgrammableTransaction', {
	types: [
		MoveCallTransaction,
		TransferObjectsTransaction,
		SplitCoinTransaction,
		MergeCoinsTransaction,
		PublishTransaction,
		UpgradeTransaction,
		MakeMoveVecTransaction,
	],
});

const SharedInput = builder.simpleObject('SharedInput', {
	fields: (t) => ({
		id: t.field({ type: 'SuiAddress', nullable: true }),
		initialSharedVersion: t.field({ type: 'BigInt', nullable: true }),
		mutable: t.boolean({ nullable: true }),
	}),
});

const MoveType = builder.objectRef<string | ReturnType<typeof parseStructTag>>('MoveType');

MoveType.implement({
	fields: (t) => ({
		repr: t.string({
			resolve: (type) => normalizeStructTag(type),
		}),
		typeName: t.string({
			resolve: (type) => (typeof type === 'string' ? parseStructTag(type).name : type.name),
		}),
		typeParameters: t.field({
			type: [MoveType],
			resolve: (type) => {
				const { typeParams } = typeof type === 'string' ? parseStructTag(type) : type;
				return (Array.isArray(typeParams) ? typeParams : [typeParams]).map((param) =>
					typeof param === 'string' ? parseStructTag(param) : param,
				);
			},
		}),
	}),
});

const NormalizedFunction = builder.loadableNodeRef('NormalizedFunction', {
	id: {
		resolve: (fn) => fn.id,
	},
	load: async (keys: `${string},${string},${string}`[]) => {
		return Promise.all(
			keys.map(async (key) => {
				const [pkg, moduleName, fn] = key.split(',');

				const result = await suiClient.getNormalizedMoveFunction({
					package: pkg,
					module: moduleName,
					function: fn,
				});

				return {
					...result,
					id: key,
				};
			}),
		);
	},
});

NormalizedFunction.implement({
	fields: (t) => ({
		fileFormatVersion: t.int({
			nullable: true,
			resolve: (fn) => {
				// TODO
				return null;
			},
		}),
		moduleId: t.field({
			type: MoveModuleId,
			resolve: (fn) => ({ package: fn.id.split(',')[0], name: fn.id.split(',')[1] }),
		}),

		// moduleId: MoveModuleId!
		// friends: [MoveModuleId]

		// structsConnection(first: Int, after: String, last: Int, before: String): NormalizedStructConnection
		// struct(name: String!): NormalizedStruct

		// functionsConnection(first: Int, after: String, last: Int, before: String): NormalizedFunctionConnection
		// function(name: String!): NormalizedFunction
	}),
});

const MovePackage = builder.objectRef<string>('MovePackage');

MovePackage.implement({
	fields: (t) => ({
		module: t.field({
			type: MoveModule,
			nullable: true,
			args: {
				name: t.arg.string({
					required: true,
				}),
			},
			resolve: async (pkg, args) => {
				const result = await suiClient.getNormalizedMoveModule({
					package: pkg,
					module: args.name,
				});

				return result;
			},
		}),
		moduleConnection: t.connection({
			type: MoveModule,
			nullable: true,
			resolve: async (mod, args) => {
				return resolveArrayConnection(
					{ args },
					Object.values(
						await suiClient.getNormalizedMoveModulesByPackage({
							package: mod,
						}),
					),
				);
			},
		}),
		asObject: t.field({
			type: ObjectRef,
			nullable: true,
			resolve: (pkg) => pkg,
		}),
	}),
});

const MoveModule = builder.loadableNodeRef('MoveModule', {
	id: {
		resolve: (mod) => `${mod.address},${mod.name}`,
	},
	load: (keys: string[]) => {
		return Promise.all(
			keys.map(async (key) => {
				const result = await suiClient.getNormalizedMoveModule({
					package: key.split(',')[0],
					module: key.split(',')[1],
				});

				return result;
			}),
		);
	},
});

MoveModule.implement({
	fields: (t) => ({
		fileFormatVersion: t.exposeInt('fileFormatVersion', {
			nullable: true,
		}),
		moduleId: t.field({
			type: MoveModuleId,
			nullable: true,
			resolve: (mod) => {
				return { package: mod.address, name: mod.name };
			},
		}),
		friends: t.field({
			type: [MoveModuleId],
			nullable: { list: true, items: true },
			resolve: (mod) =>
				mod.friends.map((friend) => ({ package: friend.address, name: friend.name })),
		}),
		struct: t.field({
			type: MoveStructDecl,
			nullable: true,
			args: {
				name: t.arg.string({
					required: false,
				}),
			},
			resolve: (mod, args) => {
				return mod.structs[args.name!];
			},
		}),
		structConnection: t.connection({
			type: MoveStructDecl,
			nullable: true,
			resolve: (mod, args) => {
				return resolveArrayConnection({ args }, Object.values(mod.structs));
			},
		}),
		function: t.field({
			type: MoveFunction,
			nullable: true,
			args: {
				name: t.arg.string({
					required: false,
				}),
			},
			resolve: (mod, args) => {
				return mod.exposedFunctions[args.name!];
			},
		}),
		functionConnection: t.connection({
			type: MoveFunction,
			nullable: true,
			resolve: (mod, args) => {
				return resolveArrayConnection({ args }, Object.values(mod.exposedFunctions));
			},
		}),
		bytes: t.field({
			type: 'Base64',
			nullable: true,
			resolve: (mod) => {
				// TODO
				return null;
			},
		}),
		disassembly: t.string({
			nullable: true,
			resolve: (mod) => {
				// TODO
				return null;
			},
		}),
	}),
});

const TransactionBlockEffects = builder.objectRef<TransactionEffects>('TransactionBlockEffects');

TransactionBlockEffects.implement({
	fields: (t) => ({
		digest: t.string({
			nullable: true,
			resolve: (effects) => effects.transactionDigest,
		}),
		status: t.field({
			type: ExecutionStatus,
			nullable: true,
			resolve: (effects) => (effects.status.status === 'success' ? 'SUCCESS' : 'FAILURE'),
		}),
		errors: t.string({
			nullable: true,
			resolve: (effects) => {
				return effects.status.error;
			},
		}),
		transactionBlock: t.field({
			type: TransactionBlock,
			nullable: true,
			resolve: (effects) => effects.transactionDigest,
		}),
		dependencies: t.field({
			type: [TransactionBlock],
			nullable: { list: true, items: true },
			resolve: (effects) => effects.dependencies,
		}),
		lamportVersion: t.int({
			nullable: true,
			resolve: (effects) => {
				throw new Error('TODO');
			},
		}),
		gasEffects: t.field({
			type: GasEffects,
			nullable: true,
			resolve: (effects) => {
				return effects;
			},
		}),
		objectReads: t.field({
			type: [ObjectRef],
			nullable: { list: true, items: true },
			resolve: (effects) => {
				// TODO
				return [];
			},
		}),
		objectChanges: t.field({
			type: [ObjectChange],
			nullable: { list: true, items: true },
			resolve: (effects) => {
				// TODO
				return [];
			},
		}),
		balanceChanges: t.field({
			type: [BalanceChange],
			nullable: { list: true, items: true },
			resolve: (effects) => {
				// TODO
				return [];
			},
		}),
		epoch: t.field({
			type: Epoch,
			nullable: true,
			resolve: (effects) => {
				return effects.executedEpoch;
			},
		}),
		checkpoint: t.field({
			type: Checkpoint,
			nullable: true,
			resolve: (effects) => {
				// TODO
				return null;
			},
		}),
		eventConnection: t.connection({
			type: Event,
			nullable: true,
			resolve: (effects, args) => {
				// todo
				return null;
			},
		}),
		bcs: t.field({
			type: 'Base64',
			nullable: true,
			resolve: (effects) => {
				// todo
				return null;
			},
		}),
	}),
});
const ObjectRef = builder.loadableNode('Object', {
	id: {
		resolve: (obj) => obj.objectId,
	},
	load: async (keys: string[]) => {
		const result = (
			await suiClient.multiGetObjects({
				ids: keys,
			})
		).map((obj) => obj.data);

		return keys.map(
			(id) => result.find((obj) => obj?.objectId === id) ?? new Error(`Object ${id} not found`),
		);
	},
	fields: (t) => ({
		version: t.int({
			nullable: true,
			resolve: (obj) => Number.parseInt(obj.version, 10),
		}),
		digest: t.exposeString('digest', {
			nullable: true,
		}),
		owner: t.field({
			type: AmbiguousOwner,
			nullable: true,
			resolve: (obj) => obj.owner,
		}),
		previousTransactionBlock: t.field({
			type: TransactionBlock,
			nullable: true,
			resolve: (obj) => obj.previousTransaction,
		}),
		storageRebate: t.field({
			type: 'BigInt',
			nullable: true,
			resolve: (obj) => obj.storageRebate,
		}),
		display: t.field({
			type: [DisplayEntry],
			nullable: { list: true, items: false },
			resolve: (obj) =>
				obj.display?.data &&
				Object.entries(obj.display?.data).map(([key, value]) => ({ key, value })),
		}),
		asMoveObject: t.field({
			type: MoveObject,
			nullable: true,
			resolve: (obj) => obj.objectId,
		}),
		asMovePackage: t.field({
			type: MovePackage,
			nullable: true,
			resolve: (obj) => obj.objectId,
		}),
		receivedTransactionBlockConnection: t.connection({
			type: TransactionBlock,
			nullable: true,
			resolve: (obj, args) => {
				return resolveCursorConnection({ args, toCursor: (txb) => txb.digest }, async () => {
					const results = await suiClient.queryTransactionBlocks({
						filter: {
							ToAddress: obj.objectId,
						},
					});

					return results.data;
				});
			},
		}),
		dynamicField: t.field({
			type: DynamicField,
			nullable: true,
			args: {
				dynamicFieldName: t.arg({
					type: DynamicFieldName,
					required: false,
				}),
			},
			resolve: async (obj, args) => {
				const result = await suiClient.getDynamicFieldObject({
					parentId: obj.objectId,
					name: {
						type: args.dynamicFieldName!.type!,
						value: args.dynamicFieldName!.bcs,
					},
				});

				console.log('data', result.data);
				// todo

				return null;
			},
		}),
		dynamicFieldConnection: t.connection({
			type: DynamicField,
			nullable: true,
			args: {
				filter: t.arg({
					type: DynamicFieldFilter,
					required: false,
				}),
			},
			resolve: async (obj, args) => {
				const result = await suiClient.getDynamicFields({
					parentId: obj.objectId,
				});

				console.log('data', result.data);
				// todo

				return null;
			},
		}),
		bcs: t.field({
			type: 'Base64',
			nullable: true,
			resolve: () => {
				// todo
				return null;
			},
		}),
	}),
});

const MoveObject = builder.objectRef<unknown>('MoveObject');

MoveObject.implement({
	fields: (t) => ({
		contents: t.field({
			type: MoveValue,
			nullable: true,
			resolve: (obj) => {
				// todo
				return null;
			},
		}),
		hasPublicTransfer: t.boolean({
			nullable: true,
			resolve: (obj) => {
				// todo
				return null;
			},
		}),
		asCoin: t.field({
			type: Coin,
			nullable: true,
			resolve: (obj) => {
				// todo
				return null;
			},
		}),
		asStakedSui: t.field({
			type: StakedSui,
			nullable: true,
			resolve: (obj) => {
				// todo
				return null;
			},
		}),
		asObject: t.field({
			type: ObjectRef,
			nullable: true,
			resolve: (obj) => {
				// todo
				return null;
			},
		}),
	}),
});

const GasCoin = builder.objectRef('GasCoin').implement({
	fields: (t) => ({
		id: t.id({
			resolve: () => 'TODO',
		}),
	}),
});
const Input = builder.simpleObject('Input', {
	fields: (t) => ({
		ix: t.int({ nullable: true }),
	}),
});
const Result = builder.simpleObject('Result', {
	fields: (t) => ({
		cmd: t.int({ nullable: true }),
		ix: t.int({ nullable: true }),
	}),
});

const TransactionArgument = builder.unionType('TransactionArgument', {
	types: [GasCoin, Input, Result],
});

const TransactionInput = builder.unionType('TransactionInput', {
	types: [SharedInput, ObjectRef, MoveObject],
	resolveType: (input) => {
		throw new Error('TODO implement resolveType for TransactionInput');
	},
});

const MoveModuleId = builder.objectRef<{ package: string; name: string }>('MoveModuleId');
MoveModuleId.implement({
	fields: (t) => ({
		package: t.field({
			type: MovePackage,
			resolve: (moduleId) => moduleId.package,
		}),
		name: t.string({
			resolve: (moduleId) => moduleId.name,
		}),
	}),
});

function mapTransactionArgument(arg: SuiArgument) {
	if (arg === 'GasCoin') {
		return {
			__typename: 'GasCoin',
		};
	}

	if ('Input' in arg) {
		return {
			__typename: 'Input',
			ix: arg.Input,
		};
	}

	if ('Result' in arg) {
		return {
			__typename: 'Result',
			ix: arg.Result,
			cmd: null,
		};
	}

	if ('NestedResult' in arg) {
		return {
			__typename: 'Result',
			ix: arg.NestedResult[0],
			cmd: arg.NestedResult[1],
		};
	}

	throw new Error(`Unknown argument type ${JSON.stringify(arg)}`);
}

function mapSuiTransactions(tx: SuiTransaction) {
	if ('MoveCall' in tx) {
		return {
			__typename: 'MoveCallTransaction' as const,
			...tx,
		};
	}

	if ('TransferObjects' in tx) {
		return {
			__typename: 'TransferObjectsTransaction' as const,
			...tx,
		};
	}

	if ('SplitCoins' in tx) {
		return {
			__typename: 'SplitCoinTransaction' as const,
			...tx,
		};
	}

	if ('MergeCoins' in tx) {
		return {
			__typename: 'MergeCoinsTransaction' as const,
			...tx,
		};
	}

	if ('Publish' in tx) {
		return {
			__typename: 'PublishTransaction' as const,
			...tx,
		};
	}

	if ('Upgrade' in tx) {
		return {
			__typename: 'UpgradeTransaction' as const,
			...tx,
		};
	}

	if ('MakeMoveVec' in tx) {
		return {
			__typename: 'MakeMoveVecTransaction' as const,
			...tx,
		};
	}

	throw new Error(`Unknown transaction type ${JSON.stringify(tx)}`);
}

const AvailableRange = builder.simpleObject('AvailableRange', {
	fields: (t) => ({
		first: t.field({
			type: Checkpoint,
			nullable: true,
		}),
		last: t.field({
			type: Checkpoint,
			nullable: true,
		}),
	}),
});
const Owner = builder.interfaceRef<string>('Owner');

Owner.implement({
	fields: (t) => ({
		location: t.field({
			type: 'SuiAddress',
			nullable: true,
			resolve: (owner) => owner,
		}),
		objectConnection: t.connection({
			type: ObjectRef,
			nullable: true,
			args: {
				filter: t.arg({
					type: ObjectFilter,
					required: false,
				}),
			},
			resolve: (owner, args) => {
				return resolveCursorConnection({ args, toCursor: (obj) => obj.objectId }, async () => {
					const results = await suiClient.getOwnedObjects({
						owner,
					});

					return results.data.map((obj) => obj.data!);
				});
			},
		}),
		balance: t.field({
			type: Balance,
			nullable: true,
			args: {
				type: t.arg.string({
					required: false,
				}),
			},
			resolve: (owner, args) => {
				return suiClient.getBalance({
					owner,
					coinType: args.type,
				});
			},
		}),
		balanceConnection: t.connection({
			type: Balance,
			nullable: true,
			resolve: (owner, args) => {
				return resolveCursorConnection({ args, toCursor: (obj) => obj.coinType }, async () => {
					const results = await suiClient.getAllBalances({
						owner,
					});

					return results;
				});
			},
		}),
		coinConnection: t.connection({
			type: Coin,
			nullable: true,
			args: {
				type: t.arg.string({
					required: false,
				}),
			},
			resolve: (owner, args) => {
				return resolveCursorConnection({ args, toCursor: (obj) => obj.id }, async () => {
					const results = await suiClient.getCoins({
						owner,
						coinType: args.type,
					});

					return results.data.map((coin) => ({ id: coin.coinObjectId }));
				});
			},
		}),
		stakeConnection: t.connection({
			type: StakedSui,
			nullable: true,
			resolve: async (owner, args) => {
				const results = await suiClient.getStakes({
					owner,
				});
				const stakes = results.flatMap((stake) =>
					stake.stakes.map((stake) => ({
						status: stake.status.toUpperCase() as Uppercase<typeof stake.status>,
						requestEpoch: stake.stakeRequestEpoch,
						activeEpoch: stake.stakeActiveEpoch,
						principal: stake.principal,
						estimatedReward: 0,
						asMoveObject: stake.stakedSuiId,
					})),
				);
				return resolveArrayConnection({ args }, stakes);
			},
		}),
		defaultNameServiceName: t.string({
			nullable: true,
		}),
	}),
});
const AmbiguousOwner = builder.objectRef<unknown>('AmbiguousOwner');

AmbiguousOwner.implement({
	interfaces: [Owner as never],
	fields: (t) => ({}),
});

const AddressTransactionBlockRelationship = builder.enumType(
	'AddressTransactionBlockRelationship',
	{
		values: {
			SIGN: {
				value: 'SIGN',
			},
			SENT: {
				value: 'SENT',
			},
			RECV: {
				value: 'RECV',
			},
			PAID: {
				value: 'PAID',
			},
		},
	} as const,
);

const DisplayEntry = builder.simpleObject('DisplayEntry', {
	fields: (t) => ({
		key: t.string({
			nullable: true,
		}),
		value: t.string({
			nullable: true,
		}),
	}),
});

const ProtocolConfig = builder.simpleObject('ProtocolConfig', {
	fields: (t) => ({
		key: t.string({
			nullable: true,
		}),
		value: t.string({
			nullable: true,
		}),
	}),
});

const ExecutionStatus = builder.enumType('ExecutionStatus', {
	values: {
		SUCCESS: {
			value: 'SUCCESS',
		},
		FAILURE: {
			value: 'FAILURE',
		},
	},
} as const);

const GasEffects = builder.objectRef<TransactionEffects>('GasEffects').implement({
	fields: (t) => ({
		gasObject: t.field({
			type: Coin,
			nullable: true,
			resolve: (effects) => {
				return { id: effects.gasObject.reference.objectId };
			},
		}),
		gasSummary: t.field({
			type: GasCostSummary,
			nullable: true,
			resolve: (effects) => {
				return effects.gasUsed;
			},
		}),
	}),
});

const ObjectChange = builder.simpleObject('ObjectChange', {
	fields: (t) => ({
		inputState: t.field({
			type: ObjectRef,
			nullable: true,
		}),
		outputState: t.field({
			type: ObjectRef,
			nullable: true,
		}),
		idCreated: t.boolean({
			nullable: true,
		}),
		idDeleted: t.boolean({
			nullable: true,
		}),
	}),
});
const BalanceChange = builder.simpleObject('BalanceChange', {
	fields: (t) => ({
		owner: t.field({
			type: Owner,
			nullable: true,
		}),
		coinType: t.field({
			type: MoveType,
			nullable: true,
		}),
		amount: t.field({
			type: 'BigInt',
			nullable: true,
		}),
	}),
});
const Event = builder.objectRef<SuiEvent>('Event');

Event.implement({
	fields: (t) => ({
		id: t.id({
			nullable: true,
			resolve: (event) => {
				throw new Error('TODO');
			},
		}),
		sendingModuleId: t.field({
			type: MoveModuleId,
			nullable: true,
			resolve: (event) => {
				throw new Error('TODO');
			},
		}),
		eventType: t.field({
			type: MoveType,
			nullable: true,
			resolve: (event) => event.type,
		}),
		sender: t.field({
			type: Address,
			nullable: true,
			resolve: (event) => event.sender,
		}),
		timestamp: t.field({
			type: 'DateTime',
			nullable: true,
			resolve: (event) => event.timestampMs,
		}),
		json: t.string({
			nullable: true,
			resolve: (event) => event.timestampMs,
		}),
		bcs: t.field({
			type: 'Base64',
			nullable: true,
			resolve: (event) => event.bcs,
		}),
	}),
});

const Balance = builder.simpleObject('Balance', {
	fields: (t) => ({
		id: t.id({
			nullable: true,
		}),
		coinType: t.field({
			type: MoveType,
			nullable: true,
		}),
		coinObjectCount: t.int({
			nullable: true,
		}),
		totalBalance: t.field({
			type: 'BigInt',
			nullable: true,
		}),
	}),
});

const Coin = builder.simpleObject('Coin', {
	fields: (t) => ({
		id: t.id({
			nullable: true,
		}),
	}),
});

builder.objectFields(Coin, (t) => ({
	asMoveObject: t.field({
		type: MoveObject,
		nullable: true,
		resolve: (coin) => (coin.id !== null ? String(coin.id) : null),
	}),
	balance: t.field({
		type: 'BigInt',
		nullable: true,
		resolve: () => {
			// TODO
			return null;
		},
	}),
}));

const StakedSui = builder.simpleObject('StakedSui', {
	fields: (t) => ({
		status: t.field({
			type: StakeStatus,
			nullable: true,
		}),
		requestEpoch: t.field({
			type: Epoch,
			nullable: true,
		}),
		activeEpoch: t.field({
			type: Epoch,
			nullable: true,
		}),
		principal: t.field({
			type: 'BigInt',
			nullable: true,
		}),
		estimatedReward: t.field({
			type: 'BigInt',
			nullable: true,
		}),
		asMoveObject: t.field({
			type: MoveObject,
			nullable: true,
		}),
	}),
});
const StakeStatus = builder.enumType('StakeStatus', {
	values: {
		PENDING: {
			value: 'PENDING',
		},
		ACTIVE: {
			value: 'ACTIVE',
		},
		UNSTAKED: {
			value: 'UNSTAKED',
		},
	},
} as const);
const CoinMetadata = builder.simpleObject('CoinMetadata', {
	fields: (t) => ({
		decimals: t.int({
			nullable: true,
		}),
		name: t.string({
			nullable: true,
		}),
		symbol: t.string({
			nullable: true,
		}),
		description: t.string({
			nullable: true,
		}),
		iconURL: t.string({
			nullable: true,
		}),
		supply: t.field({
			type: 'BigInt',
			nullable: true,
		}),
		asMoveObject: t.field({
			type: MoveObject,
			nullable: true,
		}),
	}),
});
const DynamicFieldName = builder.inputType('DynamicFieldName', {
	fields: (t) => ({
		type: t.string({
			required: false,
		}),
		bcs: t.field({
			type: 'Base64',
			required: false,
		}),
	}),
});
const DynamicField = builder.simpleObject('DynamicField', {
	fields: (t) => ({
		id: t.id({
			nullable: true,
		}),
		name: t.field({
			type: MoveValue,
			nullable: true,
		}),
		value: t.field({
			type: DynamicFieldValue,
			nullable: true,
		}),
	}),
});

const MoveAbility = builder.enumType('MoveAbility', {
	values: {
		COPY: {
			value: 'COPY',
		},
		DROP: {
			value: 'DROP',
		},
		STORE: {
			value: 'STORE',
		},
		KEY: {
			value: 'KEY',
		},
	},
} as const);
const MoveVisibility = builder.enumType('MoveVisibility', {
	values: {
		PUBLIC: {
			value: 'PUBLIC',
		},
		PRIVATE: {
			value: 'PRIVATE',
		},
		FRIEND: {
			value: 'FRIEND',
		},
	},
} as const);
const MoveReference = builder.enumType('MoveReference', {
	values: {
		IMMUT: {
			value: 'IMMUT',
		},
		MUT: {
			value: 'MUT',
		},
	},
} as const);
const MoveStructTypeParameterDecl = builder.simpleObject('MoveStructTypeParameterDecl', {
	fields: (t) => ({
		constraints: t.field({
			type: [MoveAbility],
			nullable: { list: true, items: true },
		}),
		isPhantom: t.boolean({
			nullable: true,
		}),
	}),
});
const MoveFunctionTypeParameterDecl = builder.simpleObject('MoveFunctionTypeParameterDecl', {
	fields: (t) => ({
		constraints: t.field({
			type: [MoveAbility],
			nullable: { list: true, items: true },
		}),
	}),
});

const MoveStructDecl = builder.objectRef<unknown>('MoveStructDecl');

MoveStructDecl.implement({
	fields: (t) => ({
		id: t.id({
			nullable: true,
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		module: t.field({
			type: MoveModule,
			nullable: true,
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		name: t.string({
			nullable: true,
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		abilities: t.field({
			type: [MoveAbility],
			nullable: { list: true, items: true },
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		typeParameters: t.field({
			type: [MoveStructTypeParameterDecl],
			nullable: { list: true, items: true },
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		fields: t.field({
			type: [MoveFieldDecl],
			nullable: { list: true, items: true },
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
	}),
});

const MoveFieldDecl = builder.simpleObject('MoveFieldDecl', {
	fields: (t) => ({
		name: t.string({
			nullable: true,
		}),
		type: t.field({
			type: OpenMoveType,
			nullable: true,
		}),
	}),
});
const MoveFunction = builder.objectRef<unknown>('MoveFunction');
MoveFunction.implement({
	fields: (t) => ({
		id: t.id({
			nullable: true,
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		module: t.field({
			type: MoveModule,
			nullable: true,
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		name: t.string({
			nullable: true,
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		visibility: t.field({
			type: MoveVisibility,
			nullable: true,
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		isEntry: t.boolean({
			nullable: true,
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		typeParameters: t.field({
			type: [MoveFunctionTypeParameterDecl],
			nullable: { list: true, items: true },
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		parameters: t.field({
			type: [OpenMoveType],
			nullable: { list: true, items: true },
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		return: t.field({
			type: [OpenMoveType],
			nullable: { list: true, items: true },
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
	}),
});
const MoveValue = builder.objectRef<unknown>('MoveValue');

MoveValue.implement({
	fields: (t) => ({
		type: t.field({
			type: MoveType,
			nullable: true,
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		data: t.field({
			type: MoveData,
			nullable: true,
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
		bcs: t.field({
			type: 'Base64',
			nullable: true,
			resolve: (value) => {
				throw new Error('TODO');
			},
		}),
	}),
});

const DynamicFieldValue = builder.unionType('DynamicFieldValue', {
	types: [MoveObject, MoveValue],
});

const MoveNumber = builder.simpleObject('MoveNumber', {
	fields: (t) => ({
		number: t.string({
			nullable: true,
		}),
	}),
});
const MoveBool = builder.simpleObject('MoveBool', {
	fields: (t) => ({
		bool: t.boolean({
			nullable: true,
		}),
	}),
});
const MoveAddress = builder.simpleObject('MoveAddress', {
	fields: (t) => ({
		address: t.field({
			type: 'SuiAddress',
			nullable: true,
		}),
	}),
});
const MoveUID = builder.simpleObject('MoveUID', {
	fields: (t) => ({
		uid: t.field({
			type: 'SuiAddress',
			nullable: true,
		}),
	}),
});
const MoveString = builder.simpleObject('MoveString', {
	fields: (t) => ({
		string: t.string({
			nullable: true,
		}),
	}),
});
const MoveVector = builder.simpleObject('MoveVector', {
	fields: (t) => ({
		elements: t.field({
			type: [MoveValue],
			nullable: { list: true, items: false },
		}),
	}),
});
const MoveOption = builder.simpleObject('MoveOption', {
	fields: (t) => ({
		element: t.field({
			type: MoveValue,
			nullable: true,
		}),
	}),
});
const MoveStruct = builder.simpleObject('MoveStruct', {
	fields: (t) => ({
		fields: t.field({
			type: [MoveField],
			nullable: { list: true, items: false },
		}),
	}),
});

const MoveData = builder.unionType('MoveData', {
	types: [
		MoveNumber,
		MoveAddress,
		MoveUID,
		MoveString,
		MoveVector,
		MoveOption,
		MoveStruct,
		MoveBool,
	],
});

const MoveField = builder.simpleObject('MoveField', {
	fields: (t) => ({
		name: t.string({
			nullable: true,
		}),
		value: t.field({
			type: MoveValue,
			nullable: true,
		}),
	}),
});
const MoveTypeName = builder.simpleObject('MoveTypeName', {
	fields: (t) => ({
		moduleId: t.field({
			type: MoveModuleId,
			nullable: true,
		}),
		name: t.string({
			nullable: true,
		}),
		struct: t.field({
			type: MoveStructDecl,
			nullable: true,
		}),
	}),
});

const OpenMoveType = builder.simpleObject('OpenMoveType', {
	fields: (t) => ({
		repr: t.string({
			nullable: true,
		}),
		ref: t.field({
			type: MoveReference,
			nullable: true,
		}),
		type: t.field({
			type: OpenMoveTypeBody,
			nullable: true,
		}),
	}),
});

const MoveTypeApplication = builder.objectRef<unknown>('MoveTypeApplication');

MoveTypeApplication.implement({
	fields: (t) => ({
		name: t.field({
			type: MoveTypeName,
			nullable: true,
			resolve: () => {
				throw new Error('TODO');
			},
		}),
		typeParameters: t.field({
			type: [OpenMoveType],
			nullable: { list: true, items: true },
			resolve: () => {
				throw new Error('TODO');
			},
		}),
	}),
});

const MoveTypeParameter = builder.simpleObject('MoveTypeParameter', {
	fields: (t) => ({
		index: t.int({
			nullable: true,
		}),
	}),
});

const OpenMoveTypeBody = builder.unionType('OpenMoveTypeBody', {
	types: [MoveTypeApplication, MoveTypeParameter],
});

export const schema = builder.toSchema({});
