import { readFileSync } from "fs";
import ejs from "ejs";
import { getBundledCode } from "./bundle-utils";

/**
 * Reads an SVG path and returns the code
 * path should be either 'src' or 'public' located
 */

function get_svg(path) {
    const svg_code = readFileSync(path).toString()
    return svg_code.replace(/\n+/g, "")
}

function render_ejs(bundle, template_path, data) {
    const template_source = readFileSync(template_path, { encoding: 'utf8' })

    const font_base64 = "data:font/woff2;base64," + readFileSync(`src/static/fonts/Inconsolata.woff2`).toString("base64")

    return ejs.render(template_source, {
        ...data,
        "font_base64": font_base64,
        "get_svg": get_svg,
        "getBundledCode": getBundledCode.bind(null, bundle)
    })
}

export default function renderEJS(data = {}, ...paths) {
    return {
        name: "renderEJS",
        buildStart() {
            paths.forEach(path => {
                this.addWatchFile(path)
            })
        },
        async generateBundle(options, bundle) {
            paths.forEach(path => {
                this.emitFile({
                    type: 'asset',
                    fileName: path.replace("src/", "").replace("ejs", "html"),
                    source: render_ejs(bundle, path, data)
                })
            })
        }
    }
}