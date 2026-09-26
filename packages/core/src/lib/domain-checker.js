import whois from 'whois-json';

export async function checkDomainAvailability(domain, retries = 3) {
    while (retries > 0) {
        try {
            const result = await whois(domain);
            if (result && (result.domainName || result.registrar || result.status)) {
                return { available: false };
            } else {
                return { available: true };
            }
        } catch (error) {
            console.log(`Error checking domain ${domain}: ${error.message}`);
            if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.message.includes('getaddrinfo')) {
                retries--;
                if (retries > 0) {
                    console.log(`Retrying... (${retries} retries left)`);
                    continue;
                } else {
                    console.log(`Failed to contact WHOIS server for ${domain}. Please check your network connection.`);
                }
            } else {
                console.log(`An unexpected error occurred. No more retries for ${domain}.`);
            }
        }
        break;
    }
    return { available: undefined };
}