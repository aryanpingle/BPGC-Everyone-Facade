import EVERYONE_FIELDS from "inject:EVERYONE_FIELDS"
import IS_ADMIN from "inject:IS_ADMIN"

const BRANCH_CODES = {
    'A1': 'B.E. Chemical',
    'A3': 'B.E. EEE',
    'A4': 'B.E. Mechanical',
    'A7': 'B.E. CSE',
    'A8': 'B.E. EnI',
    'AA': 'B.E. ECE',
    'B1': 'M.Sc. Biology',
    'B2': 'M.Sc. Chemistry',
    'B3': 'M.Sc. Economics',
    'B4': 'M.Sc. Maths',
    'B5': 'M.Sc. Physics',
    "P": "PHD",
    "PHD": "PHD",
    'H101': 'M.E. Chemical',
    'H103': 'M.E. Computer Science',
    'H112': 'M.E. Software Systems',
    'H123': 'M.E. Microelectronics',
    'H129': 'M.E. biotechnology',
    'H140': 'M.E. Embedded Systems',
    'H141': 'M.E. Design Engineering',
    'H106': 'M.E. Mechanical',
    'H151': 'M.E. Sanitation Science, Technology and Management',
    'H152': 'M.Phil. In Liberal Studies',
    "": ""
}

const EVERYONE = {}
EVERYONE_FIELDS.forEach(field => {
    EVERYONE[field] = []
})
const FILTERS = {}

/**
 * Loads data for the given years in parallel
 * @param  {...string} years Data is downloaded for these years in parallel
 */

export async function load_years(...years) {
    let fetch_promises = years.map(async year => await load_year(year))
    await Promise.all(fetch_promises)
}

export async function load_year(year) {
    let data = await fetch(`./everyone/${year}.json`)
    data = await data.json()
    
    EVERYONE_FIELDS.forEach((field, index) => {
        EVERYONE[field].push(...data[index])
    })
}

export async function toggle_filter(field, value) {
    if(!(field in FILTERS)) {
        FILTERS[field] = [value]
        return
    }

    const index = FILTERS[field].indexOf(value)
    if(index == -1) FILTERS[field].push(value)
    else FILTERS[field].splice(index, 1)
}

export async function toggle_all_in_field(field, ...all_values) {
    if(!(field in FILTERS)) {
        FILTERS[field] = all_values
        return
    }

    if (FILTERS[field].length != 0) {
        FILTERS[field] = []
        return
    }

    FILTERS[field] = all_values
}

/**
 * EXTRA FIELDS: degree_be, degree_msc, degree_h, year
 */

export function get_field_from_person(field, person_idx) {
    if(EVERYONE_FIELDS.includes(field)) {
        return EVERYONE[field][person_idx]
    }

    /* Custom Fields */

    if(IS_ADMIN && field == "bday-name") {
        const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"]

        let bday = parseInt(EVERYONE["bday"][person_idx])
        // Convert MMDDYY into its respective parts
        let year = parseInt(bday % 100)
        if(year > 50) year += 1900
        else year += 2000

        bday /= 100
        let day = parseInt(bday % 100)
        
        bday /= 100
        let month = parseInt(bday % 100)

        return `${day} ${MONTH_NAMES[month - 1]}, ${year}`
    }

    const person_id = EVERYONE["id"][person_idx]
    const year = person_id.substring(0, 4)

    if(field == "year") return year

    const branch = person_id.substring(4, 8)
    const first_two = branch.substring(0, 2)
    const last_two = branch.substring(2, 4)

    let degree_be = ""
    let degree_msc = ""
    let degree_h = ""

    // Higher degree
    if(branch.match(/H\d{3}/)) {
        degree_h = branch
    }
    // PHD
    else if(branch.charAt(0) == "P") {
        degree_h = "PHD"
    }
    // B.E. only
    else if((last_two == "PS" || last_two == "TS") && first_two.charAt(0) == "A") {
        degree_be = first_two
    }
    // M.Sc. only
    else if((last_two == "PS" || last_two == "TS") && first_two.charAt(0) == "B") {
        degree_msc = first_two
    }
    // B.E. + B.E.
    else if(first_two.charAt(0) == "A" && last_two.charAt(0) == "A") {
        degree_be = first_two
    }
    // M.Sc. + B.E.
    else if(first_two.charAt(0) == "B" && last_two.charAt(0) == "A") {
        degree_msc = first_two
        degree_be = last_two
    }
    // B.E. + M.Sc.
    else if(first_two.charAt(0) == "A" && last_two.charAt(0) == "B") {
        degree_msc = last_two
        degree_be = first_two
    }
    // M.Sc. + M.Sc.
    else if(first_two.charAt(0) == "B" && last_two.charAt(0) == "B") {
        degree_msc = first_two
    }
    // IDK what anything else could be
    else {
        throw new Error(`WTF is their branch: ${person_id}`)
    }

    const include_name = field.endsWith("-name")
    switch(field.replace(/\-name/, "")) {
        case "degree_be": return include_name ? BRANCH_CODES[degree_be] : degree_be
        case "degree_msc": return include_name ? BRANCH_CODES[degree_msc] : degree_msc
        case "degree_h": return include_name ? BRANCH_CODES[degree_h] : degree_h
    }

    throw new Error(`Field not found: ${field}`)
}

/**
 * Returns the indices of people after filtering
 */

export function filter() {
    const indices = []
    const EVERYONE_LENGTH = EVERYONE["id"].length
    for(let person_idx = 0; person_idx < EVERYONE_LENGTH; ++person_idx) {
        let is_valid = true
        for(const [field, possible_values] of Object.entries(FILTERS)) {
            if(possible_values.length == 0) continue

            if(!possible_values.includes(get_field_from_person(field, person_idx))) {
                is_valid = false
                break
            }
        }
        if(is_valid) indices.push(person_idx)
    }
    return indices
}

const DOWNLOAD_EXPORT_LINK = document.createElement("A")
DOWNLOAD_EXPORT_LINK.setAttribute("download", "everyone.csv")
DOWNLOAD_EXPORT_LINK.style.display = "none"

export function download_people(results) {
    let csv_content = "data:text/csv;charset=utf-8,"
    let titles = {
        "Year": "year",
        "ID": "id",
        "Name": "name",
        "Primary Degree": "degree_be-name",
        "Secondary Degree": "degree_msc-name",
        "Higher Degree": "degree_h-name",
        "Hostel": "hostel",
        "Room No": "room"
    }

    // Make the header
    csv_content += Object.keys(titles).join(",") + "\n"
    // Make the actual contents
    csv_content += results.map(person_idx => {
        return Object.values(titles).map(field => {
            return get_field_from_person(field, person_idx)
        }).join(",")
    }).join("\n")
    let encoded_uri = encodeURI(csv_content)
    DOWNLOAD_EXPORT_LINK.href = encoded_uri
    document.body.appendChild(DOWNLOAD_EXPORT_LINK)
    DOWNLOAD_EXPORT_LINK.click()
}