import natural from 'natural';

const WordNet = natural.WordNet;
const wordnet = new WordNet();

/**
 * Note: This was an experiment. The new syn tool can be used instead.
 */

// Function to lookup synonyms using WordNet
export function lookupSynonyms(word) {
    return new Promise((resolve, reject) => {
        wordnet.lookup(word, (results) => {
            const synonyms = new Set();  // Use a Set to avoid duplicate entries
            results.forEach(result => {
                result.synonyms.forEach(syn => {
                    if (syn !== word) {  // Avoid including the search term itself
                        synonyms.add(syn);
                    }
                });
            });
            resolve(Array.from(synonyms));  // Convert Set to Array
        });
    });
}