import resolve from '@rollup/plugin-node-resolve';
import rimraf from 'rimraf';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import { version as APP_VERSION } from "./package.json";
import renderEJS from "./utils/plugin-create-ejs";
import injectionPlugin from './utils/plugin-injections';
import copy from 'rollup-plugin-copy';
import { EVERYONE_FIELDS, FILTERS, IS_ADMIN } from "./meta.json";
import handle_css from './utils/plugin-minify-css';
import createVersionFile from './utils/create-version-file';
import { readFileSync } from 'fs';

const production = !process.env.ROLLUP_WATCH;

// Clear public folder
rimraf.sync("public")

const GLOBAL_DATA = {
	"APP_VERSION": APP_VERSION,
	"EVERYONE_FIELDS": EVERYONE_FIELDS,
	"FILTERS": FILTERS,
	"IS_ADMIN": IS_ADMIN,
	"IS_DEV": !production,
	"CURRENT_CHANGELOG": JSON.parse(readFileSync("./changelog.json")),
}

function serve() {
	let server;

	function toExit() {
		if (server) server.kill(0);
	}

	return {
		writeBundle() {
			if (server) return;
			server = require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
				stdio: ['ignore', 'inherit', 'inherit'],
				shell: true
			});

			process.on('SIGTERM', toExit);
			process.on('exit', toExit);
		}
	};
}

export default [
	// JS Files (Also handles CSS Files)
	{
		input: [
			"src/search.js",
			"src/index.js"
		],
		output: {
			format: 'cjs',
			dir: "public",
			entryFileNames: "[name].js",
		},
		plugins: [
			injectionPlugin({
				...GLOBAL_DATA
			}),
		
			// Minify CSS Files
			handle_css({
				"index.css": [
					"src/css/basic.css",
					"src/css/presets.css",
					"src/css/custom.css",
					"src/css/index-main.css",
					"src/css/index-features.css",
				],
				"search.css": [
					"src/css/basic.css",
					"src/css/presets.css",
					"src/css/custom.css",
					"src/css/search.css",
					"src/css/settings-tab.css",
					"src/css/main-tab.css",
					"src/css/search-results.css",
					"src/css/update-alert.css"
				]
			}),

			// Generate index.html
			renderEJS({
				...GLOBAL_DATA
			}, "src/search.ejs", "src/index.ejs"),
		
			// Copy images and everyone.json
			copy({
				targets: [
					{ src: 'src/static/', dest: 'public/' },
					{ src: 'src/root/*', dest: 'public/' },
					{ src: 'src/everyone/', dest: 'public/' },
					{ src: 'changelog.json', dest: 'public/' },
				]
			}),

			// Create file containing version number
			createVersionFile(APP_VERSION),
			
			resolve({ browser: true, }),

			!production && serve(),
			!production && livereload('public'),
			production && terser(),
		],
		watch: {
			clearScreen: false
		}
	},
	// Service Worker
	{
		input: {
			"service-worker": "src/service-worker.js",
		},
		output: {
			format: "cjs",
			dir: "public"
		},
		plugins: [
			production && terser(),
			injectionPlugin({
				...GLOBAL_DATA
			}),
		 ],
		watch: { clearScreen: false }
	},
]