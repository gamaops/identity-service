import { IBackendRuntime } from '@gamaops/backend-framework';
import { IOperationsDates } from '@gamaops/definitions/commons/types/v1';
import { ISignUpLead, IValidateSignUpResponse } from '@gamaops/definitions/identity/types/v1';
import Logger from 'bunyan';
import { Consumer, Job } from 'hfxbus';
import { IActiveScriptPool } from 'hfxworker';
import { SignOptions } from 'jsonwebtoken';
import { Mongoose } from 'mongoose';
import { Root } from 'protobufjs';

export interface IProcessorPools {
	cryptography: IActiveScriptPool;
}

export interface IProcessorConsumers {
	identity: Consumer;
}

export interface IProcessorParameters {
	mongoose: Mongoose;
	consumers: IProcessorConsumers;
	logger: Logger;
	protos: Root;
	pools: IProcessorPools;
}

export interface IProcessorFunctions {
	pushJobValidateSignUpResponse(
		job: Job,
		response: IValidateSignUpResponse,
		operationsDates?: IOperationsDates,
	): Promise<void>;
	pushJobSignUpLead(
		job: Job,
		signUpLead: ISignUpLead,
	): Promise<void>;
	signUpLead(
		job: Job,
	): Promise<void>;
	signJwt(
		payload: any,
		key: string,
		options: SignOptions,
	): Promise<string>;
	validateHash(
		plain: string,
		hash: string,
	): Promise<boolean>;
	generateValidationCode(
		signUpId: string,
	): Promise<string>;
	validateSignUp(
		job: Job,
	): Promise<void>;
}

export type ServiceRuntime = IBackendRuntime<IProcessorParameters, IProcessorFunctions>;
