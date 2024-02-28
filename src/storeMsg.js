import fs from "fs";

/** @type {import('@adiwajshing/baileys').WASocket} */
let tempSock;

/** @type {{[jid:string]: {"messageID": {reactionsCount: number,minToMute: number, startTime: number}}}}*/
let tempMuteGroup = {};

/** @type {{[jid:string]: {name: string, approvalTermsOfService: boolean, countUsersToMute: number, spam: string, blockLinks: boolean, blockLinksUser: string[], classes: string[], paidGroup: boolean, lastUsedGPT: number, countGPT: number, lastUsedEveryBodyCommand: number}}} */
let tempGroupConfig = {};

/** @type {{[jid:string]: {balance: number, sttWithoutCommand: boolean}}} */
let tempUserConfig = {};

/** @type {{[jid:string]: NodeJS.Timeout }} */
let tempTimeouts = {};

/**  
 * @type {{quizLev: {
 *              groups : {
 *                      "groupID" : {
 *                                  isActive: boolean,
 *                                  hourOfQuiz: number,
 *                                  progress: { ProgrammingQuiz: number, MathQuiz: number, BibleQuiz: number},
 *                                  tempParticipates: { "userID": {timestamp: Number, group: string}},
 *                                  tempAnswer: { type: string, answer: any }
 *                      }, 
 *                      participates : {
 *                                  "userID": { group: string, name: string, score: number } 
 *                      }
 *              }
 *      }}}
 * */
let tempQuizLev = {};

/**
 * this sock is updating when reconnecting
*/
export const GLOBAL = {
    sock: tempSock,
    muteGroup: tempMuteGroup,
    groupConfig: tempGroupConfig,
    userConfig: tempUserConfig,
    timeouts: tempTimeouts,
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
    /**
     * @param {string} jid
     */
    canIUseOpenAI: function (jid) {
        // the data is saved by the user id
        if (jid || jid.endsWith("@g.us")) {
            return false;
        }

        if (this.userConfig[jid] === undefined) {
            this.userConfig[jid] = {};
            this.userConfig[jid].balance = 0.05;
            this.userConfig[jid].sttWithoutCommand = false;
            return true; // allow to use the first time
        }

        if (this.userConfig[jid].balance < 0) {
            this.userConfig[jid].sttWithoutCommand = false;
            return false;
        }

        return true;
    },
    /**
     * @param {string} jid id of the user
     * @param {number} amount Addition or subtraction of the balance (in dollars)
     */
    updateBalanceOpenAI: function (jid, amount) {
        if (this.userConfig[jid] === undefined) {
            this.userConfig[jid] = {};
        }
        this.userConfig[jid].balance += amount;

        // donate more than 5 dollars
        if (amount > 5) {
            this.userConfig[jid].sttWithoutCommand = true;
        }
        else if (amount > 0) {
            this.userConfig[jid].sttWithoutCommand = false;
        }
    },
    getBalanceOpenAI: function (jid) {
        if (this.userConfig[jid] === undefined) {
            return 0;
        }
        return this.userConfig[jid].balance.toFixed(2);
    },
    /**
     * @param {string} jid
     */
    autoSTT: function (jid) {
        if (this.userConfig[jid]?.sttWithoutCommand && this.userConfig[jid].balance > 0) {
            return true;
        }
        return false;
    }
};


readConfig();

setInterval(() => {
    saveConfig();
}, 20_000);

function readConfig() {
    if (!fs.existsSync("./groupConfig.json")) {
        console.log("Group Config file not found");
        GLOBAL.groupConfig = {};
        GLOBAL.userConfig = {};
        return;
    }

    const data = fs.readFileSync("./groupConfig.json");
    const json = JSON.parse(data);
    console.log(json);
    GLOBAL.groupConfig = json.groupConfig;
    GLOBAL.userConfig = json.userConfig;
}

function saveConfig() {
    const copyElement = { groupConfig: GLOBAL.groupConfig, userConfig: GLOBAL.userConfig };
    fs.writeFileSync("./groupConfig.json", JSON.stringify(copyElement, null, 2));
    //console.log("Group Config saved");
}
