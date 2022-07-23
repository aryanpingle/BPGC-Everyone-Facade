export default function injectionPlugin(injection_dict = {}) {
    return {
        name: "injectionPlugin",
        async resolveId(id, importer, options) {
            if(!id.startsWith("inject:")) return

            return id
        },
        load(id) {
            if(!id.startsWith("inject:")) return 

            const injection_name = id.slice("inject:".length)
            let injection_value = injection_dict[injection_name]

            return `export default ${JSON.stringify(injection_value)}`
        }
    }
}