import ffmpeg from 'fluent-ffmpeg';
import { info } from "./globals.js";
import fs from "fs";
import { GetListByKeyword } from "youtube-search-api"
import ytdl from 'ytdl-core'
import { sendMsgQueue, errorMsgQueue, sendCustomMsgQueue, TYQueue } from '../src/QueueObj.js';

const youtubeBaseUrl = "https://www.youtube.com/watch?v="
fs.existsSync("./youtubeDL") || fs.mkdirSync("./youtubeDL");

/**
 * 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg
 */
export async function DownloadV2(msg) {
    const id = msg.key.remoteJid;
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";;
    // remove the command
    textMsg = textMsg.replace("!youtube", '').replace('!יוטיוב', '').trim();
    console.log("textMsg: ", textMsg)

    // if there is no text - get from the quoted msg
    textMsg = textMsg || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text;
    console.log("textMsg: ", textMsg)

    // if there is no text - return
    if (!textMsg) return sendMsgQueue(id, "אופס... לא מצאתי קישור או טקסט לחיפוש")

    // check if short link
    if (textMsg.includes("/shorts/")) return downloadShortVideo(id, textMsg);

    if (isIncludeLink(textMsg)) {
        let videoId = textMsg.split("v=")[1] || textMsg.split("youtu.be/")[1];
        videoId = videoId?.split(/[& ]/)[0].split("?")[0];

        // if the link is not valid
        if (!videoId) {
            return sendMsgQueue(id, "אופס משהו לא עבד טוב...\nשלחת לי לינק תקין?")
        }
        if (TYQueue.size > 0) sendMsgQueue(id, "מקומך בתור: " + TYQueue.size + "\nאנא המתן...");
        TYQueue.add(async () => await downloadTYoutubeVideo(id, videoId));
        return;
    }

    // search for the video
    else {
        let listVid = await GetListByKeyword(textMsg);

        /** @type {Array<{id,type,thumbnail,title,channelTitle,shortBylineText,length,isLive}>} */
        let videos = listVid.items;

        // filter where the length is more than 10 minutes
        videos = videos.filter((video) => {
            if (!video.length) return false;

            // simpleText: "3:10:05" or "10:05"
            let lengthSec = video.length.simpleText.split(":")
            lengthSec = lengthSec.length === 3
                ? (+lengthSec[0]) * 60 * 60 + (+lengthSec[1]) * 60 + (+lengthSec[2])
                : (+lengthSec[0]) * 60 + (+lengthSec[1]);

            return lengthSec < 60 * 10 && video.isLive === false
        });

        if (videos.length === 0) return sendMsgQueue(id, "אופס! לא מצאתי סרטון תואם לחיפוש שלך")

        let returnMsg = "אנא בחר מהרשימה:\n\n"
        for (let i = 0; i < 5 && i < videos.length; i++) {
            let searchObj = videos[i]
            returnMsg += `${i + 1}. ${searchObj.title}\n${youtubeBaseUrl + searchObj.id}\n\n`
        }
        // save the search result
        info.YTsetSearch(id, videos)

        // send the search result
        return sendMsgQueue(id, returnMsg)
    }
}

/**
 * 
 * @param {string} jid 
 * @param {string} videoId 
 */
