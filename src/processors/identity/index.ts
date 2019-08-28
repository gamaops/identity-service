import { ServiceRuntime } from '../../interfaces';

import addSignUpLead from './sign-up-lead';
import addValidateSignUp from './validate-sign-up';

export default (runtime: ServiceRuntime) => {
	addSignUpLead(runtime);
	addValidateSignUp(runtime);
};
