import { readFileSync } from "fs";
import postcss from "postcss";
const postcss_minify = require('postcss-minify');

async function get_mini_CSS(paths) {
    let combined_css = ""
    const promises = paths.map(async path => {
        const source_code = readFileSync(path, { encoding: 'utf8' })
        const minified_code = (await postcss([postcss_minify]).process(source_code)).css
        combined_css += minified_code
    })
    await Promise.all(promises)
    return combined_css
}

export default function handle_css(entrypoints = {}) {
    return {
        "name": "minifyCSS",
        buildStart() {
            // So that changes here will trigger rebuilds
            Object.values(entrypoints).forEach(paths => {
                paths.forEach(path => this.addWatchFile(path))
            })
        },
        async generateBundle(options, bundle) {
            let promises = Object.entries(entrypoints).map(async ([output_file, paths]) => {
                this.emitFile({
                    type: 'asset',
                    fileName: output_file,
                    source: await get_mini_CSS(paths)
                })
            })

            await Promise.all(promises)
        }
    }
}