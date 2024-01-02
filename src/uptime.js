/** @param {NS} ns */
export async function main(ns) {
	const lastReset = ns.getResetInfo().lastAugReset;
	if (lastReset == -1) {
	  ns.tprintf("WARNING: You never added any augmentions until now.");
	  return;
	}
	  const ms = Date.now() - lastReset;
	  ns.tprintf("%s", ns.tFormat(ms));
  }
  