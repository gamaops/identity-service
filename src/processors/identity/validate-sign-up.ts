import {
	getJobOperationDate,
	JobOperation,
	parseObjectToProtobuf,
	parseProtobufToObject,
} from '@gamaops/backend-framework';
import { IOperationsDates } from '@gamaops/definitions/commons/types/v1';
import { IValidateSignUpRequest, IValidateSignUpResponse } from '@gamaops/definitions/identity/types/v1';
import Logger from 'bunyan';
import { Job } from 'hfxbus';
import {
	Counter,
} from 'prom-client';
import { Type } from 'protobufjs';
import { ServiceRuntime } from '../../interfaces';
import { SignUpModel } from '../../models';
import * as metrics from '../metrics';
import {
	signUpIdentityTokenOptions,
} from '../utils/credentials';

export interface IPushJobValidateSignUpResponseContext extends ServiceRuntime {
	validateSignUpResponseType: Type;
	operationsDatesTypes: Type;
}

export async function pushJobValidateSignUpResponse(
	this: IPushJobValidateSignUpResponseContext,
	job: Job,
	response: IValidateSignUpResponse,
	operationsDates?: IOperationsDates,
) {
	const responseBuffer =  parseObjectToProtobuf(
		response,
		this.validateSignUpResponseType,
	);

	job.set('validateSignUpResponse', responseBuffer);

	if (operationsDates) {
		const operationsDatesBuffer =  parseObjectToProtobuf(
			operationsDates,
			this.operationsDatesTypes,
		);
		job.set('signUpOperationDate', operationsDatesBuffer);
	}

	await job.push();
}

export interface IValidateSignUpContext extends ServiceRuntime {
	validateSignUpRequestType: Type;
	logger: Logger;
	callsCounter: Counter;
}

export async function validateSignUp(
	this: IValidateSignUpContext,
	job: Job,
) {

	this.callsCounter.inc({function: 'validateSignUp'});

	const {
		validateHash,
		signJwt,
		pushJobValidateSignUpResponse,
	} = this.fncs();

	const tracing = {
		jobs: [
			{
				id: job.id,
				stream: 'ValidateSignUp',
				groups: [
					'IdentityService',
				],
				role: 'consumer',
			},
		],
	};

	this.logger.info(tracing, 'Received new job');

	const {
		request,
	} = await job.get('request', true).del('request').pull();

	const validateSignUpRequest = parseProtobufToObject<IValidateSignUpRequest>(
		request,
		this.validateSignUpRequestType,
	);

	this.logger.debug({...tracing, validateSignUpRequest}, 'Validate sign up request');

	const { signUpId, validationCode } = validateSignUpRequest;

	let query = SignUpModel.findById(signUpId, {
		validationCode: 1,
		name: 1,
	});

	const signUp = await query.exec();

	if (signUp === null || signUp.validationCode === null) {
		this.logger.debug({...tracing, signUp}, 'Sign up not found or validation code is null');
		await pushJobValidateSignUpResponse(job, {success: false});
		return;
	}

	const isValidCode = await validateHash(validationCode, signUp.validationCode);

	if (!isValidCode) {
		this.logger.debug({...tracing, signUp}, 'Invalid validation code');
		await pushJobValidateSignUpResponse(job, {success: false});
		return;
	}

	this.logger.debug({...tracing, signUpId}, 'Sign up is valid and validation code will be removed');

	const updatedData: IOperationsDates = getJobOperationDate(job, JobOperation.UPDATE);

	query = SignUpModel.updateOne(
		{
			_id: signUpId,
		},
		{
			$set: {
				validationCode: null,
				...updatedData,
			},
		},
	);

	await query.exec();

	updatedData.updatedAt = (updatedData.updatedAt as Date).toISOString();

	const identityToken = await signJwt(
		{
			name: signUp.name,
		},
		'SIGN_UP',
		{
			...signUpIdentityTokenOptions,
			subject: validateSignUpRequest.signUpId,
		},
	);

	this.logger.debug({...tracing, signUpId}, 'Identity token generated for sign up');

	await pushJobValidateSignUpResponse(job, {success: true, identityToken}, updatedData);

}

export default (runtime: ServiceRuntime) => {

	const {
		logger,
		protos,
		consumers,
	} = runtime.params();

	const callsCounter = metrics.identityCallsCounter;
	const validateSignUpRequestType = protos.lookupType('identity.v1.ValidateSignUpRequest');
	const validateSignUpResponseType = protos.lookupType('identity.v1.ValidateSignUpResponse');
	const operationsDatesTypes = protos.lookupType('commons.v1.OperationsDates');

	runtime.contextify(
		pushJobValidateSignUpResponse,
		{
			logger: logger.child({function: 'pushJobValidateSignUpResponse' }),
			validateSignUpResponseType,
			operationsDatesTypes,
		},
		{
			logErrors: 'async',
		},
	);

	runtime.contextify(
		validateSignUp,
		{
			logger: logger.child({function: 'validateSignUp' }),
			validateSignUpRequestType,
			callsCounter,
		},
		{
			logErrors: 'async',
		},
	);

	consumers.identity.process({
		stream: 'ValidateSignUp',
		processor: runtime.fncs().validateSignUp,
	});

};
