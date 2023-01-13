///////////////////////////////////
//       Suck it WorkBoxJS       //
//                               //
//    This is the best(er)(er)   //
//  service worker on the planet //
///////////////////////////////////

import APP_VERSION from "inject:APP_VERSION"

// Document Cache is a cache of document files - html, js, css, etc
const CACHE_NAME = `CACHE-v${APP_VERSION.substring(0, APP_VERSION.lastIndexOf("."))}`
const EVERYONE_CACHE_NAME = `EVERYONE-CACHE`

// Custom extensions
String.prototype.endsWithAny = function (...ends) {
    return ends.some(end => this.endsWith(end))
}
String.prototype.containsAny = function (...strings) {
    return strings.some(string => this.includes(string))
}

// For Debugging
const IS_TESTING = self.registration.scope.includes("127.0.0.1") || self.registration.scope.includes("localhost")
const STOP_CACHING = 1 && IS_TESTING
const log = (text, color="white") => IS_TESTING ? console.log(`%c${text}`, `color: black; background-color: ${color};`) : ""

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        await self.skipWaiting()
    })())
});

self.addEventListener("activate", event => {
    console.log("Service Worker activated")
    // Remove obsolete caches
    event.waitUntil((async () => {
        await clients.claim()
        await delete_obsolete_caches()
    })())
});

async function delete_obsolete_caches() {
    let cache_names = await caches.keys()
    await Promise.all(cache_names.map(cache_name => {
        // IF this is not the cache associated with the current version
        // and not the cache holding the 'everyone data'
        // THEN delete it
        if(cache_name != CACHE_NAME && (cache_name != EVERYONE_CACHE_NAME)) {
            log(`Deleting obsolete cache: '${cache_name}'`, "rgb(255, 128, 128)")
            return caches.delete(cache_name)
        }
    }))
    // Delete expired cached files
    const cache = await caches.open(CACHE_NAME)
    await cache.keys().then(requests => {
        return Promise.all(requests.map(async request => {
            let cached_response = await cache.match(request)
            if(isCachedResponseExpired(cached_response)) {
                console.log(`%cDeleting expired file%c: ${request.url}`, "color: black; background-color: hsl(0, 100%, 75%); font-weight: 900;", "")
                return await cache.delete(request)
            }
            else {
                console.log(`%cFile is ok%c: ${request.url}`, "color: black; background-color: cyan; font-weight: 900;", "")
                return
            }
        }))
    })
}

self.addEventListener("fetch", request_event => {
    request_event.respondWith(STOP_CACHING ? fetch(request_event.request) : get_request(request_event))
});

async function get_request(request_event) {
    const request = request_event.request
    const url = request.url

    // Clear the EVERYONE_CACHE
    // Only used in extreme situations like deadlocks
    // Example: When the data isn't updated and a non-existent field is being read
    if(url.includes("DROPTABLE")) {
        const cache = await caches.open(EVERYONE_CACHE_NAME)
        const cache_requests = await cache.keys()
        await Promise.all(cache_requests.map(r => cache.delete(r)))
        
        return new Response(0, {
            status: 200
        })
    }

    // For some files, there should be no caching
    if(url.containsAny(
        "/gsi/",
        "gtag",
        "analytic",
        "screenshots/",
        "version.txt",
        "changelog.json",
        "livereload",
        "notifications.json",
        "googleusercontent"
    )) {
        return fetch(request)
    }

    if(url.includes("/everyone/")) {
        return handleEveryoneDataRequest(request)
    }
    
    const cache = await caches.open(CACHE_NAME)

    if(url.endsWith(".html") || url.endsWith("/")) {
        // HTML File -> Send cache, fetch in background
        const cache_match = await cache.match(request)
        if(cache_match) {
            fetch(request).then(data => {
                cache_with_headers(cache, request, data)
            })
            return cache_match
        }
        
        return await fetch(request).then(data => {
            cache_with_headers(cache, request, data)
            return data
        })
    }

    // For top-secret, temp stuff
    if(url.includes("swd")) {
        return fetch(request)
    }

    // Straight up cached resources
    
    const cache_match = await cache.match(request)

    if(cache_match) {
        cache_with_headers(cache, request, cache_match)
        return cache_match
    }
    
    return await fetch(request).then(data => {
        cache_with_headers(cache, request, data)
        return data
    })
}

async function handleEveryoneDataRequest(request) {
    const EVERYONE_CACHE = await caches.open(EVERYONE_CACHE_NAME)
    const requestMethod = request.method

    const cache_match = await EVERYONE_CACHE.match(request)

    // 3 conditions for doing a network request:
    // 1. If the request is a POST request
    // 2. If there is nothing in the cache
    // 3. If a server error is cached instead of the actual data
    if(requestMethod == "POST" || !cache_match || cache_match.status == 400) {
        // Network Request + Cache
        return await fetch(request.url).then(response => {
            const response_clone = response.clone()
            EVERYONE_CACHE.put(new Request(request.url), response_clone)
            return response
        })
    }

    return cache_match
}

/**
 * Caches a file with a 'sw-fetched-on' header
 * @param {Cache} cache 
 * @param {Request} request 
 * @param {Response} response 
 */

async function cache_with_headers(cache, request, response) {
    // Clone the response so we can work with it freely
    response = response.clone()

    const headers = new Headers(response.headers)
    if(request.url.includes("/everyone/")) {
        headers.set("sw-fetched-on", (new Date().getTime()) + 1000 * 60 * 60 * 24 * 100)
    }
    else {
        headers.set("sw-fetched-on", new Date().getTime())
    }

    let response_body = await response.blob()
    await cache.put(request, new Response(response_body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
    }))
}

/**
 * Returns true or false if the response headers says it is older than 15 days or not respectively
 */

function isCachedResponseExpired(response) {
    let fetched_on = response.headers.get("sw-fetched-on")
    if(!fetched_on) return true
    
    // Basically, 15 days
    const TIMEOUT_IN_MS = 15 * 24 * 3600 * 1000

    if(new Date().getTime() - parseFloat(fetched_on) >= TIMEOUT_IN_MS) return true

    return false
}