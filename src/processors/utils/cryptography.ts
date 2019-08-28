import Logger from 'bunyan';
import crypto from 'crypto';
import { ITask } from 'hfxworker';
import * as jsonwebtoken from 'jsonwebtoken';
import {
	Counter,
} from 'prom-client';
import { ServiceRuntime } from '../../interfaces';
import * as metrics from '../metrics';

export interface IGenerateValidationCodeContext extends ServiceRuntime {
	logger: Logger;
	callsCounter: Counter;
	hashString(task: ITask): Promise<ITask>;
}

export async function generateValidationCode(
	this: IGenerateValidationCodeContext,
	signUpId: string,
): Promise<string> {

	this.callsCounter.inc({ function: 'generateValidationCode' });

	const validationCode = crypto.randomBytes(3).toString('hex').toUpperCase();

	this.logger.debug({validationCode, signUpId}, 'Generated new validation code');

	const hashStringResult = await this.hashString({
		releaseBefore: true,
		data: {
			string: validationCode,
		},
	});

	return hashStringResult.data!.hash;

}

export interface IValidateHashContext extends ServiceRuntime {
	callsCounter: Counter;
	validateBcryptHash(task: ITask): Promise<ITask>;
}

export async function validateHash(
	this: IValidateHashContext,
	plain: string,
	hash: string,
): Promise<boolean> {

	this.callsCounter.inc({ function: 'validateHash' });

	const result = await this.validateBcryptHash({
		releaseBefore: true,
		data: {
			plain,
			hash,
		},
	});

	return result.data!.isValid;

}

export interface ISignJwtContext extends ServiceRuntime {
	callsCounter: Counter;
	signJwt(task: ITask): Promise<ITask>;
}

export async function signJwt(
	this: ISignJwtContext,
	payload: any,
	key: string,
	options: jsonwebtoken.SignOptions,
): Promise<string> {

	this.callsCounter.inc({ function: 'signJwt' });

	const result = await this.signJwt({
		releaseBefore: true,
		data: {
			payload,
			key,
			options,
		},
	});

	return result.data!.token;

}

export default (runtime: ServiceRuntime) => {

	const {
		logger,
		pools,
	} = runtime.params();

	const callsCounter = metrics.cryptographyCallsCount;

	runtime.contextify(
		generateValidationCode,
		{
			logger: logger.child({function: 'generateValidationCode' }),
			hashString: pools.cryptography.getMethod('hashString'),
			callsCounter,
		},
	);

	runtime.contextify(
		validateHash,
		{
			logger: logger.child({function: 'validateHash' }),
			validateBcryptHash: pools.cryptography.getMethod('validateBcryptHash'),
			callsCounter,
		},
	);

	runtime.contextify(
		signJwt,
		{
			logger: logger.child({function: 'signJwt' }),
			signJwt: pools.cryptography.getMethod('signJwt'),
			callsCounter,
		},
	);

};
