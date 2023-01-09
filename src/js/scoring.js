/**
 * Matches a query to the given text and returns its score
 * @returns {number[]} List of 3 scores - [number of character matches, longest common substring, start index of LCS]
 */

export function scorer_name(query, text) {
    // Since query is empty just match everything with the same score
    if(query.length == 0) {
        return [1, 0, 0]
    }

    // Make the text lowercase
    text = text.toLowerCase()

    let queryIndex = 0 // points to an index in `query`
    let consec = [0, 0] // [<LCS length>, <start index of LCS>]
    let max_consec = [0, 0] // Best consec (max LCS length; min LCS start index)

    for(let textIndex = 0; textIndex < text.length; ++textIndex) {
        if(text.charAt(textIndex) == query.charAt(queryIndex)) {
            // Make a buffer consec value
            // This will be compared to max_consec after calculation
            consec = [1, textIndex]

            /* Loop behind to see how consecutive this region is */

            let startIndexLCS = textIndex - 1

            // Keep moving one index behind as long as you can match the region in `query`
            while(startIndexLCS >= 0 && text.charAt(startIndexLCS) == query.charAt(queryIndex - (textIndex - startIndexLCS))) {
                ++consec[0]
                consec[1] = startIndexLCS
                
                --startIndexLCS
            }

            // Maximise consecutive length first, then minimize the starting position
            if((max_consec[0] < consec[0]) || (max_consec[0] == consec[0] && max_consec[1] > consec[1])) {
                max_consec = consec
            }

            // Advance the query index pointer
            ++queryIndex

            // If the entire query has been matched, exit the loop
            if(queryIndex == query.length) break
        }
    }
    
    if(queryIndex == query.length) {
        return [queryIndex, ...max_consec]
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