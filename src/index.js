"use strict"

import IS_DEV from "inject:IS_DEV"

setup()

async function setup() {
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

    fetch("./search.html")
    
    setupPWAGuide()
}

async function setupFontLoad() {
    // Wait for the service worker to activate
    await navigator.serviceWorker.ready

    await fetch("./static/fonts/Inconsolata.woff2")
    
    // After the font loads, add the CSS font family to document.head
    let css = "<style>"
    for(const weight of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
        css += `
        @font-face {
            font-family: 'Inconsolata';
            font-style: normal;
            font-display: swap;
            font-weight: ${weight};
            src: url(./static/fonts/Inconsolata.woff2) format('woff2');
        }
        `.trim().replace(/\n\s*/g, "")
    }
    css += "</style>"

    document.head.innerHTML += css
    
    document.documentElement.classList.add("font-loaded")
}

function setupPWAGuide() {
    const ua = navigator.userAgent
    let install_text = ""
    if (ua.match(/samsungbrowser/i)) {
        // Fkin Samsung Internet
        install_text = "Download button (near URL)"
    }
    else if(ua.match(/chrome|chromium|crios/i)) {
        // Chrome
        install_text = "Options > Install App"
    }
    else if(ua.match(/firefox|fxios/i)) {
        // Firefox
        install_text = "Options > Install App"
    }
    else if(ua.match(/safari/i)) {
        // Safari
        install_text = "Share > Add to Home Screen"
    }
    else if(ua.match(/opr\//i)) {
        // Opera
        install_text = "IDK figure it out, who tf uses Opera"
    }
    else if(ua.match(/edg/i)) {
        // Edge
        install_text = "Options > Install App"
    }
    else {
        // Unknown / Unsupported Browser
    }

    document.querySelector("#pwa-install-guide").innerText = install_text
}