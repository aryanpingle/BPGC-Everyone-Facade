"use strict"

import { print, formattedNumber, sort_multiple, querySelectorAll, vibrate, sort_strings, sort_numbers, setupFontLoad } from "./js/helpers";
import { toggle_filter, load_years, get_field_from_person, filter, toggle_all_in_field, getDay, setExclusiveDegreeBoolean } from "./js/everyone";
import IS_ADMIN from "inject:IS_ADMIN"
import IS_DEV from "inject:IS_DEV"
import APP_VERSION from "inject:APP_VERSION"
import CURRENT_CHANGELOG from "inject:CURRENT_CHANGELOG"

let filtered = []
let results = []
let results_with_score = []
let SORTING = "relevance"
const MAX_RESULT_COUNT = 25
let notifications_promise = null
let notifications = null

setup()

async function setup() {
    // CAVEAT
    // ------
    // The first two calls result in a promise, so everything after their first await is executed after setup() is finished running

    if(IS_DEV || IS_ADMIN || !!localStorage.getItem("gsi")) {
        alreadySignedIn()
    }

    // BEFORE BEFORE ANYTHING, FETCH THOSE DAMN FILES
    handleDownloadingYears().then(async () => {
        await handleAuthentication()
    })
    // BEFORE ANYTHING, make a fetch for the font
    setupFontLoad()

    // Analytics
    if(!IS_DEV) {
        if(navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches) {
            gtag("event", "pwa_use", {
                "event_category": "engagement",
                "value": 1
            })
        }
    }

    querySelectorAll("svg").forEach(svg => {
        svg.setAttribute("version", "1.1")
    })
    
    /* Setup Buttons */
    
    // PWA Install App
    setupPWAPopup()
    // To close the settings tab
    setup_close_settings_tab()
    // To open the settings tab
    setup_open_settings_tab()
    // Filter Toggles
    setupToggles()
    // 'select-all-toggles' Buttons
    setupSelectAllToggles()
    // Create & Setup Binary Toggles
    createBinaryToggles()
    // View More and View All Buttons
    setupViewMoreSection()
    // Sorting Dropdown
    setupSortingDropdown()
    // Sorting Buttons
    setupSortingButtons()
    // Clear input button
    document.querySelector("#search-bar-clear-icon").onclick = event => {
        document.querySelector("input#search-bar").value = ""
        document.querySelector(".search-or-clear-rel").classList.toggle("show-clear-button", search_bar.value.length != 0)
        document.querySelector(".sort-button[value='relevance']").innerText = search_bar.value.length != 0 ? "Relevant" : "Default"
        document.querySelector("input#search-bar").focus()
        resolve_query()
    }
    // Contact me link
    document.querySelector("#contact-me").onclick = event => {
        window.open("https://wa.me/919920424045?text=You are a God.", "_blank")
    }

    // Setup the search bar
    let search_bar = document.querySelector("input#search-bar")

    search_bar.addEventListener("keyup", () => {
        document.querySelector(".search-or-clear-rel").classList.toggle("show-clear-button", search_bar.value.length != 0)
        document.querySelector(".sort-button[value='relevance']").innerText = search_bar.value.length != 0 ? "Relevant" : "Default"
        resolve_query()
    }, { passive: true })
}

async function handleAuthentication() {
    if(!document.querySelector("#auth-overlay")) return

    document.querySelector("#auth-overlay").style.display = ""
    let response = null
    await new Promise((resolve, reject) => {
        let intervalID = setInterval(() => {
            if(typeof google == 'undefined') return;

            // Since the google variable exists, stop the interval
            clearInterval(intervalID)
            google.accounts.id.initialize({
                client_id: "1091212712262-c8ci56h65a3hsra7l55p2amtq7rue5ja.apps.googleusercontent.com",
                callback: (data) => {
                    response = data
                    resolve()
                }
            });
            google.accounts.id.renderButton(
                document.getElementById("auth-button"),
                { theme: "outline", size: "large" }  // customization attributes
            );
        }, 200);
    })
    signInConfirmed(response)
}

