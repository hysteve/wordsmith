import { filterStopWords } from '../data/common-words.js';

const DATAMUSE_MAX = 10
export async function fetchDatamuseWords(mainKeyword, relParam, specificQuery = '') {
    const baseUrl = `https://api.datamuse.com/words?max=${DATAMUSE_MAX}&`;
    const query = specificQuery || `${relParam}=${mainKeyword}`;
    const response = await fetch(`${baseUrl}${query}`);
    const data = await response.json();
    const resultWords = data.map(wordObj => wordObj.word).filter(filterStopWords);
    console.log(resultWords);
    return resultWords;
}