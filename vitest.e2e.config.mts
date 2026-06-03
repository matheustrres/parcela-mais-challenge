import swc from 'unplugin-swc';
import tsConfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/__e2e__/**/*.e2e.spec.ts'],
		globalSetup: ['./tests/__e2e__/global-setup.ts'],
		globals: true,
		root: './',
		environment: 'node',
		pool: 'forks',
		poolOptions: {
			forks: { singleFork: true },
		},
	},
	plugins: [
		tsConfigPaths(),
		swc.vite({
			module: { type: 'es6' },
		}),
	],
});
