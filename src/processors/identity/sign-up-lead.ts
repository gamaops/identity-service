import {
	getJobOperationDate,
	JobOperation,
	parseObjectToProtobuf,
	parseProtobufToObject,
	removeEmptyKeys,
} from '@gamaops/backend-framework';
import { ISignUpLead, ISignUpLeadRequest } from '@gamaops/definitions/identity/types/v1';
import Logger from 'bunyan';
import { Job } from 'hfxbus';
import {
	Counter,
} from 'prom-client';
import { Type } from 'protobufjs';
import uuidv4 from 'uuid/v4';
import { ServiceRuntime } from '../../interfaces';
import { SignUpModel } from '../../models';
import * as metrics from '../metrics';

export interface IPushJobSignUpLeadContext extends ServiceRuntime {
	signUpLeadType: Type;
}

export async function pushJobSignUpLead(
	this: IPushJobSignUpLeadContext,
	job: Job,
	signUpLead: ISignUpLead,
) {

	const leadBuffer = parseObjectToProtobuf(
		signUpLead,
		this.signUpLeadType,
	);

	await job
		.set('signUpLead', leadBuffer)
		.push();
}

export interface ISignUpLeadContext extends ServiceRuntime {
	signUpLeadRequestType: Type;
	logger: Logger;
	callsCounter: Counter;
}

export async function signUpLead(
	this: ISignUpLeadContext,
	job: Job,
) {

	this.callsCounter.inc({function: 'signUpLead'});

	const tracing = {
		jobs: [
			{
				id: job.id,
				stream: 'SignUpLead',
				groups: [
					'IdentityService',
				],
				role: 'consumer',
			},
		],
	};

	this.logger.info(tracing, 'Received new job');

	const {
		generateValidationCode,
		pushJobSignUpLead,
	} = this.fncs();

	const {
		request,
	} = await job.get('request', true).del('request').pull();

	const createLeadRequest = parseProtobufToObject<ISignUpLeadRequest>(
		request,
		this.signUpLeadRequestType,
	);

	this.logger.debug({...tracing, createLeadRequest}, 'Create lead request');

	let { signUpLead } = createLeadRequest;

	removeEmptyKeys(signUpLead);

	if (signUpLead.signUpId) {
		const { signUpId } = signUpLead;
		this.logger.debug({...tracing, signUpId}, 'Lead will be updated');
		const updatedData = getJobOperationDate(job, JobOperation.UPDATE);

		Object.assign(
			signUpLead,
			updatedData,
		);

		const query = SignUpModel.updateOne(
			{
				_id: signUpId,
			},
			{
				$set: {
					validationCode: await generateValidationCode(signUpId),
					...updatedData,
				},
			},
		);

		await query.exec();

		this.logger.debug({...tracing, signUpId}, 'Lead updated');

		signUpLead.updatedAt = (signUpLead.updatedAt as Date).toISOString();
		await pushJobSignUpLead(job, signUpLead);
		return;
	}

	signUpLead = {
		...signUpLead,
		...getJobOperationDate(job, JobOperation.CREATE),
	};

	const signUpModel = new SignUpModel(signUpLead);
	const signUpId = uuidv4();

	signUpLead.signUpId = signUpId;
	signUpModel._id = signUpLead.signUpId;
	signUpModel.validationCode = await generateValidationCode(signUpId);

	await signUpModel.save();

	this.logger.info({...tracing, signUpId}, 'Lead saved');

	signUpLead.createdAt = (signUpLead.createdAt as Date).toISOString();

	await pushJobSignUpLead(job, signUpLead);
}

export default (runtime: ServiceRuntime) => {

	const {
		logger,
		protos,
		consumers,
	} = runtime.params();

	const callsCounter = metrics.identityCallsCounter;
	const signUpLeadRequestType = protos.lookupType('identity.v1.SignUpLeadRequest');
	const signUpLeadType = protos.lookupType('identity.v1.SignUpLead');

	runtime.contextify(
		pushJobSignUpLead,
		{
			logger: logger.child({function: 'pushJobSignUpLead' }),
			signUpLeadType,
		},
		{
			logErrors: 'async',
		},
	);

	runtime.contextify(
		signUpLead,
		{
			logger: logger.child({function: 'signUpLead' }),
			signUpLeadRequestType,
			callsCounter,
		},
		{
			logErrors: 'async',
		},
	);

	consumers.identity.process({
		stream: 'SignUpLead',
		processor: runtime.fncs().signUpLead,
	});

};
