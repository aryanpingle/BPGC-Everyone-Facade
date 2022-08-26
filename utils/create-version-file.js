import { writeFile } from "fs";

export default function createVersionFile(version) {
    return {
        name: "createVersionFile",
        async generateBundle() {
            writeFile("public/version.txt", `${version}`, console.log)
        }
    }
}