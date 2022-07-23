"use strict"

import { print, lerp, sort_multiple, max, sort } from "./helpers";
import { load_years, get_field_from_person, filter, download_people } from "./everyone";

let filtered = []
let results = []
let SORTING = "relevant"
const MAX_RESULT_COUNT = 50
let current_result_count = 0

setup()

async function setup() {
    // Fetch some
    let load_promises = load_years(2021, 2020)

    // Setup toggles
    setup_toggles()

    // Setup 'Select all' buttons
    setup_select_all()

    // Store the input element in query_input
    let query_input = document.getElementById("query")
    // Set key event for query input
    query_input.addEventListener("keyup", () => {
        document.querySelector(".search-or-clear-rel").classList.toggle("show-clear-button", query_input.value.length != 0)
        resolve_query()
    }, { passive: true })

    // Setup the clear input button
    query_input.nextElementSibling.onclick = function(event) {
        this.previousElementSibling.value = ""
        this.previousElementSibling.select()
        resolve_query()
    }

    document.querySelector(".filters-tab-button").onclick = show_filters_tab
    document.querySelector("#close-filters-tab").onclick = close_filters_tab
    
    document.querySelector("#sorting-button").onclick = change_sorting
    document.querySelector("#download-button").onclick = download_results

    await load_promises
    
    // Apply all the filters i.e. none
    apply_filters()
}

function setup_toggles() {
    [...document.getElementsByClassName("filter-toggle")].forEach(toggle=>{
        toggle.onclick = event=>{
            if("vibrate" in navigator) navigator.vibrate(50)
            if(toggle.classList.contains("selected")) toggle.classList.remove("selected")
            else toggle.classList.add("selected")
            apply_filters()
        }
    })
}

function setup_select_all() {
    [...document.getElementsByClassName("select-all-button")].forEach(button=>{
        button.onclick = event=>{
            let container = button.parentElement.nextElementSibling
            if(container.getElementsByClassName("selected").length == container.getElementsByClassName("filter-toggle").length) {
                // Deselect all
                [...container.getElementsByClassName("filter-toggle")].forEach(child=>child.classList.remove("selected"))
            }
            else {
                // Select all
                [...container.getElementsByClassName("filter-toggle")].forEach(child=>child.classList.add("selected"))
            }
            apply_filters()
        }
    })
}

function change_sorting(sorting_button) {
    if(SORTING == "relevant") {
        SORTING = "room"
        document.querySelector("#sorting-button").childNodes[2].nodeValue = "Sort by Relevance"
    }
    else {
        SORTING = "relevant"
        document.querySelector("#sorting-button").childNodes[2].nodeValue = "Sort by Room Number"
    }
    resolve_query()
}

/**
 * Create a list of [key, values] pairs from the DOM and returns it
 */

function load_filters() {
    let filters = {}

    for(const filter_section of document.getElementsByClassName("filter-section")) {
        const field = filter_section.getAttribute("category")
        let selected = filter_section.getElementsByClassName("selected")
        if(selected.length != 0) {
            filters[field] = [...selected].map(ele=>ele.getAttribute("value"))
        }
    }

    return filters
}

/**
 * Loads the filters by calling `load_filters()` and returns the filtered list of ALL BITSians
 * @returns List of all BITSians that match the filters
 */

function apply_filters() {
    let searchParams = load_filters()
    
    filtered = filter(searchParams)

    resolve_query()
}

function close_filters_tab(event) {
    if("vibrate" in navigator) navigator.vibrate(100)
    document.getElementById("filters-tab").classList.add("hidden")
}

function show_filters_tab(event) {
    if("vibrate" in navigator) navigator.vibrate(100)
    document.getElementById("filters-tab").classList.remove("hidden")
}

function resolve_query() {
    let query = document.getElementById("query").value.replace(/\s+/g, ' ')
    query = query.toLowerCase()
    results = new Array(filtered.length).fill(0)

    // If the query is only 3 digits - room search
    if(/^\d{1,3}$/.test(query)) {
        for(let filtered_idx = 0; filtered_idx < results.length; ++filtered_idx) {
            let person_idx = filtered[filtered_idx]
            results[filtered_idx] = [scorer_room(query, get_field_from_person("room", person_idx)), filtered_idx]
        }
    }
    // Otherwise if there is a digit anywhere - id search
    else if(/\d/.test(query)) {
        for(let filtered_idx = 0; filtered_idx < results.length; ++filtered_idx) {
            let person_idx = filtered[filtered_idx]
            results[filtered_idx] = [scorer_id(query, get_field_from_person("id", person_idx)), filtered_idx]
        }
    }
    // Otherwise - name search
    else {
        for(let filtered_idx = 0; filtered_idx < results.length; ++filtered_idx) {
            let person_idx = filtered[filtered_idx]
            results[filtered_idx] = [scorer_name(query, get_field_from_person("name", person_idx)), filtered_idx]
        }
    }
    
    if(SORTING == "relevant") sort_multiple(results, element=>[-element[0][0], -element[0][1], element[0][2]])
    else sort(results, ([_, filtered_idx]) => get_field_from_person("room", filtered[filtered_idx]))

    // Filter out results with 0 score
    fast_filter(results, element => element[0][0])

    // Convert results to idk man im tired
    for(let i = 0; i < results.length; ++i) {
        results[i] = filtered[results[i][1]]
    }

    display_results()
}

