import {
	Counter,
} from 'prom-client';

export const identityCallsCounter = new Counter({
	name: 'identity_calls_total',
	help: 'Total calls to identity processor functions',
	labelNames: ['function'],
});

export const cryptographyCallsCount = new Counter({
	name: 'cryptography_calls_total',
	help: 'Total calls to cryptography functions',
	labelNames: ['function'],
});
