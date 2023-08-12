// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';
import { schema } from './schema';

const yoga = createYoga({
	context: () => ({}),
	schema,
	maskedErrors: false,
});

const server = createServer(yoga);

server.listen(3000, () => {
	console.log('Visit http://localhost:3000/graphql');
});
