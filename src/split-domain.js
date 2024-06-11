import { Command } from 'commander';
import nlp from 'compromise';

function splitDomain(domain) {
  // Remove the TLD
  const tldRemoved = domain.replace(/\..*$/, '');

  let segments = [];
  let currentWord = '';

  // Iterate through each character in the domain name
  for (let i = 0; i < tldRemoved.length; i++) {
      currentWord += tldRemoved[i];
      // Temporary word with the next character
      let nextChar = tldRemoved[i + 1] || '';
      let tempWord = currentWord + nextChar;

      // Analyze both the current and temporary words
      let currentAnalysis = nlp(currentWord).out('freq');
      let tempAnalysis = nlp(tempWord).out('freq');

      // If the frequency significantly drops with the addition of a new character, or there's no next character
      if ((currentAnalysis.length > 0 && tempAnalysis.length === 0) || !nextChar) {
          segments.push(currentWord);
          currentWord = '';
      }
  }

  // Catch any leftover characters as a final word
  if (currentWord) {
      segments.push(currentWord);
  }

  return segments;
}
// console.log(splitDomain("gofundme.com")); // ["go", "fund", "me"]
// console.log(splitDomain("financebook.com")); // ["finance", "book"]

// Set the args for the cli script
const program = new Command();
program
  .name("split-domains")
  .description("Split a domain into words")
  .argument("<domain>", "domain to split")
  // .option("-a, --ads", "Use ads")
  .action(async (domain) => {
    const result = await splitDomain(domain);
    console.log(result);
  });

program.parse(process.argv);
