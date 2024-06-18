#!/usr/bin/env node
import { checkDomainAvailability } from "../lib/domain-checker.js";

async function checkDomain(domain) {
    if (!domain) {
        console.log("Please provide a domain to check.");
        return;
    }

    try {
      console.log(await checkDomainAvailability(domain));
    } catch (error) {
        console.error("An error occurred:", error.message);
    }
}

const domain = process.argv[2];  // Get domain from command line argument
checkDomain(domain);