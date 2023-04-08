import { log, getConfiguration, instanceCount, getNsDataThroughFile } from './helpers.js'
import { PrintTable, ColorPrint, DefaultStyle, ALIGN_RIGHT} from 'table-helper.js';
// print information about used memory for all servers

const purchasedServerName = "daemon"; // The name to give all purchased servers. Also used to determine which servers were purchased

let show = [];
//let showSummary;

// The following globals are set via command line arguments specified below, along with their defaults
let keepRunning = false;

let options;
const argsSchema = [
    ['c', false], // Set to true to run continuously
    ['run-continuously', false], // Long-form alias for above flag
    ['interval', 10000], // Update interval (in milliseconds) when running continuously
    ['verbose', false], // show more information
    ['show', ['system', 'own', 'hacknet', 'home']], // cluster server information
    ['servers', []], // select specific servers (empty is all)
    ['used-only', true], // show only used servers
    ['show-summary', true], // show summary header
];

export function autocomplete(data, args) {
    data.flags(argsSchema);
    const lastFlag = args.length > 1 ? args[args.length - 2] : null;
    if (["--servers"].includes(lastFlag))
        return data.servers;
    return [];
}


/**
 * @param {string} srv 
 * @returns {string}
*/
function getServerType(srv) {
    let type = 'system';
    if (srv.startsWith('hacknet-')) {
        type = 'hacknet';
    } else if (srv.startsWith(purchasedServerName)) {
        type = 'own';
    } else if (srv === 'home') {
        type = 'home';
    }
    return type;
}

/**
 * @param {NS} ns 
 * @returns {Promise<Server[]>} **/
async function getAllServersInfo(ns) {
    const serverNames = await getNsDataThroughFile(ns, 'scanAllServers(ns)', '/Temp/scanAllServers.txt');
    return await getNsDataThroughFile(ns, 'ns.args.map(ns.getServer.bind(ns))', '/Temp/getServers.txt', serverNames);
}

/** 
 * @param {NS} ns 
 * @returns {Promise<MemServer[]>}
 */
async function getServerList(ns) {
    const memServers = [];
    const servers = await getAllServersInfo(ns);
    servers.forEach(server => {
        if (!server.hasAdminRights) {
            return;
        }
        const type = getServerType(server.hostname);
        if (show.includes(type)) {
            memServers.push({
                server: server,
                name: server.hostname,
                maxRam: server.maxRam,
                ramUsed: server.ramUsed,
                percent: server.ramUsed / server.maxRam,
                type: type,
                disabled: false
            });
        }
    });
    return memServers;
}

/** @param {NS} ns **/
export async function main(ns) {
    const runOptions = getConfiguration(ns, argsSchema);
    if (!runOptions || await instanceCount(ns) > 1) return; // Prevent multiple instances of this script from being started, even with different args.
    options = runOptions; // We don't set the global "options" until we're sure this is the only running instance
    //    ns.disableLog('ALL')

    show = options.show;
    keepRunning = options.c || options['run-continuously'];
    // Start the main loop (or run once)
    if (!keepRunning) {
        log(ns, `memdump will run once. Run with argument "-c" to run continuously.`)
    }
    do {
        const memServers = await getServerList(ns);
        const emptyServers = memServers.filter(server => server.ramUsed == 0);
        const data = memServers.filter(srv => srv.ramUsed > 0).map(server => [
            server.name,
            ns.formatRam(server.maxRam), 
            ns.formatRam(server.ramUsed),
            ns.formatPercent(server.ramUsed / server.maxRam)
        ]);
        //const stats = getStats(ns, memServers);
        const emptyLen = emptyServers.length;
        if (emptyLen > 0) { 
            const emptyMaxMem = emptyServers.reduce((emptyMax, server) => emptyMax+server.maxRam, 0);
            data.push([`${emptyLen} other servers`, 
                ns.formatRam(emptyMaxMem), "--", "--"]);
        }
        const columns = [
            { header: 'Host', width: 20 },
            { header: 'Ram', width: 10, pad: 1, align: ALIGN_RIGHT},
            { header: 'Used', width: 10, pad: 1, align: ALIGN_RIGHT},
            { header: '%', width: 10, pad: 1, align: ALIGN_RIGHT},
        ];
        const [totalMax, totalUsed] = memServers.reduce(([totalMax, totalUsed], s) => [totalMax + s.maxRam, totalUsed + s.ramUsed], [0, 0]);
        data.push("---"); // seperator
        data.push([
            "Total",
            ns.formatRam(totalMax), 
            ns.formatRam(totalUsed),
            ns.formatPercent(totalUsed / totalMax)
        ]);

        PrintTable(ns, data, columns, DefaultStyle(), ColorPrint);
        if (keepRunning)
            await ns.sleep(options['interval']);
    } while (keepRunning);
}