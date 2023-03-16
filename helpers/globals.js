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
    let userInfo = this.map.get(userID) || new Map();

    return userInfo.get("youtubeProgress");
}

/**
 * 
 * @param {String} userID 
 */
Information.prototype.deleteYouTubeProgress = function (userID) {
    let userInfo = this.map.get(userID) || new Map();
    userInfo.delete("youtubeProgress");
    this.map.set(userID, userInfo);
}



module.exports = { info }