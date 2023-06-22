import { GLOBAL } from '../src/storeMsg';

function Information() {
    this.map = new Map();
}
let info = new Information()

/**
 * 
 * @param {String} userID 
 * @param {import('youtube-mp3-downloader').IVideoTask } progress 
 * @returns {boolean} True if this first time
 */
Information.prototype.updateYouTubeProgress = function (userID, progress) {
    let isFirstTime = false;

    /** @type {Map} */
    let userInfo = this.map.get(userID) || new Map();

    if (!userInfo.has("youtubeProgress")) {
        isFirstTime = true;
    }

    userInfo.set("youtubeProgress", progress);
    this.map.set(userID, userInfo);

    return isFirstTime;
}

/**
 * 
 * @param {String} userID 
 * @returns {import('youtube-mp3-downloader').IVideoTask}
 */
Information.prototype.getYouTubeProgress = function (userID) {
    /** @type {Map} */
    let userInfo = this.map.get(userID) || new Map();
    return userInfo.get("youtubeProgress");
}

/**
 * 
 * @param {String} userID 
 */
Information.prototype.deleteYouTubeProgress = function (userID) {
    /** @type {Map} */
    let userInfo = this.map.get(userID) || new Map();
    userInfo.delete("youtubeProgress");
    this.map.set(userID, userInfo);
}

/**
 * count emoji reactions on a message in a group
 * saving the id of user who reacted
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg
 * @returns {{reactionsCount: number,minToMute: number,startTime: number} | undefined} 
 */
Information.prototype.reactionsOnSavedMsg = function (msg) {
    //const LIKE_EMOJI = ["👍", "👍🏿", "👍🏾", "👍🏽", "👍🏼", "👍🏻"];
    const UNLIKE_EMOJI = ["👎", "👎🏿", "👎🏾", "👎🏽", "👎🏼", "👎🏻"];

    // if not a group, do nothing
    if (!msg.key.remoteJid.endsWith("@g.us"))
        return;

    let idGroup = msg.key?.remoteJid;
    let messageID = msg.message?.reactionMessage?.key?.id;

    let idUser = msg.key?.participant || msg.key?.remoteJid;
    let emoji = msg.message?.reactionMessage?.text;

    /** * @type {{reactionsCount: number,minToMute: number,startTime: number} | undefined} */
    let msgOfReaction = GLOBAL.muteGroup?.[idGroup]?.[messageID];
    if (!msgOfReaction) return;

    let addOrRemove = emoji ? 1 : -1;
    msgOfReaction.reactionsCount += addOrRemove;

    if (msgOfReaction.reactionsCount < 0) {
        msgOfReaction.reactionsCount = 0;
    }

    // save progress
    GLOBAL.muteGroup[idGroup][messageID] = msgOfReaction;

    return msgOfReaction
}

/**
 * create a data structure to save the reactions on a message
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg - bot message
 * @param {Number} minToMute - the number of minutes to mute the group
 */
Information.prototype.makeReactionMsg = function (msg, minToMute) {
    let idGroup = msg.key.remoteJid;
    let messageID = msg.key.id;

    if (!GLOBAL.muteGroup) {
        GLOBAL.muteGroup = {};
    }

    if (!GLOBAL.muteGroup[idGroup]) {
        GLOBAL.muteGroup[idGroup] = {};
    }

    GLOBAL.muteGroup[idGroup][messageID] = {
        reactionsCount: 0,
        minToMute: minToMute,
        startTime: Date.now()
    }
}

/**
 * delete a data structure to save the reactions on a message
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg - reaction message
 */
Information.prototype.deleteReactionMsg = function (msg) {
    let idGroup = msg.key.remoteJid;

    if (!GLOBAL.muteGroup) {
        GLOBAL.muteGroup = {};
    }

    if (!GLOBAL.muteGroup[idGroup]) {
        GLOBAL.muteGroup[idGroup] = {};
    }

    let messageID = msg.message?.reactionMessage?.key?.id;
    delete GLOBAL.muteGroup[idGroup][messageID];

    if (Object.keys(GLOBAL.muteGroup[idGroup]).length == 0) {
        delete GLOBAL.muteGroup[idGroup];
    }
}

/**
 * delete all data structure to save the reactions on a message
 * @param {String} idGroup - group id
 */
Information.prototype.deleteAllReactionMsg = function (idGroup) {
    if (!GLOBAL.muteGroup) {
        GLOBAL.muteGroup = {};
    }

    if (!GLOBAL.muteGroup[idGroup]) {
        GLOBAL.muteGroup[idGroup] = {};
    }

    delete GLOBAL.muteGroup[idGroup];
}

/**
 * if the user is in a dialog with the bot
 * allow him to set settings for the group
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg
 * @returns {Number | undefined} ```undefined``` user without dialog. ```-1``` error, otherwise return the stage of the dialog (step 3 - finished)
 */
Information.prototype.setSettingDialog = function (msg) {
    let idGroup = msg.key.remoteJid;
    let idUser = msg.key.participant || msg.key.remoteJid;

    if (!this.map.has(idUser))
        return;

    /** @type {Map} */
    let userInfo = this.map.get(idUser);

    /** @type {{idGroup: String, stage : Number, countUser: Number, spam: String, feder: String}}*/
    let dialog = userInfo.get("setGroup");

    if (!dialog)
        return;

    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    textMsg = textMsg.trim();

    switch (dialog.stage) {
        case 0:
            let countUser = Number(textMsg);
            if (isNaN(countUser)) {
                return -1;
            }
            dialog.countUser = countUser;
            dialog.stage = 1;
            break;
        case 1:
            dialog.spam = textMsg;
            dialog.stage = 2;
            break;
        case 2:
            dialog.feder = textMsg;
            dialog.stage = 3;
            break;
        case 3:
            if (textMsg.includes("כן") || textMsg.includes("yes")) {
                GLOBAL.groupConfig[dialog.idGroup] = {
                    countUser: dialog.countUser,
                    spam: dialog.spam,
                    feder: dialog.feder
                }
                userInfo.delete("setGroup");
                this.map.set(idUser, userInfo);
                return 4;
            }
            if (textMsg.includes("לא") || textMsg.includes("no")) {
                userInfo.delete("setGroup");
                this.map.set(idUser, userInfo);
                return 4;
            }
            if (textMsg.includes("ערוך") || textMsg.includes("edit")) {
                dialog.stage = 0;
            }
            break;

    }
    userInfo.set("setGroup", dialog);
    this.map.set(idUser, userInfo);
    return dialog.stage;

}

/** 
 * start dialog with admin in private chat to set settings for the group
 * stage 0: set count user to mute
 * stage 1: set spam message
 * stage 2: apply settings
 * @param {import ('@adiwajshing/baileys').proto.WebMessageInfo} msg
*/
Information.prototype.startDialog = function (msg) {
    let idGroup = msg.key.remoteJid;
    let idUser = msg.key.participant || msg.key.remoteJid;

    /** @type {Map} */
    let userInfo = this.map.get(idUser) || new Map();
    userInfo.set("setGroup", {
        idGroup: idGroup,
        stage: 0,
        countUser: null,
        spam: null
    });
    this.map.set(idUser, userInfo);
}



module.exports = { info }