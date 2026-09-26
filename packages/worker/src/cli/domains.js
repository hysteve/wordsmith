#!/usr/bin/env node
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk'
import { Spinner } from 'cli-spinner';
import { checkAndRecommend } from '@wordsmith/core/scrapers/domains.js';
import { promptForCategories } from './lib/multi-select.js';
import { lookupSynonyms } from '@wordsmith/core/lib/lookup-synonyms.js';
import { fetchDatamuseWords } from '@wordsmith/core/lib/datamuse-api.js';

const argv = yargs(hideBin(process.argv))
    .command('$0 <domain>', 'Check and recommend domains based on the provided domain', (yargs) => {
        yargs.positional('domain', {
            describe: 'The base domain to check',
            type: 'string'
    })
})
.option('categories', {
    alias: 'c',
    describe: 'Categories to generate domains from',
    type: 'array',
})
.option('suggestions', {
    alias: 's',
    describe: 'Number of domain suggestions to generate',
    type: 'number',
    default: 10
})
.option('maxTries', {
    alias: 'm',
    describe: 'Maximum number of generation attempts',
    type: 'number',
    default: 50
})
.option('timeout', {
    alias: 't',
    describe: 'Timeout in milliseconds',
    type: 'number',
    default: 30000  // 30 seconds
})
.option('outputPath', {
    alias: 'o',
    describe: 'Output dir for screenshots, etc; also for available domains file',
    type: 'string',
    default: './output/'
})
.option('use-synonyms', {
    alias: 'Y',
    describe: 'Generate domain names using synonyms of the main keyword',
    type: 'boolean',
    default: false
  })
.option('use-same-start', {
    alias: 'S',
    describe: 'Generate domain names using words starting with same letter',
    type: 'boolean',
    default: false
  })
  .option('use-triggers', {
    alias: 'T',
    describe: 'Generate domain names using trigger words of the main keyword',
    type: 'boolean',
    default: false
  })
  .option('use-followers', {
    alias: 'F',
    describe: 'Generate domain names using common follower words of the main keyword',
    type: 'boolean',
    default: false
  })
  .option('use-follow-suffix', {
    alias: 'E',
    describe: 'Generate domain names using common follower words of the main keyword',
    type: 'boolean',
    default: false
  })
.help()
.alias('help', 'h')
.argv;

let categories = argv.categories;
if (!categories || categories.length === 0) {
    categories = await promptForCategories();
}

let words = [];
let prefixWords = [];
let suffixWords = [];
if (argv.useSynonyms) {
    // This doesnt work very well
    console.log('useSynonyms')
    const result = await lookupSynonyms(argv.domain);
    console.log(result);
    words.push(...result);
}
if (argv.useTriggers) {
    console.log('useTriggers')
    words.push(...(await fetchDatamuseWords(argv.domain, 'rel_trg')));
}
if (argv.useSameStart) {
    console.log('useSameStart')
    suffixWords.push(...(await fetchDatamuseWords(argv.domain, '', `sp=${argv.domain[0]}\]`)));
}
if (argv.useFollowers) {
    console.log('useFollowers')
    suffixWords.push(...(await fetchDatamuseWords(argv.domain, 'rel_bga')));
    prefixWords.push(...(await fetchDatamuseWords(argv.domain, 'rel_jjb')));
    suffixWords.push(...(await fetchDatamuseWords(argv.domain, 'rel_jja')));
    }
if (argv.useFollowSuffix) {
    console.log('useFollowSuffix');
    prefixWords.push(...(await fetchDatamuseWords(argv.domain, 'lc')));
}

console.log('Generated Domain Ideas:', words, prefixWords, suffixWords);

const spinner = new Spinner(chalk.blue('Checking domain availability... %s'));
spinner.setSpinnerString('|/-\\');
spinner.start();

/** The service reports what it finds; rendering it is the CLI's job. */
function render(event) {
    spinner.stop(true);
    if (event.type === 'base') {
        if (event.available === true) {
            console.log(chalk.green('Available: ') + event.domain);
        } else if (event.available === false) {
            console.log(chalk.red(`Unavailable: ${event.domain}`));
            console.log(chalk.green('Available Variations:'));
        } else {
            // WHOIS did not answer — usually rate-limiting. Say so rather than
            // implying the name is taken.
            console.log(chalk.yellow(`Could not check ${event.domain}: ${event.reason}`));
            console.log(chalk.green('Available Variations:'));
        }
    } else if (event.type === 'suggestion') {
        console.log(`  ${event.index}. ${event.domain}`);
    } else if (event.type === 'done') {
        if (event.stoppedBecause === 'maxTries') {
            console.log(chalk.red('Maximum number of tries reached without fulfilling all suggestions.'));
        } else if (event.stoppedBecause === 'timeout') {
            console.log(chalk.yellow('Timed out before finding all suggestions.'));
        }
        if (event.count === 0) {
            console.log(chalk.yellow('No new available domains were found. This might be a high-value domain area.'));
        } else {
            console.log(chalk.green('Domain checking complete.'));
        }
        return;
    }
    spinner.start();
}

await checkAndRecommend(argv.domain, {
    categories,
    maxSuggestions: argv.suggestions,
    maxTries: argv.maxTries,
    timeout: argv.timeout,
    outputPath: argv.outputPath,
    onProgress: render,
});