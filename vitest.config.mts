import swc from 'unplugin-swc';
import tsConfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/__unit__/**/*.spec.ts'],
		globals: true,
		root: './',
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
		},
	},
	plugins: [
		tsConfigPaths(),
		swc.vite({
			module: { type: 'es6' },
		}),
	],
});
