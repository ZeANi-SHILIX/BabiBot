// import YoutubeMp3Downloader from "youtube-mp3-downloader";
// import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { info } from "./globals.js";
import fs from "fs";
import { GetListByKeyword } from "youtube-search-api"
import ytdl from 'ytdl-core'

import { sendMsgQueue, errorMsgQueue, msgQueue } from '../src/QueueObj.js';
import { GLOBAL } from "../src/storeMsg.js";
import messageRetryHandler from "../src/retryHandler.js";
import { json } from "express";

const youtubeBaseUrl = "https://www.youtube.com/watch?v="
fs.existsSync("./youtubeDL") || fs.mkdirSync("./youtubeDL");
// /**
//  * 
//  * @param {String} track 
//  * @param {String} userID
//  * @param {import('@adiwajshing/baileys').WASocket} sock 
//  * @returns 
//     {Promise<{
//         videoId:String,
//         stats:{
//             transferredBytes: number,
//             runtime: number,
//             averageSpeed: number
//         },
//         file: String,
//         youtubeUrl: String,
//         videoTitle: String,
//         artist: String,
//         title: String,
//         thumbnail: String
//     }>}
//  */
// export function Downloader(track, userID, sock) {

//     const filename = `${track}-${userID}-${new Date().toLocaleDateString("en-GB")}`;

//     var YD = new YoutubeMp3Downloader({
//         ffmpegPath: ffmpegInstaller.path,
//         outputPath: "./youtubeDL/",    // Output file location (default: the home directory)
//         youtubeVideoQuality: 'lowest'
//     });

//     //Download video and save as MP3 file
//     try {

//         YD.download(track, filename);
//     } catch (error) {
//         console.error("link didnt work: ", error);
//     }


//     YD.on("progress", function (progress) {
//         console.log(JSON.stringify(progress));

//         // save progress
//         if (info.updateYouTubeProgress(userID, progress)) {
//             sock.sendMessage(userID, { text: "מתחיל בהורדה...\nניתן לראות את התקדמות ההורדה על ידי שליחת '%'" });
//         }
//     });

//     return new Promise(function (resolve, reject) {

//         YD.on("finished", function (err, data) {
//             console.log(JSON.stringify(data));
//             info.deleteYouTubeProgress(userID);
//             resolve(data)
//         });

//         YD.on("error", function (error) {
//             //console.error("Error", error);
//             info.deleteYouTubeProgress(userID);
//             sock.sendMessage(userID, { text: "אופס משהו לא עבד טוב...\nשלחת לי לינק תקין?" })
//             reject(error);
//         });
//     });


// };

/**
 * 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg
 */
export async function DownloadV2(msg) {
    const id = msg.key.remoteJid;
    let textMsg = msg.message?.conversation || "";
    // remove the command
    textMsg = textMsg.replace("!youtube", '').replace('!יוטיוב', '').trim();
    // if there is no text - get from the quoted msg
    textMsg = textMsg || msg.message?.extendedTextMessage?.text || "";

    // if there is no text - return
    if (!textMsg) return sendMsgQueue(id, "אופס... לא מצאתי קישור או טקסט לחיפוש")

    if (isIncludeLink(textMsg)) {
        let videoId = textMsg.split("v=")[1] || textMsg.split("youtu.be/")[1];

        // if the link is not valid
        if (!videoId) {
            return sendMsgQueue(id, "אופס משהו לא עבד טוב...\nשלחת לי לינק תקין?")
        }

        return downloadTYoutubeVideo(id, videoId)
    }

    // search for the video
    else {
        let listVid = await GetListByKeyword(textMsg);

        /** @type {Array<{id,type,thumbnail,title,channelTitle,shortBylineText,length,isLive}>} */
        let videos = listVid.items;

        let returnMsg = "אנא בחר מהרשימה:\n\n"
        for (let i = 0; i < 3; i++) {
            let searchObj = videos[i]
            returnMsg += `${i + 1}. ${searchObj.title}\n${youtubeBaseUrl + searchObj.id}\n\n`
        }
        // save the search result
        info.YTsetSearch(id, videos)

        // send the search result
        return sendMsgQueue(id, returnMsg)
    }
}

export async function searchText(text) {
    let res = await GetListByKeyword(text);

    /** @type {Array<{id,type,thumbnail,title,channelTitle,shortBylineText,length,isLive}>} */
    let videos = res.items;

    return videos;
}

/**
 * 
 * @param {string} jid 
 * @param {string} videoId 
 */
export async function downloadTYoutubeVideo(jid, videoId) {

    // get video details
    let videoDetails = await ytdl.getInfo(videoId);
    let filename = `./youtubeDL/${jid}-${videoId}-${new Date().toLocaleDateString("en-US").replace(/\//g, "-")}`;
    let title = videoDetails.videoDetails.title;

    let opusFormats = videoDetails.formats.filter((format) => format.codecs === "opus");
    let audioQualityLow = opusFormats.find((format) => format.audioQuality === "AUDIO_QUALITY_LOW");
    let downloadOptions = audioQualityLow ? { format: audioQualityLow } : { filter: "audioonly" };

    console.log("downloadOptions: ", JSON.stringify(downloadOptions, null, 2));

    // get video stream
    let stream = ytdl.downloadFromInfo(videoDetails, downloadOptions)
        .pipe(fs.createWriteStream(filename + ".opus"));

    // download video
    stream.on("finish", () => {
        console.log("finished downloading");

        console.log("converting from opus to ogg...")
        // convert to ogg
        ffmpeg(filename + ".opus")
            .toFormat('ogg')
            .on('error', (err) => {
                console.log('An error occurred: ' + err.message);
                errorMsgQueue(err)
                sendMsgQueue(jid, "אופס! התרחשה שגיאה, אנא נסה שנית")
            })
            .on('progress', (progress) => {
                console.log(JSON.stringify(progress));
            })
            .on('end', () => {
                console.log('Processing finished !');
                console.log("sending message...")
                msgQueue.add(async () => {
                    await GLOBAL.sock.sendMessage(jid, { caption: title, audio: { url: filename + ".ogg" }, mimetype: "audio/mpeg", ptt: true }).then(messageRetryHandler.addMessage);
                    await GLOBAL.sock.sendMessage(jid, { text: title }).then(messageRetryHandler.addMessage);
                    fs.unlinkSync(filename + ".opus");
                    fs.unlinkSync(filename + ".ogg");
                });
            })
            .save(`${filename}.ogg`);

    });

    stream.on("error", (err) => {
        console.error("error: ", err);
        sendMsgQueue(jid, "אופס משהו לא עבד טוב...\nשלחת לי לינק תקין?")
        errorMsgQueue(err)
    });
}

/**
 * @param {String} str
 * @returns {Boolean} 
 */
function isIncludeLink(str) {
    return str.includes("http") || str.includes("https") || str.includes("www.");
}