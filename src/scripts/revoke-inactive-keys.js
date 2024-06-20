import { keystore, saveKeystore } from '../api/auth/auth-module.js';

const daysInactive = parseInt(process.argv[2]);

console.log(daysInactive);

function revokeInactiveKeys(days) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);

  for (const [key, value] of Object.entries(keystore)) {
    const lastAccessedDate = new Date(value.lastAccessed);
    if (lastAccessedDate < thresholdDate && value.status > 0) {
      keystore[key].status = -1;
    }
  }
  saveKeystore();
}

revokeInactiveKeys(daysInactive);