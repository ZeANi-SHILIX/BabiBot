import e from "express";
import fs from "fs";

/** @type {import('@adiwajshing/baileys').WASocket} */
let tempSock;

/** @type {import('./memorystore').MemoryStore} */
let tempStore;

/** @type {{[jid:string]: {"messageID": {reactionsCount: number,minToMute: number, startTime: number}}}}*/
let tempMuteGroup = {};

/** 
 * @type {{[jid:string]: {
 *              name: string, approvalTermsOfService: boolean, countUsersToMute: number, 
 *              spam: string, blockLinks: boolean, blockLinksUser: string[], classes: string[], 
 *              paidGroup: boolean, lastUsedGPT: number, countGPT: number, lastUsedEveryBodyCommand: number
 * }}} 
 * */
let tempGroupConfig = {};

/** @type {{[jid:string]: {balance: number, sttWithoutCommand: boolean}}} */
let tempUserConfig = {};

/** @type {{[jid:string]: NodeJS.Timeout }} */
let tempTimeouts = {};

/** @type {{omerInternal: NodeJS.Timeout, chats: string[] }} */
let omerReminder = {};

/** @type {{jids: {[jid:string]: {savedPolls: {id: string, votes:[], mentionUsers: string[]}[]}}, allUsers: string[], interval: NodeJS.Timeout }} */
let tempAv15 = { jids: {}, allUsers: [] };

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

export const GLOBAL = {
    sock: tempSock, // updating when reconnecting (server.js)
    store: tempStore,
    muteGroup: tempMuteGroup,
    groupConfig: tempGroupConfig,
    userConfig: tempUserConfig,
    timeouts: tempTimeouts,
    omerReminder: omerReminder,
    Av15: tempAv15,
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
     * @param {string} jid id of the user (or the participant in the group)
     */
    canIUseOpenAI: function (jid) {
        // the data is saved by the user id
        if (!jid || jid.endsWith("@g.us")) {
            return false;
        }

        if (this.userConfig[jid] === undefined) {
            this.userConfig[jid] = {};
            this.userConfig[jid].balance = 0.01;
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
            this.userConfig[jid] = { balance: 0 };
        }
        this.userConfig[jid].balance += amount;

        // donate more than 5 dollars
        if (amount > 5) {
            this.userConfig[jid].sttWithoutCommand = true;
        }
        else if (amount > 0) {
            this.userConfig[jid].sttWithoutCommand = false;
        }

        return this.userConfig[jid].balance.toFixed(2);
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
        if (this.userConfig[jid]?.sttWithoutCommand && this.userConfig[jid]?.balance > 0) {
            return true;
        }
        return false;
    },
    unofficialGPTcredit: 250,
    updateUnofficialGPTcredit: function (tokens, model) {
        // 1 credit for 2000 tokens
        if (["pai-001", "pai-001-rp"].includes(model)) {
            this.unofficialGPTcredit -= tokens / 2000;
        }
        // 1 credit for 4000 tokens
        if (["pai-001-light", "pai-001-light-rp", "gpt-3.5-unfiltered"].includes(model)) {
            this.unofficialGPTcredit -= tokens / 4000;
        }
        console.log("unofficialGPTcredit: ", this.unofficialGPTcredit);
    }
};

const savedKeys = ["groupConfig", "userConfig", "omerReminder", "unofficialGPTcredit", "Av15"];

readConfig();

setInterval(() => {
    saveConfig();
}, 20_000);

function readConfig() {
    let tempConfig = {};
    if (!fs.existsSync("./savedConfig.json")) {
        tempConfig = {};
        console.log("Group Config file not found");
    }
    else {
        const data = fs.readFileSync("./savedConfig.json");
        try {
            tempConfig = JSON.parse(data);
            console.log(tempConfig);
        } catch (error) {
            tempConfig = {};
            console.log("Error in parsing the savedConfig.json file");
        }
    }

    for (const key of savedKeys) {
        // if the key is not found, create a new one
        if (tempConfig[key] === undefined) {
            if (key === "unofficialGPTcredit")
                GLOBAL[key] = 250;
            else if (key === "Av15")
                GLOBAL[key] = { jids: {}, allUsers: [] };
            else
                GLOBAL[key] = {};
        }
        // if the key is found, but the value is not correct, create a new one
        else {
            if (key === "unofficialGPTcredit" && typeof tempConfig[key] !== "number")
                GLOBAL[key] = 250;
            else if (key === "Av15" && tempConfig[key].jids === undefined)
                GLOBAL[key] = { jids: {}, allUsers: [] };
            else
                GLOBAL[key] = tempConfig[key];
        }
    }
}

function saveConfig() {
    const copyElement = {};
    for (const key of savedKeys) {
        if (key === "Av15") {
            copyElement[key] = { jids: GLOBAL[key].jids, allUsers: GLOBAL[key].allUsers, interval: GLOBAL[key].interval ? "savedActived" : false };
        }
        else
            copyElement[key] = GLOBAL[key];
    }

    fs.writeFileSync("./savedConfig.json", JSON.stringify(copyElement, null, 2));
}

// reset count of unofficialGPTcredit every day at 00:00
setInterval(() => {
    const date = new Date();
    if (date.getHours() === 0 && date.getMinutes() === 0) {
        GLOBAL.unofficialGPTcredit = 250;
    }
}, 60_000);