import fs from "fs";

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
 *                  feder: string,
 *                  paidGroup: boolean,
 *                  lastUsedGPT: number,
 *                  countGPT: number,
 *                  lastUsedEveryBodyCommand: number,
 *             }
 *          },
 *         timeouts: { "groupID": NodeJS.Timeout },
 *         clearTimeout: function clearTimeout(id):void {},
 *         everybodyLastUse2min: function everybodyLastUse2min(id) : boolean{},
 *         canAskGPT: function (id): boolean {},
 *         quizLev: {
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
    groupConfig: {},
    timeouts: {},
    clearTimeout: function (id) {
        clearTimeout(this.timeouts[id]);
        console.log("cleared the timeout", this.timeouts[id], " for", id)
    },
    everybodyLastUse2min: function (id) {
        const time = new Date().getTime();
        if (!this.groupConfig[id]?.lastUsedEveryBodyCommand) {
            this.groupConfig[id] = {};
            this.groupConfig[id].lastUsedEveryBodyCommand = time;
            console.log("everybodyLastUse2min: groupConfig not found, created new one");
            return true;
        }
        // check if 2 minutes passed
        if (time - this.groupConfig[id].lastUsedEveryBodyCommand > 120_000) {
            this.groupConfig[id].lastUsedEveryBodyCommand = time;
            console.log("everybodyLastUse2min: 2 minutes passed");
            return true;
        }
        console.log("everybodyLastUse2min: 2 minutes not passed");
        return false;
    },
    canAskGPT: function (id) {
        const time = new Date().getTime();

        if (!this.groupConfig[id]?.lastUsedGPT) {
            this.groupConfig[id] = {};
            this.groupConfig[id].lastUsedGPT = time;
            this.groupConfig[id].countGPT = 1;
            console.log("canAskGPT: groupConfig not found, created new one");
            return true;
        }
        // if paid group
        if (this.groupConfig[id].paidGroup) {
            console.log("canAskGPT: paid group");
            return true;
        }

        // check if 5 minutes passed
        if (time - this.groupConfig[id].lastUsedGPT > 300_000) {
            this.groupConfig[id].lastUsedGPT = time;    // reset timer
            this.groupConfig[id].countGPT = 1;          // reset count
            console.log("canAskGPT: 5 minutes passed");
            return true;
        }
        // check if 3 times passed
        if (this.groupConfig[id].countGPT < 3) {
            this.groupConfig[id].countGPT++;
            console.log("canAskGPT: 3 times not passed");
            return true;
        }
        console.log("canAskGPT: NO! - 3 times passed");
        return false;
    }

};

export const temp = 5;


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
