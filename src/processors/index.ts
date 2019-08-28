import { ServiceRuntime } from '../interfaces';

import addIdentity from './identity';
import addCryptography from './utils/cryptography';

export default (runtime: ServiceRuntime) => {
	addCryptography(runtime);
	addIdentity(runtime);
};
