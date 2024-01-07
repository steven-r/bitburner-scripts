import { NS, Server } from '@ns';
import { log, getConfiguration, instanceCount, getNsDataThroughFile } from './helpers_ts.js'
import { PrintTable, ColorPrint, DefaultStyle, ALIGN_RIGHT} from 'table-helper.js';
// print information about used memory for all servers

const purchasedServerName = "daemon"; // The name to give all purchased servers. Also used to determine which servers were purchased

let show: string[] = [];
//let showSummary;

// The following globals are set via command line arguments specified below, along with their defaults
let keepRunning = false;

let options;
const argsSchema: [string, string | number | boolean | string[]][] = [
    ['c', false], // Set to true to run continuously
    ['run-continuously', false], // Long-form alias for above flag
    ['interval', 10000], // Update interval (in milliseconds) when running continuously
    ['verbose', false], // show more information
    ['show', ['own', 'hacknet']], // cluster server information
    ['servers', []], // select specific servers (empty is all)
    ['used-only', true], // show only used servers
    ['show-summary', true], // show summary header
];

export function autocomplete(data: any, args: any) {
    data.flags(argsSchema);
    const lastFlag = args.length > 1 ? args[args.length - 2] : null;
    if (["--servers"].includes(lastFlag))
        return data.servers;
    return [];
}


/**
 * @param {Server} srv 
 * @returns {string}
*/
function getServerType(srv: Server): string {
    let type = 'system';
    if (srv.hostname.startsWith('hacknet-')) {
        type = 'hacknet';
    } else if (srv.hostname === 'home') {
        type = 'home';
    } else if (srv.purchasedByPlayer) {
        type = 'own';
    }
    return type;
}

/**
 * @param {NS} ns 
 * @returns {} **/
async function getAllServersInfo(ns: NS): Promise<Server[]> {
    const serverNames = await getNsDataThroughFile(ns, 'scanAllServers(ns)', '/Temp/memDump.scanAllServers.txt');
    return await getNsDataThroughFile(ns, 'ns.args.map(ns.getServer.bind(ns))', '/Temp/memDump.getServers.txt', serverNames);
}

interface MemServer extends Server {
    order: number;
    type: string;
}
/** 
 * @param {NS} ns 
 * @returns {Promise<MemServer[]>}
 */
async function getServerList(ns: NS): Promise<MemServer[]> {
    const memServers: MemServer[] = [];
    const servers = await getAllServersInfo(ns);
    servers.forEach(server => {
        if (!server.hasAdminRights) {
            return;
        }
        const type = getServerType(server);
        if (show.includes(type)) {
            const ms: MemServer = server as MemServer;
            ms.type = type;
            let m = ms.hostname.match(/-(\d+)$/);
            if (m) {
                ms.order = Number.parseInt(m[1]);
            } else {
                ms.order = -1;
            }
            memServers.push(ms);
        }
    });
    return memServers;
}

/** @param {NS} ns **/
export async function main(ns: NS) {
    const runOptions = getConfiguration(ns, argsSchema);
    if (!runOptions || await instanceCount(ns) > 1) return; // Prevent multiple instances of this script from being started, even with different args.
    options = runOptions; // We don't set the global "options" until we're sure this is the only running instance
    //    ns.disableLog('ALL')

    show = options.show as string[];
    keepRunning = options.c as boolean || options['run-continuously'] as boolean;
    // Start the main loop (or run once)
    if (!keepRunning) {
        log(ns, `memdump will run once. Run with argument "-c" to run continuously.`)
    }
    do {
        const memServers = await getServerList(ns);
        const data: (string|string[])[] = memServers
            .sort((a, b) => {
                const _a = a.type, _b = b.type;
                if (_a < _b) return -1;
                else if (_a == _b) return a.order - b.order;
                return 1;
            })
            .map(server => [
            server.hostname,
            server.ip,
            ns.formatRam(server.maxRam, 0), 
            ns.formatNumber(server.cpuCores, 0, undefined, true),
            server.type
        ]);
        const columns = [
            { header: 'Host', width: 20 },
            { header: 'IP', width: 10, pad: 1, align: ALIGN_RIGHT },
            { header: 'Ram', width: 10, pad: 1, align: ALIGN_RIGHT },
            { header: 'Cores', width: 10, pad: 1, align: ALIGN_RIGHT },
            { header: 'type', width: 10, pad: 1, align: ALIGN_RIGHT }
        ];
        PrintTable(ns, data, columns, DefaultStyle(), ColorPrint);
        if (keepRunning)
            await ns.sleep(options['interval'] as number);
    } while (keepRunning);
}