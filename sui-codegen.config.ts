import type { SuiCodegenConfig } from '@mysten/codegen';

const config: SuiCodegenConfig = {
	output: '/home/ubuntu/projects/leva/deepdashboard/src/contracts/deepbook_margin',
	generateSummaries: true,
	prune: true,
	packages: [
		{
			package: '@local-pkg/deepbook-margin',
			path: '/home/ubuntu/projects/leva/deepbookv3/packages/deepbook_margin',
		},
	],
};

export default config;