function signInConfirmed(response) {
    // Hide the auth overlay
    document.querySelector("#auth-overlay").classList.add("auth-confirmed")
    
    // Parse the JWIT token
    let user = JSON.parse(window.atob(response.credential.split(".")[1]))
    // Save the user as signed in
    localStorage.setItem("gsi", JSON.stringify(user))

    handleSignedInUser()
}

function alreadySignedIn() {
    // Remove the auth overlay entirely
    document.querySelector("#auth-overlay").remove()

    handleSignedInUser()
}

function handleSignedInUser(response) {
    if(IS_DEV || IS_ADMIN) return

    let user = JSON.parse(localStorage.getItem("gsi"))

    let email = user["email"]
    let userBitsID = email.substring(email.indexOf("@"))

    // Do something based off of the user ID
}

async function checkChangelog() {
    const years_to_be_downloaded = getYearsToBeDownloaded()

    // Weird place, but fetch notifications.json
    notifications_promise = fetch("./notifications.json").then(data => data.json()).then(data => {
        notifications = data
        return 1
    })

    let FETCHED_CHANGELOG = await fetch("./changelog.json").then(data => data.json()).catch(err => null)

    // Exit if the network fails
    if(FETCHED_CHANGELOG === null || FETCHED_CHANGELOG === undefined) {
        checkForUpdates()
        return
    }

    // Compare with CURRENT_CHANGELOG
    let modified_data_years = []
    for(let [year, hash] of Object.entries(FETCHED_CHANGELOG)) {
        if(hash != CURRENT_CHANGELOG[year]) {
            modified_data_years.push(year)
        }
    }

    modified_data_years = modified_data_years.filter(year => years_to_be_downloaded.includes(year))

    // If there are no changes available, exit
    if(modified_data_years.length == 0) {
        checkForUpdates()
        return
    }

    // At this point, there are definitely changes to be downloaded
    
    const promise_array = modified_data_years.map(year => {
        return fetch(`./everyone/${year}.json`, {
            method: "POST"
        })
    })

    // await download of all the files
    await Promise.all(promise_array)
    
    showUpdatePrompt()
}

async function checkForUpdates() {
    let fetched_version = await fetch("version.txt").then(data => data.text()).catch(err => null)
    
    // Exit if the network fails
    if(fetched_version == null || fetched_version == undefined) {
        print("Could not fetch latest version")
        return
    }

    // Print fetched and current versions for posterity
    print(`Current version: ${APP_VERSION}\nFetched version: ${fetched_version}`)

    // Remove the patch level from fetched and current versions
    fetched_version = fetched_version.substring(0, fetched_version.lastIndexOf("."))
    let current_version = APP_VERSION.substring(0, APP_VERSION.lastIndexOf("."))

    // If the current version is the latest, exit
    if(fetched_version == current_version) {
        print("No updates available")

        // Now that we know there are no updates, handle notifications
        handleNotifications()

        return
    }

    // At this point, we know that the latest version is ahead of the current version
    print("%cUpdate available", "color: greenyellow; background-color: black; font-weight: 900;")

    showUpdatePrompt()
}

function showUpdatePrompt() {
    // Show the Update Alert
    document.querySelector("#update-alert").classList.add("shown")
    // Setup the Ignore Button
    document.querySelector("#update-alert--ignore").onclick = event => {
        document.querySelector("#update-alert").classList.remove("shown")
    }
    // Setup the Update Button
    document.querySelector("#update-alert--update").onclick = event => {
        location.reload()
    }
}

