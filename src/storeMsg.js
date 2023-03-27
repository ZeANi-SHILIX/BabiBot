const { proto, makeInMemoryStore } = require('@adiwajshing/baileys')
const { pino } = require("pino");
const fs = require("fs");

/**
 * this sock is updating while getting messages
 * @type {import('@adiwajshing/baileys').WASocket} 
*/
let GLOBAL_SOCK;

const logger = pino();
logger.level = "silent";

const store = makeInMemoryStore({ logger });
store?.readFromFile("./baileys_store_multi.json");
// save every 10s
setInterval(() => {
    store?.writeToFile("./baileys_store_multi.json");
}, 10_000);

/**
 * @type {{id:{countusers: number, spam: string}}}}
 */
const groupConfig = {};
readConfig();

setInterval(() => {
    saveConfig();
}, 10_000);

function readConfig() {
    if (!fs.existsSync("./groupConfig.json")) {
        console.log("Group Config file not found");
        return;
    }

    const data = fs.readFileSync("./groupConfig.json");
    const json = JSON.parse(data);
    Object.assign(groupConfig, json);
}

function saveConfig() {
    fs.writeFileSync("./groupConfig.json", JSON.stringify(groupConfig));
    console.log("Group Config saved");
}

module.exports = {
    store,
    logger,
    groupConfig,
    GLOBAL_SOCK
}