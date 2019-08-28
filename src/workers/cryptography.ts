import bcrypt from 'bcrypt';
import fs from 'fs';
import { exposeWorker, ITask } from 'hfxworker';
import jsonwebtoken from 'jsonwebtoken';
import path from 'path';

const DEFAULT_SALT_ROUNDS = 6;

export const ensureAbsoluteDirectory = (directory: string): string => {
	if (path.isAbsolute(directory)) {
		return directory;
	}
	return path.join(process.cwd(), directory);
};

export const readPrivateKey = (filePath: string): string => {
	return fs.readFileSync(
		ensureAbsoluteDirectory(filePath),
	).toString('utf8');
};

const PRIVATE_KEYS: any = {
	SIGN_UP: {
		key: readPrivateKey(process.env.SIGN_UP_PRIVATE_KEY!),
		passphrase: process.env.SIGN_UP_PRIVATE_KEY_PASSWORD || null,
	},
};

exposeWorker({
	hashString: (task): Promise<ITask> => {
		return new Promise((resolve, reject) => {
			bcrypt.hash(
				task.data!.string,
				task.data!.saltRounds || DEFAULT_SALT_ROUNDS,
				(error, hash) => {
					if (error) {
						reject(error);
						return;
					}
					resolve({ data: {hash} });
				},
			);
		});
	},
	validateBcryptHash: (task): Promise<ITask> => {
		return new Promise((resolve, reject) => {
			bcrypt.compare(
				task.data!.plain,
				task.data!.hash,
				(error, isValid) => {
					if (error) {
						reject(error);
						return;
					}
					resolve({ data: {isValid} });
				},
			);
		});
	},
	signJwt: (task): Promise<ITask> => {
		return new Promise((resolve, reject) => {
			jsonwebtoken.sign(
				task.data!.payload,
				PRIVATE_KEYS[task.data!.key],
				{
					algorithm: 'RS256',
					...task.data!.options,
				},
				(error, token) => {
					if (error) {
						reject(error);
						return;
					}
					resolve({ data: {token} });
				},
			);
		});
	},
});
