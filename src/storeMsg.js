const { proto, makeInMemoryStore } = require('@adiwajshing/baileys')
const { pino } = require("pino");
const fs = require("fs");

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
const GLOBAL = {
    sock: null,
    muteGroup: {},
};

const logger = pino();
logger.level = "silent";

const store = makeInMemoryStore({ logger });
store?.readFromFile("./baileys_store_multi.json");
// save every 10s
setInterval(() => {
    store?.writeToFile("./baileys_store_multi.json");
}, 10_000);

readConfig();

setInterval(() => {
    saveConfig();
}, 60_000);

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
    console.log("Group Config saved");
}

module.exports = {
    store,
    logger,
    GLOBAL
}