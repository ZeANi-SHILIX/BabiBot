import YoutubeMp3Downloader from "youtube-mp3-downloader";
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { info } from "./globals.js";
import fs from "fs";

fs.existsSync("./youtubeDL") || fs.mkdirSync("./youtubeDL");
/**
 * 
 * @param {String} track 
 * @param {String} userID
 * @param {import('@adiwajshing/baileys').WASocket} sock 
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
export default function Downloader(track, userID, sock) {

    const filename = `${track}-${userID}-${new Date().toLocaleDateString("en-GB")}`;

    var YD = new YoutubeMp3Downloader({
        ffmpegPath: ffmpegInstaller.path,
        outputPath: "./youtubeDL/",    // Output file location (default: the home directory)
        youtubeVideoQuality: 'lowest'
    });

    //Download video and save as MP3 file
    try {

        YD.download(track, filename);
    } catch (error) {
        console.error("link didnt work: ", error);
    }


    YD.on("progress", function (progress) {
        console.log(JSON.stringify(progress));

        // save progress
        if (info.updateYouTubeProgress(userID, progress)){
            sock.sendMessage(userID, { text: "מתחיל בהורדה...\nניתן לראות את התקדמות ההורדה על ידי שליחת '%'" });
        }
    });

    return new Promise(function (resolve, reject) {

        YD.on("finished", function (err, data) {
            console.log(JSON.stringify(data));
            info.deleteYouTubeProgress(userID);
            resolve(data)
        });

        YD.on("error", function (error) {
            //console.error("Error", error);
            info.deleteYouTubeProgress(userID);
            sock.sendMessage(userID, { text: "אופס משהו לא עבד טוב...\nשלחת לי לינק תקין?" })
            reject(error);
        });
    });


};
