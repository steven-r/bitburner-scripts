/** @param {NS} ns */
export async function main(ns) {
	const ms = ns.getTimeSinceLastAug();
	ns.tprintf("%s", ns.tFormat(ms));
}
