///////////////////////////////////
//       Suck it WorkBoxJS       //
//                               //
//    This is the best(er)(er)   //
//  service worker on the planet //
///////////////////////////////////

import APP_VERSION from "inject:APP_VERSION"

// Document Cache is a cache of document files - html, js, css, etc
const CACHE_NAME = `CACHE-v${APP_VERSION.substring(0, APP_VERSION.lastIndexOf("."))}`

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
    log("Service Worker activated")
    // Remove obsolete caches
    event.waitUntil((async () => {
        await clients.claim()
        await delete_obsolete_caches()
    })())
});

async function delete_obsolete_caches() {
    let cache_names = await caches.keys()
    await Promise.all(cache_names.map(cache_name => {
        if(cache_name != CACHE_NAME) {
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

    if(url.includes("gtag") || url.includes("analytic")) {
        return fetch(request)
    }
    
    const cache = await caches.open(CACHE_NAME)

    if(url.endsWith(".html")) {
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
 * Returns true or false if the response headers says it is older than 1 day or not respectively
 */

function isCachedResponseExpired(response) {
    let fetched_on = response.headers.get("sw-fetched-on")
    if(!fetched_on) return true
    
    // Basically, 1 day
    const TIMEOUT_IN_MS = 24 * 3600 * 1000

    if(new Date().getTime() - parseFloat(fetched_on) >= TIMEOUT_IN_MS) return true

    return false
}