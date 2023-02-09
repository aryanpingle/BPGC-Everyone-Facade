let cachedWords = []
let cachedQuery = ""

/**
 * Matches a query to the given text and returns its score
 * @param {string} text
 * @returns {number[]} List of 3 scores - [number of character matches, longest common substring, start index of LCS]
 */
export function scorer_name(query, text, flag) {
    if(flag == undefined) {
        let queryWords = (query==cachedQuery) ? cachedWords : query.split(" ")

        // If query is only one word
        if(queryWords.length != 2) return scorer_name(query, text, 1)

        if(query != cachedQuery) {
            cachedQuery = query
            cachedWords = queryWords
        }

        const [w1, w2] = queryWords

        let s1 = scorer_name(`${w1} ${w2}`, text, 1)
        let s2 = scorer_name(`${w2} ${w1}`, text, 1)

        // Maximize character matches
        switch(Math.sign(s1[0] - s2[0])) {
            case 1: return s1;
            case -1: return s2;
            // Maximize LCS length
            default: switch(Math.sign(s1[1] - s2[1])) {
                case 1: return s1;
                case -1: return s2;
                // Minimize start index of LCS
                default: return s1[2] > s2[2] ? s2 : s1;
            }
        }
    }

    // Since query is empty just match everything with the same score
    if(query.length == 0) {
        return [1, 0, 0]
    }

    // Make the text lowercase
    text = text.toLowerCase()

    let queryIndex = 0 // points to an index in `query`

    let LCSLength_MAX = 0
    let LCSStartIndex_MIN = 0
    
    let LCSLength = 0
    let LCSStartIndex = 0

    for(let textIndex = 0; textIndex < text.length; ++textIndex) {
        if(text.charAt(textIndex) == query.charAt(queryIndex)) {
            /* Loop behind to see how consecutive this region is */

            LCSLength = 1
            LCSStartIndex = textIndex - 1

            // Keep moving one index behind as long as you can match the region in `query`
            while(LCSStartIndex >= 0 && text.charAt(LCSStartIndex) == query.charAt(queryIndex - (textIndex - LCSStartIndex))) {
                ++LCSLength
                --LCSStartIndex
            }

            // Maximise consecutive length first, then minimize the starting position
            if((LCSLength_MAX < LCSLength) || (LCSLength_MAX == LCSLength && LCSStartIndex_MIN > LCSStartIndex)) {
                LCSLength_MAX = LCSLength
                LCSStartIndex_MIN = LCSStartIndex
            }

            // Advance the query index pointer
            ++queryIndex

            // If the entire query has been matched, exit the loop
            if(queryIndex == query.length) break
        }
    }
    
    if(queryIndex == query.length) {
        return [queryIndex, LCSLength_MAX, LCSStartIndex_MIN]
    }
    else return [0, 0, 0]
}

export function scorer_id(query, id) {
    query = query.toUpperCase()
    if(id.includes(query)) {
        return [query.length, query.length, id.indexOf(query)]
    }
    return [0, 0, 0]
}

export function scorer_room(query, room) {
    if(room == query) {
        return [3, 3, 0]
    }
    return [0, 0, 0]
}

export function scorer_phone(query, phone) {
    if(phone.includes(query)) {
        return [1, 0, 0]
    }
    return [0, 0, 0]
}