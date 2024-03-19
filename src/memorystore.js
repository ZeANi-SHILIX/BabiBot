import { makeInMemoryStore } from '@adiwajshing/baileys'
import { pino } from "pino";
import fs from "fs";
import os from "os";

/**
 * custom store for baileys
 */
export class MemoryStore {
    // CONSTANTS
    #DIVID_HOUR_TO_X_PARTS = 2;
    #DAYS_TO_KEEP = 3;
    #TOTAL_PARTS = 24 * this.#DIVID_HOUR_TO_X_PARTS * this.#DAYS_TO_KEEP;

    // VARIABLES
    logger = pino();
    #basePath = "./MemoryStore/baileys_store_part_";
    #currentPart = 0;

    // TODO
    constructor(daysToKeep = 3, partsPerHour = 2) {
        this.#DAYS_TO_KEEP = daysToKeep;
        this.#DIVID_HOUR_TO_X_PARTS = partsPerHour;
        this.#TOTAL_PARTS = 24 * this.#DIVID_HOUR_TO_X_PARTS * this.#DAYS_TO_KEEP;

        // create the store directory if it doesn't exist
        fs.existsSync("./MemoryStore") || fs.mkdirSync("./MemoryStore");

        // set the logger to silent
        this.logger.level = "silent";

        // set the current part
        this.#loadCurrentPartNumber();
        // when the server starts, bump the part number
        this.#getNextPart();

        // create the store
        this.store = makeInMemoryStore({ logger: this.logger });
        this.store.readFromFile(this.#getFileName(this.#currentPart));

        // save the store every 10 seconds
        setInterval(() => {
            // check server load
            const { avg1min, memUsage } = getServerLoad();
            console.log("CPU Average (1 min): " + avg1min);
            console.log("Memory Usage: " + memUsage.toFixed(1) + "%");

            // save the store
            this.store.writeToFile(this.#getFileName(this.#currentPart));
        }, 10000)

        // change the part 
        setInterval(() => {
            // save the store
            this.store.writeToFile(this.#getFileName(this.#currentPart));
            // change the part
            this.#currentPart = this.#getNextPart();
            this.#saveCurrentPartNumber();
            // clear the store
            for (const id of Object.keys(this.store.messages)) {
                this.store.messages[id].clear();
            }
        }, 1000 * 60 * 60 / this.#DIVID_HOUR_TO_X_PARTS)
    }

    #saveCurrentPartNumber() {
        fs.writeFileSync("./MemoryStore/current_part.json", JSON.stringify({ currentPart: this.#currentPart }));
    }

    #loadCurrentPartNumber() {
        if (fs.existsSync("./MemoryStore/current_part.json")) {
            let json = JSON.parse(fs.readFileSync("./MemoryStore/current_part.json"));
            this.#currentPart = parseInt(json.currentPart) || 0;
        }
    }

    /**
     * get the next part number (modify)
     * @returns {Number} next part number
     */
    #getNextPart() {
        this.#currentPart++;
        this.#currentPart %= this.#TOTAL_PARTS; // reset to 0 if it exceeds the limit
        return this.#currentPart;
    }

    /**
     * get the previous part number (does not modify)
     * @param {Number} num current part number (optional)
     * @returns {Number} previous part number
     */
    #getPrevPart(num = this.#currentPart) {
        return (num - 1 + this.#TOTAL_PARTS) % this.#TOTAL_PARTS;
    }

    #getFileName(number) {
        return this.#basePath + number + ".json";
    }

    /**
     * loads messages from the store
     * @param {string} jid id of the chat
     * @param {Number} number number of messages to load
     */
    async loadMessages(jid, number) {
        if (number <= 0) return [];

        // start from the current part
        const result = await this.store.loadMessages(jid, number);
        if (result.length >= number) return result;

        let prev = this.#getPrevPart();


        for (let i = 1; i < this.#TOTAL_PARTS; i++) {
            // make a new store based on the previous part
            const tempStore = makeInMemoryStore({ logger: this.logger });
            const fileName = this.#getFileName(prev);

            // if the file exists, read from it
            if (fs.existsSync(fileName)) {
                tempStore.readFromFile(fileName);

                // search for the messages ("number - result.length" always positive)
                result.push(...await tempStore.loadMessages(jid, number - result.length));
            }

            // if all messages are found, return the result, else continue to the previous part
            if (result.length >= number) return result;
            prev = this.#getPrevPart(prev);
        }
        // if we reach here, it means we have searched all the parts and still not found the messages
        return result;
    }

    /**
     * loads message from the store
     * @param {string} jid id of the chat
     * @param {string} id id of the message
        */
    async loadMessage(jid, id) {
        // start from the current part
        const result = await this.store.loadMessage(jid, id);
        if (result) return result;

        let prev = this.#getPrevPart();

        for (let i = 1; i < this.#TOTAL_PARTS; i++) {
            // make a new store based on the previous part
            const tempStore = makeInMemoryStore({ logger: this.logger });
            const fileName = this.#getFileName(prev);

            // if the file exists, read from it
            if (fs.existsSync(fileName)) {
                tempStore.readFromFile(fileName);

                // search for the message
                const result = await tempStore.loadMessage(jid, id);

                // if found, return the result
                if (result) return result;
            }

            // continue to the previous part
            prev = this.#getPrevPart(prev);
        }
        // if not found, return null
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

export default new MemoryStore(3, 2);