export async function downloadTYoutubeVideo(jid, videoId) {

    // get video details
    let videoDetails = await ytdl.getInfo(videoId)
        .catch((err) => {
            console.error("error: ", err);
            sendMsgQueue(jid, "אופס משהו לא עבד טוב...\nשלחת לי לינק תקין?")
            errorMsgQueue(err)
        });
    if (!videoDetails) return;

    let filename = `./youtubeDL/${jid}-${videoId}-${new Date().toLocaleDateString("en-US").replace(/\//g, "-")}`;
    let title = videoDetails.videoDetails.title;

    // if the video is too long - more than 10 minutes
    if (+videoDetails.videoDetails.lengthSeconds > 60 * 10)
        return sendMsgQueue(jid, "אופס! הסרטון ארוך מדי, נסה סרטון קצר יותר")


    let audioQualityLow = videoDetails.formats.find((format) => format.codecs === "opus" && format.audioQuality === "AUDIO_QUALITY_MEDIUM");
    let downloadOptions = audioQualityLow ? { format: audioQualityLow } : { filter: "audioonly" };

    console.log(audioQualityLow.container)

    let progressMsg = await sendMsgQueue(jid, "מתחיל בהורדה...");

    return new Promise((resolve, reject) => {
        // get video stream
        let stream = ytdl.downloadFromInfo(videoDetails, downloadOptions)
            .pipe(fs.createWriteStream(filename + "." + audioQualityLow.container));

        // download video
        stream.on("finish", () => {
            console.log("finished downloading");
            sendCustomMsgQueue(jid, { text: "מעבד...", edit: progressMsg.key })

            console.log("converting from ", audioQualityLow.container, " to ogg...")
            // convert to ogg
            ffmpeg()
                .audioCodec('libopus')
                .toFormat('ogg')
                .audioChannels(1)
                .addOutputOptions('-avoid_negative_ts make_zero')
                .input(filename + "." + audioQualityLow.container)
                .save(`${filename}.ogg`)
                .on('error', (err) => {
                    console.log('An error occurred: ' + err.message);
                    errorMsgQueue(err)
                    sendMsgQueue(jid, "אופס! התרחשה שגיאה, אנא נסה שנית")
                    reject(err)
                })
                .on('progress', (progress) => {
                    // "timemark":"00:00:27.86" to seconds
                    let time = progress.timemark.split(":");
                    let seconds = (+time[0]) * 60 * 60 + (+time[1]) * 60 + (+time[2]);
                    let percentage = (seconds / videoDetails.videoDetails.lengthSeconds * 100).toFixed(1);

                    console.log('Processing... ', percentage + "% done");
                    //sendCustomMsgQueue(jid, { text: "מעבד... " + percentage + "%", edit: progressMsg.key })
                })
                .on('end', () => {
                    console.log('Processing finished!');
                    console.log("sending message...")
                    sendCustomMsgQueue(jid, { caption: title, audio: { url: filename + ".ogg" }, mimetype: "audio/mpeg", ptt: true }).then(() => {
                        fs.unlinkSync(filename + "." + audioQualityLow.container);
                        try {
                            fs.unlinkSync(filename + ".ogg");
                        } catch (error) {
                            errorMsgQueue("failed to delete file: " + filename + ".ogg")
                        }
                    })
                    sendCustomMsgQueue(jid, { text: title, edit: progressMsg.key })
                    resolve()
                })


        });

        stream.on("error", (err) => {
            console.error("error: ", err);
            sendMsgQueue(jid, "אופס משהו לא עבד טוב...\nשלחת לי לינק תקין?")
            errorMsgQueue(err)
            reject(err)
        });
    })
}

/**
 * @param {String} str
 * @returns {Boolean} 
 */
function isIncludeLink(str) {
    return str.includes("http") || str.includes("https") || str.includes("www.");
}

/**
 * 
 * @param {string} jid 
 * @param {string} text 
 */
async function downloadShortVideo(jid, text) {

    // https://youtube.com/shorts/xxxxxxxx?feature=share
    let videoId = text.split("shorts/")[1].split("?")[0];

    let videoDetails = await ytdl.getInfo(videoId);
    let filename = `./youtubeDL/${jid}-${videoId}-${new Date().toLocaleDateString("en-US").replace(/\//g, "-")}`;

    let vidFormat = videoDetails.formats.find((format) => format.container === "mp4"
        && (format.qualityLabel === "360p" || format.qualityLabel === "240p"));

    let stream = ytdl.downloadFromInfo(videoDetails, { format: vidFormat })
        .pipe(fs.createWriteStream(filename + "." + vidFormat.container));

    stream.on("finish", () => {
        sendCustomMsgQueue(jid, { video: { url: filename + "." + vidFormat.container }, mimetype: "video/mp4" })
            .then(() => fs.unlinkSync(filename + "." + vidFormat.container))
    })

    stream.on("error", (err) => {
        sendMsgQueue(jid, "אופס משהו לא עבד טוב עם הסרטון הזה...")
        errorMsgQueue(err)
    })
}

/**
 * 
 * @param {string} jid 
 * @param {string} text text with youtube link
 */
export async function DownloadVideoMP4(jid, text) {

    let videoId = text.split("v=")[1] || text.split("youtu.be/")[1];
    videoId = videoId?.split(/[& ]/)[0].split("?")[0];

    // if the link is not valid
    if (!videoId) {
        return sendMsgQueue(jid, "אופס משהו לא עבד טוב...\nשלחת לי לינק תקין?")
    }

    let videoDetails = await ytdl.getInfo(videoId);
    let filename = `./youtubeDL/${jid}-${videoId}-${new Date().toLocaleDateString("en-US").replace(/\//g, "-")}`;

    let vidFormat = videoDetails.formats
        .find((format) => format.container === "mp4"
            && (format.qualityLabel === "480p" || format.qualityLabel === "360p")
            && format.hasVideo && format.hasAudio);

    if (!vidFormat) return sendMsgQueue(jid, "אופס! לא הצלחתי להוריד את הסרטון הזה...");

    let stream = ytdl.downloadFromInfo(videoDetails, { format: vidFormat })
        .pipe(fs.createWriteStream(filename + "." + vidFormat.container));

    stream.on("finish", () => {
        sendCustomMsgQueue(jid, { video: { url: filename + "." + vidFormat.container }, mimetype: "video/mp4" })
            .then(() => sleep(5000))
            .then(() => fs.unlinkSync(filename + "." + vidFormat.container))
    })

    stream.on("error", (err) => {
        sendMsgQueue(jid, "אופס משהו לא עבד טוב עם הסרטון הזה...")
        errorMsgQueue(err)
    })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}