/**
 * Performs the same way as Array.filter, just much more quickly
 */

function fast_filter(iterable, condition) {
    let ci = 0
    for(let i = 0; i < iterable.length; ++i) {
        if(condition(iterable[i])) {
            iterable[ci++] = iterable[i]
        }
    }
    iterable.splice(ci)
}

const branch_codes = {
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
    "PH": "PHD",
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

function get_student_element_html(person_idx) {
    return `<div class="student">
        <div class="student-child student-place">
            <div class="student-place__hostel">${get_field_from_person("hostel", person_idx)}</div>
            <div class="student-place__room">${get_field_from_person("room", person_idx)}</div>
        </div>
        <div class="student-child student-year">${get_field_from_person("year", person_idx)}</div>
        <div class="student-child student-info">
            <div class="student-info__name" style="font-size: ${Math.min(1.5, lerp(max(get_field_from_person("name", person_idx).split(/\s+/), e => e.length).length, 7, 15, 1.5, 0.925))}em">${get_field_from_person("name", person_idx)}</div>
            <div class="student-info__branch">${get_field_from_person("degree_be-name", person_idx)}</div>
            <div class="student-info__branch">${get_field_from_person("degree_msc-name", person_idx)}</div>
            <div class="student-info__branch">${get_field_from_person("degree_h-name", person_idx)}</div>
            <div class="student-info__id">${get_field_from_person("id", person_idx)}</div>
        </div>
    </div>`
}

function display_results() {
    current_result_count = 0
    let results_html = results.slice(0, MAX_RESULT_COUNT).map(get_student_element_html).join("")
    if(current_result_count + MAX_RESULT_COUNT < results.length) {
        results_html += get_load_more_button_html()
    }
    document.getElementById("results-container").innerHTML = results_html
    current_result_count = Math.min(MAX_RESULT_COUNT, results.length)
}

function get_load_more_button_html() {
    return `<div id='load-more' onclick='${load_more_results}()'>More Results</div>`
}

function load_more_results() {
    if (current_result_count == results.length) return

    const results_container = document.getElementById("results-container")

    // Remove the load more button
    results_container.lastElementChild.remove()

    let new_text = results.slice(current_result_count, current_result_count + MAX_RESULT_COUNT).map(get_student_element_html).join("") + (current_result_count + MAX_RESULT_COUNT >= results.length ? "" : get_load_more_button_html())
    let buffer_parent = document.createElement("div")
    buffer_parent.innerHTML = new_text
    results_container.append(...buffer_parent.children)
    current_result_count = Math.min(current_result_count + MAX_RESULT_COUNT, results.length)
}

/**
 * Matches a query to the given text and returns its score
 * @returns List of 3 scores - [number of character matches, longest common substring, start index of LCS]
 */

function scorer_name(query, text) {
    if(query.length == 0) {
        return [1, 0, 0]
    }
    text = text.toLowerCase()
    let j = 0
    let max_consec = [0, 0]
    let consec = [0, 0]
    for(let i = 0; i < text.length; ++i) {
        if(text.charAt(i) == query.charAt(j)) {
            consec = [1, i]
            // Loop behind to see how consecutive this is
            let k = i-1
            while(k >= 0 && text.charAt(k) == query.charAt(j - (i-k))) {
                ++consec[0]
                consec[1] = k
                --k
            }
            ++j // Advance the query index
            // Maximise consectutive length first, then minimize the starting position
            if(max_consec[0] < consec[0] || (max_consec[0] == consec[0] && max_consec[1] > consec[1])) {
                max_consec = consec
            }
            if(j==query.length) break
        }
    }
    
    if(j == query.length) {
        return [j, ...max_consec]
    }
    else return [0, 0, 0]
}

function scorer_id(query, text) {
    if(text.includes(query)) {
        return [query.length, query.length, text.indexOf(query)]
    }
    return [0, 0, 0]
}

function scorer_room(query, text) {
    if(text == query) {
        return [3, 3, 0]
    }
    return [0, 0, 0]
}

// Download the data

function download_results() {
    download_people(results)
}