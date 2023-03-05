var YoutubeMp3Downloader = require("youtube-mp3-downloader");
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

/**
 * 
 * @param {String} track 
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
function Downloader(track) {

    var YD = new YoutubeMp3Downloader({
        "ffmpegPath": ffmpegInstaller.path,
        "outputPath": "./",    // Output file location (default: the home directory)
    });

    //Download video and save as MP3 file
    try {
        
        YD.download(track);
    } catch (error) {
        console.log(error);
    }

    YD.on("progress", function (progress) {
        console.log(JSON.stringify(progress));
    });

    return new Promise(function (resolve, reject) {

        YD.on("finished", function (err, data) {
            console.log(JSON.stringify(data));
            resolve(data)
        });

        YD.on("error", function (error) {
            console.log(error);
            reject();
        });
    });


};

module.exports = Downloader;