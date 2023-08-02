import ffmpeg from 'fluent-ffmpeg';
import { info } from "./globals.js";
import fs from "fs";
import { GetListByKeyword } from "youtube-search-api"
import ytdl from 'ytdl-core'
import { sendMsgQueue, errorMsgQueue, sendCustomMsgQueue } from '../src/QueueObj.js';

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
        for (let i = 0; i < 5; i++) {
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
    let videoDetails = await ytdl.getInfo(videoId);
    let filename = `./youtubeDL/${jid}-${videoId}-${new Date().toLocaleDateString("en-US").replace(/\//g, "-")}`;
    let title = videoDetails.videoDetails.title;

    let audioQualityLow = videoDetails.formats.find((format) => format.codecs === "opus" && format.audioQuality === "AUDIO_QUALITY_MEDIUM");
    let downloadOptions = audioQualityLow ? { format: audioQualityLow } : { filter: "audioonly" };

    console.log(audioQualityLow.container)

    let progressMsg = await sendMsgQueue(jid, "מתחיל בהורדה...");

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
            .addOutputOptions('-avoid_negative_ts make_zero')
            .input(filename + "." + audioQualityLow.container)
            .save(`${filename}.ogg`)
            .on('error', (err) => {
                console.log('An error occurred: ' + err.message);
                errorMsgQueue(err)
                sendMsgQueue(jid, "אופס! התרחשה שגיאה, אנא נסה שנית")
            })
            .on('progress', (progress) => {
                // "timemark":"00:00:27.86" to seconds
                let time = progress.timemark.split(":");
                let seconds = (+time[0]) * 60 * 60 + (+time[1]) * 60 + (+time[2]);
                let percentage = (seconds / videoDetails.videoDetails.lengthSeconds * 100).toFixed(1);

                console.log('Processing... ', percentage + "% done");
                sendCustomMsgQueue(jid, { text: "מעבד... " + percentage + "%", edit: progressMsg.key })
            })
            .on('end', () => {
                console.log('Processing finished!');
                console.log("sending message...")
                sendCustomMsgQueue(jid, { caption: title, audio: { url: filename + ".ogg" }, mimetype: "audio/mpeg", ptt: true }).then(() => {
                    fs.unlinkSync(filename + "." + audioQualityLow.container);
                    fs.unlinkSync(filename + ".ogg");
                })
                sendCustomMsgQueue(jid, { text: title, edit: progressMsg.key })
            })


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