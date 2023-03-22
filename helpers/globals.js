const { set } = require('mongoose');

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
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg - reaction message
 * @returns {{count: Number, minToMute: Number}} the number of reactions
 */
Information.prototype.reactionsOnSavedMsg = function (msg) {
    const LIKE_EMOJI = ["👍", "👍🏿", "👍🏾", "👍🏽", "👍🏼", "👍🏻"];

    let idGroup = msg.key.remoteJid;
    let idUser = msg.key.participant;
    let messageID = msg.message.reactionMessage.key.id;

    // check if the message is a reaction
    // if not - do nothing

    /** @type {Map} */
    let group = this.map.get(idGroup);
    if (!group)
        return;

    /** @type {Map} */
    let reactionsByMsg = group.get(messageID);
    if (!reactionsByMsg)
        return;

    /** @type {Set<string>} */
    let reactionsMembers = reactionsByMsg.get("reactionsCount") || new Set();

    // when exist - check if the reaction is a like
    // if not - remove the reaction
    if (!LIKE_EMOJI.includes(msg.message.reactionMessage.text)) {
        reactionsMembers.delete(idUser);
        reactionsByMsg.set("reactionsCount", reactionsMembers);
        group.set(messageID, reactionsByMsg);
        this.map.set(idGroup, group);
        return reactionsMembers.size;
    }

    reactionsMembers.add(idUser);
    reactionsByMsg.set("reactionsCount", reactionsMembers);
    group.set(messageID, reactionsByMsg);
    this.map.set(idGroup, group);

    return {
        count: reactionsMembers.size,
        minToMute: reactionsByMsg.get("minToMute")
    };
}

/**
 * create a data structure to save the reactions on a message
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg - bot message
 * @param {Number} minToMute - the number of minutes to mute the group
 */
Information.prototype.makeReactionMsg = function (msg, minToMute) {
    let idGroup = msg.key.remoteJid;
    let messageID = msg.key.id;

    /** @type {Map} */
    let group = this.map.get(idGroup);
    if (!group) {
        group = new Map();
        this.map.set(idGroup, group);
    }

    /** @type {Map} */
    let reactionsByMsg = group.get(messageID);
    if (!reactionsByMsg) {
        reactionsByMsg = new Map();
        reactionsByMsg.set("minToMute", minToMute);
        group.set(messageID, reactionsByMsg);
        this.map.set(idGroup, group);
    }

}

/**
 * delete a data structure to save the reactions on a message
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg - reaction message
 */
Information.prototype.deleteReactionMsg = function (msg) {
    let idGroup = msg.key.remoteJid;

    /** @type {Map} */
    let group = this.map.get(idGroup);
    if (!group)
        return;

    // if the key have the reactionsCount property - delete it
    for (let key of group.keys()) {
        let savedData = group.get(key);
        try {
            savedData.get("reactionsCount");
            group.delete(key);
        } catch (error) {

        }
    }
    this.map.set(idGroup, group);
}


module.exports = { info }