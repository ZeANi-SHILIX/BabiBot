const { proto, makeInMemoryStore } = require('@adiwajshing/baileys')
const { pino } = require("pino");

const logger = pino();
logger.level = "silent";

const store = makeInMemoryStore({ logger });
store?.readFromFile("./baileys_store_multi.json");
// save every 10s
setInterval(() => {
    store?.writeToFile("./baileys_store_multi.json");
}, 10_000);

module.exports = {
    store,
    logger
}