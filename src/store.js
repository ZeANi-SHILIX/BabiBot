import { makeInMemoryStore } from '@adiwajshing/baileys'
import { pino } from "pino";
import fs from "fs";
import os from "os";

/**
 * custom store for baileys
 */
class MemoryStore {
    constructor() {

        fs.existsSync("./store") || fs.mkdirSync("./store");
        this.basePath = "./store/baileys_store_"; // + date + "_" + hour + ".json";

        this.logger = pino();
        this.logger.level = "silent";

        const { date, hour } = this.getTime();
        this.currentDate = date;
        this.currentTime = hour;
        this.path = "./store/baileys_store_" + date + "_" + hour + ".json";

        this.store = makeInMemoryStore({ logger: this.logger });

        this.store.readFromFile(this.path);

        setInterval(() => {
            // check server load
            const { avg1min, memUsage } = getServerLoad();

            console.log("CPU Average (1 min): " + avg1min);
            console.log("Memory Usage: " + memUsage.toFixed(1) + "%");

            const { date, hour } = this.getTime();
            if (hour !== this.currentTime) {
                this.store.writeToFile(this.path);

                this.currentDate = date;
                this.currentTime = hour;
                this.path = "./store/baileys_store_" + date + "_" + hour + ".json";

                for (const id of Object.keys(this.store.messages)) {
                    this.store.messages[id].clear();
                }
            }
            else {
                this.store.writeToFile(this.path);
            }
        }, 10000)
    }

    getTime() {
        const date = new Date();
        return {
            date: date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate(),
            hour: date.getHours()
        };
    }

    /**
     * loads messages from the store
     * @param {string} jid id of the chat
     * @param {Number} number number of messages to load
     */
    async loadMessages(jid, number) {
        const result = [];
        let { date, hour } = this.getTime();

        while (result.length < number) {
            const tempStore = makeInMemoryStore({ logger: this.logger });
            const tempPath = this.basePath + date + "_" + hour + ".json";

            tempStore.readFromFile(tempPath);
            result.push(...await tempStore.loadMessages(jid, number - result.length));

            if (hour > 0) hour--;
            else break;
        }

        return result;
    }

    /**
     * loads message from the store
     * @param {string} jid id of the chat
     * @param {string} id id of the message
        */
    async loadMessage(jid, id) {
        let { date, hour } = this.getTime();

        while (true) {
            const tempStore = makeInMemoryStore({ logger: this.logger });
            const tempPath = this.basePath + date + "_" + hour + ".json";

            tempStore.readFromFile(tempPath);
            const result = await tempStore.loadMessage(jid, id);

            if (result) return result;

            if (hour > 0) hour--;
            else break;
        }

        return null;
    }
}

function getServerLoad() {
    const totalmem = os.totalmem();
    const freemem = os.freemem()
    const avg1min = os.loadavg()[0];
    const memUsage = (totalmem - freemem) / totalmem * 100;

    return {
        avg1min,
        memUsage
    }
}

export default new MemoryStore();