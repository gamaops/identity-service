require('dotenv-defaults').config();

import {
	buildConsumers,
	configureDefaultMetrics,
	connectMongoose,
	createBackendRuntime,
	createMetricsServer,
	createWorkerPools,
	enableBackendRuntimeMetrics,
	loadProtosDefinitions,
	logger,
} from '@gamaops/backend-framework';
import { ConnectionManager } from 'hfxbus';
import mongoose from 'mongoose';
import { URL } from 'url';
import {
	IProcessorConsumers,
	IProcessorFunctions,
	IProcessorParameters,
	IProcessorPools,
} from './interfaces';
import addProcessors from './processors';

configureDefaultMetrics({
	serviceName: process.env.APP_NAME,
});

const metricsUrl = new URL(process.env.METRICS_SERVER_URI!);
const metrics = createMetricsServer({
	host: metricsUrl.hostname,
	port: parseInt(metricsUrl.port),
});

if (process.env.ENABLE_BACKEND_RUNTIME_METRICS === 'true') {
	enableBackendRuntimeMetrics();
}

const execute = async () => {

	metrics.health.set(1);

	logger.info('Loading app');

	const redisUrl = new URL(process.env.REDIS_URI!);

	logger.debug(process.env, 'Loaded environment variables');

	logger.info('Loading protos');

	const protos = loadProtosDefinitions([
		'identity/proto/v1.proto',
		'commons/proto/v1.proto',
	]);

	logger.info('Protos loaded');

	logger.info('Loading worker pools');

	const pools = createWorkerPools<IProcessorPools>(
		__dirname,
		{
			cryptography: {
				script: 'workers/cryptography.js',
			},
		},
	);

	logger.info('Worker pools loaded');

	await connectMongoose(process.env.MONGODB_URI!, mongoose);

	logger.info('Mongoose ready');

	const busConnection = ConnectionManager.standalone({
		host: redisUrl.hostname,
		port: parseInt(redisUrl.port),
	});

	const consumers = buildConsumers<IProcessorConsumers>(busConnection, {
		identity: {
			group: 'IdentityService',
		},
	});

	const runtime = createBackendRuntime<IProcessorParameters, IProcessorFunctions>({
		protos,
		mongoose,
		consumers,
		logger,
		pools,
	});

	addProcessors(runtime);

	await consumers.identity.play();

	logger.info('Consumer ready');

	metrics.health.set(2);
	metrics.up.set(1);

	process.once('SIGTERM', async () => {

		metrics.health.set(1);

		try {
			await consumers.identity.pause(parseInt(process.env.CONSUMER_PAUSE_TIMEOUT!));
			logger.warn('Identity consumer stopped');
		} catch (error) {
			logger.error({error}, 'Identity consumer pause error');
		}

		try {
			await busConnection.stop({
				maxWait: parseInt(process.env.REDIS_STOP_TIMEOUT!),
			});
			logger.warn('Bus connection (redis) stopped');
		} catch (error) {
			logger.error({error}, 'Bus connection (redis) stop error');
		}

		try {
			await pools.cryptography.drain();
			await pools.cryptography.clear();
			logger.warn('Cryptography worker pool drained');
		} catch (error) {
			logger.error({error}, 'Error while draining cryptography worker pool');
		}

		try {
			await mongoose.disconnect();
			logger.warn('Mongoose disconnected');
		} catch (error) {
			logger.error({error}, 'Error while disconnecting mongoose');
		}

		metrics.up.set(0);

		try {
			metrics.close();
			logger.warn('Metrics server closed');
		} catch (error) {
			logger.error({error}, 'Error while closing metrics server');
		}

	});

};

execute().then(() => {
	logger.info('App started');
}).catch((error) => {
	logger.fatal({error});
});
