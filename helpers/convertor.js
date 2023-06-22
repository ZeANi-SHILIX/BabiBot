import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
import path from "path";

export function isOGGFile(oggFilename) {
    const ext = path.extname(oggFilename);
    return ext === ".ogg";
}

/**
 * 
 * @param {String} oggFilename 
 * @returns {Promise<string>}
 */
export function convertOGGToMp3(oggFilename) {
    return new Promise((resolve, reject) => {
        if (!isOGGFile(oggFilename)) {
            throw new Error(`Not a ogg file`);
        }
        const outputFile = oggFilename.replace(".ogg", ".mp3");
        ffmpeg({
            source: oggFilename,
        }).on("error", (err) => {
            reject(err);
        }).on("end", () => {
            resolve(outputFile);
        }).save(outputFile);
    });
}