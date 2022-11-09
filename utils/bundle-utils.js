/**
 * Finds and returns the contents of a file relative to public
 * @param {Object} bundle 
 * @param {String} filename 
 */

export function getBundledCode(bundle, filename) {
    if(filename in bundle) {
        if(bundle[filename].type == "asset") return bundle[filename]["source"]
        return bundle[filename]["code"]
    }
    return null
}