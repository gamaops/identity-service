import { ISignUpLead } from '@gamaops/definitions/identity/types/v1';
import mongoose, { Document, Schema } from 'mongoose';

export interface ISignUpModel extends ISignUpLead, Document {
	_id: string;
	validationCode: string | null;
}

const SignUpSchema = new Schema({
	_id: {
		type: String,
	},
	name: {
		type: String,
		required: true,
		trim: true,
	},
	email: {
		type: String,
		lowercase: true,
		index: true,
		unique: true,
		sparse: true,
		trim: true,
	},
	cellphone: {
		type: String,
		trim: true,
		index: true,
		unique: true,
		sparse: true,
	},
	validationChannel: {
		type: Number,
		required: true,
	},
	validationCode: {
		type: String,
	},
	createdAt: {
		type: Date,
	},
	createdJobId: {
		type: String,
	},
	updatedAt: {
		type: Date,
	},
	updatedJobId: {
		type: String,
	},
	signedUpAt: {
		type: Date,
	},
	signedUpJobId: {
		type: String,
	},
});

export const SignUpModel = mongoose.model<ISignUpModel>('SignUp', SignUpSchema);
