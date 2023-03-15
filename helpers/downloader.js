var YoutubeMp3Downloader = require("youtube-mp3-downloader");
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { info } = require("./globals");

/**
 * 
 * @param {String} track 
 * @param {String} userID
 * @returns 
    {Promise<{
        videoId:String,
        stats:{
            transferredBytes: number,
            runtime: number,
            averageSpeed: number
        },
        file: String,
        youtubeUrl: String,
        videoTitle: String,
        artist: String,
        title: String,
        thumbnail: String
    }>}
 */
function Downloader(track, userID) {

    const filename = `${track}-${new Date().toLocaleDateString("en-GB")}`;

    var YD = new YoutubeMp3Downloader({
        "ffmpegPath": ffmpegInstaller.path,
        "outputPath": "./",    // Output file location (default: the home directory)
    });

    //Download video and save as MP3 file
    try {

        YD.download(track, filename);
    } catch (error) {
        console.log(error);
        return;
    }

    
    YD.on("progress", function (progress) {
        console.log(JSON.stringify(progress));
        // save progress
        info.updateYouTubeProgress(userID, progress)
    });

    return new Promise(function (resolve, reject) {

        YD.on("finished", function (err, data) {
            console.log(JSON.stringify(data));
            info.deleteYouTubeProgress(userID);
            resolve(data)
        });

        YD.on("error", function (error) {
            console.log(error);
            info.deleteYouTubeProgress(userID);
            reject();
        });
    });


};

module.exports = Downloader;