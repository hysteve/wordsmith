#!/usr/bin/env node
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk'
import { Spinner } from 'cli-spinner';
import { checkDomainAvailability } from '../lib/domain-checker.js';
import { generateRandomDomain, updateCache, loadUnavailableDomains, loadAvailableDomains } from '../lib/domain-generator.js';
import { promptForCategories } from '../lib/cli-multi-select.js';
import { lookupSynonyms } from '../lib/lookup-synonyms.js';
import { fetchDatamuseWords } from '../lib/datamuse-api.js';

async function checkAndRecommend(domain, categories, maxSuggestions, maxTries, timeout, outputPath) {
    if (!domain.includes('.')) {
        domain += '.com';
    }

    const suggestions = [];
    let tries = -1;
    const startTime = Date.now();
    const spinner = new Spinner(chalk.blue('Checking domain availability... %s'));
    spinner.setSpinnerString('|/-\\');
    spinner.start();

    if ((await checkDomainAvailability(domain)).available) {
        spinner.stop(true);
        console.log(chalk.green(`Available: `) + domain);
        spinner.start();
    } else {
        spinner.stop(true);
        console.log(chalk.red(`Unavailable: ${domain}`));
        console.log(chalk.green(`Available Variations:`));
        spinner.start();
    }

    const unavailableDomains = loadUnavailableDomains(outputPath);
    const availableDomains = loadAvailableDomains(outputPath);

    while (suggestions.length < maxSuggestions && (Date.now() - startTime) < timeout) {
        if (tries >= maxTries) {
            spinner.stop(true);
            console.log(chalk.red("Maximum number of tries reached without fulfilling all suggestions."));
            break;
        }

        const randomDomain = generateRandomDomain(domain.replace(/\..*$/, ''), categories);
        if (unavailableDomains.has(randomDomain)) continue;
        tries++;

        let availability = await checkDomainAvailability(randomDomain);
        if (availability.available) {
            if (!availableDomains.has(randomDomain)) {
                suggestions.push(randomDomain);
                spinner.stop(true);
                console.log(`  ${suggestions.length}. ${randomDomain}`);
                spinner.start();
                updateCache(randomDomain, './available_domains.json', availableDomains);
            }
        } else {
            updateCache(randomDomain, './unavailable_domains.json', unavailableDomains);
        }
    }

    spinner.stop(true);
    if (suggestions.length === 0) {
        console.log(chalk.yellow("No new available domains were found. This might be a high-value domain area."));
    } else {
        console.log(chalk.green("Domain checking complete."));
    }
}

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
    type: 'number',
    default: './output/'  // 30 seconds
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

checkAndRecommend(argv.domain, categories, argv.suggestions, argv.maxTries, argv.timeout, argv.outputPath);