async function handleNotifications() {
    await notifications_promise

    /*
    notifications = {
        "id": {
            "title": "",
            "description": "",
            "hue": 0,
            "icon-name": "",
            "start-time": ""
            "end-time": ""
        }
    }
    */

    // Get the ids of all notifications that have been closed
    let closed_notifications = localStorage.getItem("closed-notifications")
    if(!closed_notifications) closed_notifications = "[]"
    closed_notifications = JSON.parse(closed_notifications)

    // Get current time
    const now = new Date()

    // Filter out invalid notifications
    let viable_notifications = notifications.filter(notif => {
        // Exclude closed ones
        if(closed_notifications.includes(notif["id"])) return false
        // Exclude expired ones
        if(notif["end-time"] && now > new Date(notif["end-time"])) return false
        // Exclude future ones
        if(notif["start-time"] && now < new Date(notif["start-time"])) return false

        return true
    })
    
    if(viable_notifications.length == 0) return

    // Add viable notifications to the DOM
    let notification_src = ""
    for (const notif of viable_notifications) {
        notification_src = getNotificationHTML(notif) + notification_src
    }
    // Add HTML code to the DOM
    document.querySelector("#notification-overlay").innerHTML += notification_src

    // Setup the close buttons
    querySelectorAll(".notification__close-button").forEach(button => {
        const notif_id = button.getAttribute("notification-id")
        button.onclick = event => {
            // Get the current active wrapper
            let current_wrapper = document.querySelector(".notification-wrapper--active")
            // Remove the active modifier class
            current_wrapper.classList.remove("notification-wrapper--active")
            // Add the closed modifier class
            current_wrapper.classList.add("notification-wrapper--closed")

            // Add this notification id to the closed notifications list
            {
                let closed_notifications = localStorage.getItem("closed-notifications")
                if(!closed_notifications) closed_notifications = []
                else closed_notifications = JSON.parse(closed_notifications)

                closed_notifications.push(notif_id)

                localStorage.setItem("closed-notifications", JSON.stringify(closed_notifications))
            }
            
            // If this one has a sibling, show it
            if(current_wrapper.previousElementSibling) {
                current_wrapper.previousElementSibling.classList.add("notification-wrapper--active")
                current_wrapper.previousElementSibling.focus()
                return
            }

            // Close notification overlay
            document.querySelector("#notification-overlay").classList.remove("shown")
        }
    })

    // Finally, show the notification overlay
    document.querySelector("#notification-overlay").classList.add("shown")
    setTimeout(() => {
        let first_notification = document.querySelector(".notification-wrapper:last-of-type")
        first_notification.classList.add("notification-wrapper--active")
        first_notification.focus()
    }, 250);
}

function getNotificationHTML(notif) {
    return `
    <div class="notification-wrapper" id="notification--id-${notif['id']}" tabindex="-1">
        <div class="notification-component" style="--notification-hue: ${notif['hue']};">
            <div class="notification-background"></div>
            <div class="notification__content">
                <svg class="notification__svg-border" xmlns="http://www.w3.org/2000/svg" viewbox="0 0 100 100" preserveAspectRatio="none">
                    <rect width="100%" height="100%" fill="none" />
                    <path d="M 10,0 L 0,0 L 0,10" fill="none" />
                    <path d="M 90,0 L 100,0 L 100,10" fill="none" />
                    <path d="M 100,90 L 100,100 L 90,100" fill="none" />
                    <path d="M 10,100 L 0,100 L 0,90" fill="none" />
                </svg>
                <div class="notification__close">
                    <button class="single-image-button notification__close-button" notification-id="${notif['id']}">
                        ${document.querySelector("#template-svg").innerHTML}
                    </button>
                </div>
                <div class="notification__image-container">
                    <img class="notification__image-container" src="./static/images/icons/${notif['icon-name']}" alt="">
                </div>
                <div class="notification__title">${notif['title']}</div>
                <div class="notification__description">${notif['description']}</div>
            </div>
        </div>
    </div>
    `
}

