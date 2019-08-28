import { SignOptions } from 'jsonwebtoken';

export const signUpIdentityTokenOptions: SignOptions = {
	issuer: process.env.SIGN_UP_ISSUER,
	audience:  process.env.SIGN_UP_AUDIENCE,
	expiresIn: process.env.SIGN_UP_EXPIRES_IN,
};
