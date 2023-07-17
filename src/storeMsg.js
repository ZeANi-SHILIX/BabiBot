import { makeInMemoryStore } from '@adiwajshing/baileys';
import { pino, } from "pino";
import fs from "fs";
import os from "os";

/**
 * this sock is updating while getting messages
 * @type {{ sock: import('@adiwajshing/baileys').WASocket
 *          muteGroup: {
 *              "idGroup": {
 *                  "messageID": {
 *                      reactionsCount: number,
 *                      minToMute: number,
 *                      startTime: number
 *                  }
 *              }
 *          },
 *          groupConfig: {
 *              "idGroup": {
 *                  countUsers: number,
 *                  spam: string,
 *                  feder: string
 *             }
 *          },
 *          quizLev: {
 *              groups : {
 *                  "groupID" : { 
 *                      isActive: boolean, 
 *                      hourOfQuiz: number,
 *                      progress: {
*                           ProgrammingQuiz: number, MathQuiz: number, BibleQuiz: number
*                       },
 *                       tempParticipates: {
 *                          "userID": {timestamp: Number, group: string}
 *                      },
 *                      tempAnswer: {
 *                         type: string, answer: any    
 *                      }
 *              },
 *              participates : {
 *                  "userID": {
 *                      group: string, name: string, score: number
 *                  }
 *              }, 
 *                      
 *          }
 *      }}
*/
export const GLOBAL = {
    sock: null,
    muteGroup: {},
};

export const logger = pino();
logger.level = "silent";

let time = getTime();

// check if the folder exist
fs.existsSync("./store") || fs.mkdirSync("./store");

export const store = makeInMemoryStore({ logger });
store?.readFromFile(`./store/baileys_store_multi_${time}.json`);

// save every 10s
setInterval(() => {
    const newTime = getTime();

    // check server load
    const { avg1min, memUsage } = getServerLoad();

    console.log("CPU Average (1 min): " + avg1min);
    console.log("Memory Usage: " + memUsage.toFixed(1) + "%");

    if (memUsage > 80) {
        console.log("Memory usage is too high, restart server");
        GLOBAL.sock.sendMessage(GLOBAL.sock.user.id, "Memory usage is too high, plz restart server");
        //process.exit(1);
    }

    // reset store every 12 hours
    if (newTime !== time) {
        store?.writeToFile(`./store/baileys_store_multi_${time}.json`);


        time = newTime;

        console.log("12 hour... resetting store");
        GLOBAL.sock.sendMessage(GLOBAL.sock.user.id, "12 hour... resetting store")

        for (const id of Object.keys(store?.messages)) {
            store?.messages[id].clear();
        }
    }
    else {
        store?.writeToFile(`./store/baileys_store_multi_${time}.json`);
    }

}, 10_000);

readConfig();

setInterval(() => {
    saveConfig();
}, 100_000);

function readConfig() {
    if (!fs.existsSync("./groupConfig.json")) {
        console.log("Group Config file not found");
        GLOBAL.groupConfig = {};
        return;
    }

    const data = fs.readFileSync("./groupConfig.json");
    const json = JSON.parse(data);
    console.log(json);
    GLOBAL.groupConfig = json;
}

function saveConfig() {
    const groupConfig = GLOBAL.groupConfig;
    fs.writeFileSync("./groupConfig.json", JSON.stringify(groupConfig));
    //console.log("Group Config saved");
}

function getTime() {
    const date = new Date();
    const AM_PM = date.getHours() < 12 ? "AM" : "PM";

    return date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate() + "_" + AM_PM;
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