function setupPWAPopup() {
    const ua = navigator.userAgent
    let install_text = ""
    if(['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform)) {
        // iOS + not Safari
        install_text = "[In Safari] Share - Add to Home Screen"
    }
    else if (ua.match(/samsungbrowser/i)) {
        // Fkin Samsung Internet
        install_text = "Download button (near URL)"
    }
    else if(ua.match(/chrome|chromium|crios/i)) {
        // Chrome
        install_text = "Options (⋮) - Install App"
    }
    else if(ua.match(/firefox|fxios/i)) {
        // Firefox
        install_text = "Options (⋮) - Install App"
    }
    else if(ua.match(/opr\//i)) {
        // Opera
        install_text = "It's 2022. Stop using Opera."
    }
    else if(ua.match(/edg/i)) {
        // Edge
        install_text = "Options (⋮) - Install App"
    }
    else {
        // Unknown / Unsupported Browser
    }

    document.querySelector("#pwa-install-guide").innerText = install_text
}

/**
 * Returns an array of String elements, which are the years to be downloaded
 * @returns {String[]} A list of years to be downloaded
 */

function getYearsToBeDownloaded() {
    const VERY_IMPORTANT_YEARS = ["2019", "2020", "2021", "2022"]
    
    let years_to_be_downloaded = []
    const localstorage_years = localStorage.getItem("downloaded-years")
    if(localstorage_years == null) {
        // Either first time on site / cache has been cleared
        // Download the very important years
        years_to_be_downloaded = VERY_IMPORTANT_YEARS
    }
    else {
        // Some years have already been downloaded
        // Download the union of these files + the very important ones
        years_to_be_downloaded = Array.from(new Set([
            ...VERY_IMPORTANT_YEARS,
            ...JSON.parse(localstorage_years)
        ]))
    }

    return years_to_be_downloaded
}

async function handleDownloadingYears() {
    /**
     * Here's the game plan:
     * 1.   See how many everyone-files are in cache
     *      Possibly using service worker postmessage in case sw is updating? IDK
     * 2. 
     *      a. If there are non-zero cached files, fetch them all and load
     *      b. If there aren't any such files, await fetch the latest two
     *         In the background, fetch all the other files (DON'T .json() THEM)
     */

    // Wait till the service worker is ready
    if("serviceWorker" in navigator && "ready" in navigator.serviceWorker) {
        await navigator.serviceWorker.ready
    }

    if(!("caches" in window)) {
        print("Cache API not supported")
    }

    const ALL_YEARS = ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022"]
    
    let years_to_be_downloaded = getYearsToBeDownloaded()
    
    print(`Years to be downloaded: ${years_to_be_downloaded.join(", ")}`)

    const load_promise = load_years(...years_to_be_downloaded)

    // Show the download component if there are some years in ALL_YEARS that aren't in years_to_be_downloaded
    if(years_to_be_downloaded.length != ALL_YEARS.length) {
        const not_downloaded_years = ALL_YEARS.filter(year => !years_to_be_downloaded.includes(year))

        querySelectorAll(".filter-toggle[field='year']").forEach(toggle => {
            if(not_downloaded_years.includes(toggle.getAttribute("value"))) {
                toggle.remove()
            }
        })
        
        document.querySelector(".filter-component[value='year']").insertAdjacentHTML("afterend", `
        <div class="popup-component" id="data-download-popup">
            <div class="popup-header">// [PROMPT] DATA</div>
            <div class="popup-contents">
                <div class="popup-divider popup-divider--horizontal popup-divider--top"></div>
                <div class="popup-divider popup-divider--horizontal popup-divider--bottom"></div>
                <div class="popup-divider popup-divider--vertical popup-divider--left"></div>
                <div class="popup-divider popup-divider--vertical popup-divider--right"></div>
                <div class="popup-title">More People</div>
                <div class="popup-description">
                    Download data for batches ${not_downloaded_years.map(year => `<b>${year}</b>`).join(", ")}
                </div>
                <div class="popup-cta">Download</div>
            </div>
        </div>
        `)

        attachDownloadYearsOnclick(not_downloaded_years)
    }

    await load_promise

    document.querySelector(".page").style.display = "flex"
    document.querySelector(".preloader").classList.add("loaded")
    
    // Now that the preloader is shown, check if there's an update available
    checkChangelog()

    apply_filters()
}

function attachDownloadYearsOnclick(not_downloaded_years) {
    document.querySelector("#data-download-popup .popup-cta").onclick = async function(event) {
        // Fetch all files
        const load_promise = load_years(...not_downloaded_years)

        // Change text
        this.innerText = "Downloading..."
        
        // Wait till the files are downloaded
        await load_promise

        // Change text
        this.innerText = "Done - Press to reload"

        this.onclick = _ => location.reload()
    }
}

function animatePopups() {
    querySelectorAll(".popup-component").forEach(popup => {
        if(popup.classList.contains("popup--shown")) return
        popup.style.setProperty("--popup-height", `${popup.clientHeight}px`)
        popup.classList.add("popup--shown")
    })
}

function setup_close_settings_tab() {
    document.querySelector("#close-settings-tab").onclick = event => {
        document.querySelector(".settings-tab").classList.add("hidden")
        vibrate(100)
    }
}

function setup_open_settings_tab() {
    document.querySelector("#open-settings-tab").onclick = event => {
        animatePopups()
        document.querySelector(".settings-tab").classList.remove("hidden")
        vibrate(100)
    }
}

function setupToggles() {
    querySelectorAll(".filter-toggle").forEach(toggle => {
        toggle.onclick = event => {
            toggle_filter(
                toggle.getAttribute("field"),
                toggle.getAttribute("value")
            )
            toggle.classList.toggle("selected")

            apply_filters()

            vibrate(50)
        }
    })
}

function setupSelectAllToggles() {
    querySelectorAll(".select-all-toggles").forEach(button => {
        button.onclick = event => {
            const field = button.getAttribute("value")
            const toggles = querySelectorAll(`[value="${field}"] .filter-toggle`)
            const toggle_values = toggles.map(ele => ele.getAttribute("value"))
            toggle_all_in_field(
                field,
                ...toggle_values
            )

            if(toggles.some(ele => ele.classList.contains("selected"))) {
                // Deselect all
                toggles.forEach(ele => ele.classList.remove("selected"))
            }
            else {
                // Select all
                toggles.forEach(ele => ele.classList.add("selected"))
            }
            apply_filters()
            
            vibrate(50)
        }
    })
}

function createBinaryToggles() {
    // All Combinations vs Single Degree Only
    document.querySelector(".filter-component[value='degree_be']").before(
        createBinaryToggleElementHTML(
            "All Students",
            () => {
                setExclusiveDegreeBoolean(false)
                apply_filters()
            },
            "Single Degree Only",
            () => {
                setExclusiveDegreeBoolean(true)
                apply_filters()
            }
        )
    )
}

function createBinaryToggleElementHTML(option1, callback1, option2, callback2) {
    let component = document.createElement("div")
    component.className = "binary-toggle-component"
    component.innerHTML = `
    <div class="binary-toggle-container">
        <button class="binary-toggle-button selected">${option1}</button>
        <button class="binary-toggle-button">${option2}</button>
    </div>
    `

    component.firstElementChild.firstElementChild.onclick = function() {
        this.classList.add("selected")
        this.nextElementSibling.classList.remove("selected")
        callback1()
        vibrate(25)
    }
    component.firstElementChild.lastElementChild.onclick = function() {
        this.classList.add("selected")
        this.previousElementSibling.classList.remove("selected")
        callback2()
        vibrate(25)
    }
    
    return component
}

function setupViewMoreSection() {
    const VIEW_MORE_BUTTON = document.querySelector(".view-more-button")
    VIEW_MORE_BUTTON.onclick = event => viewMoreResults(MAX_RESULT_COUNT)
    const VIEW_ALL_BUTTON = document.querySelector(".view-all-button")
    VIEW_ALL_BUTTON.onclick = event => viewMoreResults()
}

function viewMoreResults(number_of_extra_results) {
    const CURRENT_RESULT_COUNT = get_current_result_count()
    const TOTAL_RESULTS = results.length

    if(number_of_extra_results === undefined) {
        number_of_extra_results = TOTAL_RESULTS - CURRENT_RESULT_COUNT
    }

    const HTML_to_be_added = results.slice(CURRENT_RESULT_COUNT, CURRENT_RESULT_COUNT + number_of_extra_results).map(getStudentComponentHTML).join("")
    
    const buffer_parent = document.createElement("div")
    buffer_parent.innerHTML = HTML_to_be_added
    document.querySelector(".results-container").append(...buffer_parent.children)

    setup_student_clicks()

    // Since this changes the number of results shown, update the view more section
    updateViewMoreSection()
}

function setupSortingDropdown() {
    document.querySelector("#sort-dropdown-button").onclick = event => {
        let s = document.querySelector("#sort-dropdown-button").innerHTML
        if(s.includes("▲")) {
            // Close dropdown
            s = s.replace("▲", "▼")
        }
        else {
            // Open dropdown
            s = s.replace("▼", "▲")
        }
        document.querySelector("#sort-dropdown-button").innerHTML = s

        document.querySelector(".sort-dropdown-wrapper").classList.toggle("shown")

        vibrate(25)
    }
}

function setupSortingButtons() {
    querySelectorAll(".sort-button").forEach(button => {
        button.onclick = event => {
            if(button.classList.contains("selected")) return

            button.parentElement.querySelector(".selected").classList.remove("selected")
            button.classList.add("selected")

            // Update the sorting type indicator
            document.querySelector("#sort-type-indicator").innerText = `Sort (${button.getAttribute("value")})`

            change_sorting(button.getAttribute("value"))
            
            vibrate(25)
        }
    })
}

/**
 * Sorts the results based on the argument passed
 * Run only on clicking a sorting button
 * @param {String} sorting_type The type of sorting to be performed
 */

function change_sorting(sorting_type) {
    SORTING = sorting_type
    sortResults(SORTING)
}

/**
 * Creates the `filtered` array using the filters already selected
 * Calls resolve_query() at the end
 * @returns {undefined}
 */

function apply_filters() {
    filtered = filter()

    resolve_query()
}

function resolve_query() {
    console.time("resolveQuery")
    let query = document.querySelector("#search-bar").value.trim().replace(/\s+/g, ' ')
    query = query.toLowerCase()
    results_with_score = new Array(filtered.length).fill(0)

    // If the query is only 3 digits - room search
    if(/^\d{1,3}$/.test(query)) {
        for(let filtered_idx = 0; filtered_idx < results_with_score.length; ++filtered_idx) {
            let person_idx = filtered[filtered_idx]
            results_with_score[filtered_idx] = [scorer_room(query, get_field_from_person("room", person_idx)), filtered_idx]
        }
    }
    else if(IS_ADMIN && /\d{4,}/.test(query)) {
        for(let filtered_idx = 0; filtered_idx < results_with_score.length; ++filtered_idx) {
            let person_idx = filtered[filtered_idx]
            results_with_score[filtered_idx] = [scorer_phone(query, get_field_from_person("phone", person_idx)), filtered_idx]
        }
    }
    // Otherwise if there is a digit anywhere - id search
    else if(/\d/.test(query)) {
        for(let filtered_idx = 0; filtered_idx < results_with_score.length; ++filtered_idx) {
            let person_idx = filtered[filtered_idx]
            results_with_score[filtered_idx] = [scorer_id(query, get_field_from_person("id", person_idx)), filtered_idx]
        }
    }
    // Otherwise - name search
    else {
        for(let filtered_idx = 0; filtered_idx < results_with_score.length; ++filtered_idx) {
            let person_idx = filtered[filtered_idx]
            results_with_score[filtered_idx] = [scorer_name(query, get_field_from_person("name", person_idx)), filtered_idx]
        }
    }
    console.timeEnd("resolveQuery")

    sortResults()
}

/**
 * Performs an in-place Array.filter efficiently
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

/**
 * Sorts the results and displays them
 */

function sortResults(force_sorting) {
    console.time("sortResults")
    switch(force_sorting || SORTING) {
        case "relevance":
            sort_multiple(results_with_score, element=>[-element[0][0], -element[0][1], element[0][2]])
            break
        case "room":
            sort_strings(
                results_with_score,
                element => get_field_from_person("id", filtered[element[1]]), // Hash Function
                ([_, filtered_idx]) => {
                    // Place homeless people at the bottom of room sort
                    if(get_field_from_person("hostel", filtered[filtered_idx]) == "") return "ZZZ"
                    return get_field_from_person("hostel", filtered[filtered_idx]) + get_field_from_person("room", filtered[filtered_idx])
                }
            )
            break
        case "youngest":
            sort_numbers(results_with_score, ([_, filtered_idx]) => -parseInt(get_field_from_person("year", filtered[filtered_idx])))
            break
        case "oldest":
            sort_numbers(results_with_score, ([_, filtered_idx]) => parseInt(get_field_from_person("year", filtered[filtered_idx])))
            break
        case "bday":
            const today = getDay(new Date().getMonth()+1, new Date().getDate())
            sort_numbers(results_with_score, ([_, filtered_idx]) => {
                return (366 + get_field_from_person("bday-day", filtered[filtered_idx]) - today) % 366
            })
            break
        case "cgpa":
            sort_numbers(results_with_score, ([_, filtered_idx]) => {
                const cgpa = get_field_from_person("cgpa", filtered[filtered_idx])
                if(cgpa == "") {
                    return 0.0
                }
                return -parseFloat(cgpa)
            })
            break
    }
    console.timeEnd("sortResults")

    // Filter out results with 0 score
    fast_filter(results_with_score, element => element[0][0])

    // Create the results array, which is already sorted (because results_with_score is sorted)
    results = new Array(results_with_score.length).fill(0)
    for(let i = 0; i < results_with_score.length; ++i) {
        results[i] = filtered[results_with_score[i][1]]
    }

    // If force_sorting was passed
    // Then preserve the number of results shown
    displayResults(!!force_sorting)
}

function displayResults(preserve_count) {
    // Show the number of results
    document.querySelector("#result-count").innerText = `${formattedNumber(results.length)} result${results.length==1?"":"s"}`
    
    // Get the HTML of the results
    const CURRENT_RESULT_COUNT = preserve_count ? get_current_result_count() : MAX_RESULT_COUNT
    const results_html = results.slice(0, CURRENT_RESULT_COUNT).map(getStudentComponentHTML).join("")
    
    // Add the results' HTML to .results-container
    document.querySelector(".results-container").innerHTML = results_html

    setup_student_clicks()

    updateViewMoreSection()
}

function getStudentComponentHTML(person_idx) {
    const field = (field_name) => get_field_from_person(field_name, person_idx)
    const optional = (field_name, text) => field(field_name) ? text : ""

    const student_degrees = `${optional("degree_be", "be")} ${optional("degree_msc", "msc")} ${optional("degree_h", "h")}`.trim().split(" ").map(e=>`student--${e}`).join(" ")

    return `
    <div class="student-component ${student_degrees}" everyone-index="${person_idx}">
        <div class="student__id">${field("id")}</div>
        <div class="student__name">${field("name")}</div>
        <div class="student__badges">
            <div class="student__badge badge-year">${field("year")}</div>
            ${optional(
                "degree_msc",
                `<div class="student__badge badge-degree_msc">${field("degree_msc")}</div>`
            )}
            ${optional(
                "degree_be",
                `<div class="student__badge badge-degree_be">${field("degree_be")}</div>`
            )}
            ${optional(
                "degree_h",
                `<div class="student__badge badge-degree_h">${field("degree_h")}</div>`
            )}
            ${field("room") ? `<div class="student__badge badge-hostel">${field("hostel")} ${field("room")}</div>` : ""}
        </div>
    </div>
    `.trim().replace(/\n\s*/g, "")
}

function setup_student_clicks() {
    querySelectorAll(".student-component").forEach(student_component => {
        student_component.onclick = event => {
            if(student_component.classList.contains("expanded")) {
                student_component.classList.remove("expanded")
                vibrate(25)
                return
            }

            student_component.classList.add("expanded")

            if(student_component.querySelector(".student-info-grid")) {
                vibrate(25)
                return
            }
            
            const everyone_index = parseInt(student_component.getAttribute("everyone-index"))
            student_component.innerHTML += getStudentInfoHTML(everyone_index)

            setupStudentPFPClicks()

            vibrate(25)
        }
    })
}

function getStudentInfoHTML(everyone_index) {
    const field = (field_name) => get_field_from_person(field_name, everyone_index)
    const optional = (field_name, text) => field(field_name) ? text : ""

    return `
    <div class="student-info-grid">
        <div class="info-tile-wrapper info--year">
            <div class="info-tile">
                <span>Year</span>
                ${field("year")}
            </div>
        </div>
        ${optional("room", `
        <div class="info-tile-wrapper info--room">
            <div class="info-tile">
                <span>Room</span>
                ${field("hostel")} ${field("room")}
            </div>
        </div>
        `)}
        ${optional("degree_msc", `
        <div class="info-tile-wrapper info--msc">
            <div class="info-tile">
                <span>M.Sc. Degree</span>
                ${field("degree_msc-name")}
            </div>
        </div>
        `)}
        ${optional("degree_be", `
        <div class="info-tile-wrapper info--be">
            <div class="info-tile">
                <span>B.E. Degree</span>
                ${field("degree_be-name")}
            </div>
        </div>
        `)}
        ${optional("degree_h", `
        <div class="info-tile-wrapper info--h">
            <div class="info-tile">
                <span>Higher Degree</span>
                ${field("degree_h-name")}
            </div>
        </div>
        `)}
        ${getAdminStudentInfoHTML(everyone_index)}
    </div>
    `.trim().replace(/\n\s*/g, "")
}

function getAdminStudentInfoHTML(everyone_index) {
    const field = (field_name) => get_field_from_person(field_name, everyone_index)
    const optional = (field_name, text) => field(field_name) ? text : ""
    
    if(!IS_ADMIN) return ""

    return `
    ${optional("pfp", `
    <div class="info-tile-wrapper info--pfp">
        <div class="info-tile">
            <div class="student__pfp">
                <img src="${field("pfp")}">
            </div>
        </div>
    </div>
    `)}
    ${optional("bday", `
    <div class="info-tile-wrapper info--bday">
        <div class="info-tile">
            <span>Bday</span>
            ${field("bday-name")}
        </div>
    </div>
    `)}
    ${optional("cgpa", `
    <div class="info-tile-wrapper info--cgpa">
        <div class="info-tile">
            <span>CGPA</span>
            ${field("cgpa")}
        </div>
    </div>
    `)}
    ${optional("blood", `
    <div class="info-tile-wrapper info--blood">
        <div class="info-tile">
            <span>Blood</span>
            ${field("blood")}
        </div>
    </div>
    `)}
    ${optional("gender", `
    <div class="info-tile-wrapper info--gender">
        <div class="info-tile">
            <span>Gender</span>
            ${field("gender")}
        </div>
    </div>
    `)}
    ${optional("phone", `
    <div class="info-tile-wrapper info--phone">
        <div class="info-tile">
            <span>Phone</span>
            ${field("phone")}
        </div>
    </div>
    `)}
    ${optional("address", `
    <div class="info-tile-wrapper info--address">
        <div class="info-tile">
            <span>Address</span>
            ${field("address")}
        </div>
    </div>
    `)}
    `.trim().replace(/\n\s*/g, "")
}

function setupStudentPFPClicks() {
    querySelectorAll(".student__pfp").forEach(element => {
        element.onclick = event => {
            event.stopImmediatePropagation()
            element.style.backgroundImage = `url('${element.getAttribute("data-pfp")}')`
        }
    })
}

/**
 * Checks .result-container to return the number of results currently displayed
 * @returns {number} The number of results currently displayed
 */

function get_current_result_count() {
    return document.querySelector(".results-container").children.length
}

function updateViewMoreSection() {
    const CURRENT_RESULT_COUNT = get_current_result_count()
    const TOTAL_RESULTS = results.length
    const REMAINING_RESULTS = TOTAL_RESULTS - CURRENT_RESULT_COUNT

    /**
     * View More = If REMAINING > MAX_RESULT_COUNT 
     * View All = If REMAINING <= MAX_RESULT_COUNT or (TOTAL_RESULTS < 300)
     */

    // If there are more results than can be loaded in a single try, then show the view-more-button
    if(REMAINING_RESULTS > MAX_RESULT_COUNT) {
        document.querySelector(".view-more-section").classList.add("show-view-more")
        document.querySelector(".view-more-button__count").innerText = `[+${MAX_RESULT_COUNT}]`
    }
    else {
        document.querySelector(".view-more-section").classList.remove("show-view-more")
    }

    // If there are enough results to be loaded in a single try,
    // OR If the total number of results is low enough to be loaded without issues
    // Then show the view-all-button
    if(REMAINING_RESULTS != 0 && (REMAINING_RESULTS <= MAX_RESULT_COUNT || TOTAL_RESULTS < 300)) {
        document.querySelector(".view-more-section").classList.add("show-view-all")
        document.querySelector(".view-all-button__count").innerText = `[+${REMAINING_RESULTS}]`
    }
    else {
        document.querySelector(".view-more-section").classList.remove("show-view-all")
    }
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

function scorer_id(query, id) {
    query = query.toUpperCase()
    if(id.includes(query)) {
        return [query.length, query.length, id.indexOf(query)]
    }
    return [0, 0, 0]
}

function scorer_room(query, room) {
    if(room == query) {
        return [3, 3, 0]
    }
    return [0, 0, 0]
}

function scorer_phone(query, phone) {
    if(phone.includes(query)) {
        return [1, 0, 0]
    }
    return [0, 0, 0]
}