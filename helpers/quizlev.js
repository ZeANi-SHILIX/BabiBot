const { GLOBAL } = require('../src/storeMsg');
const { getOmerDay } = require('./hebrewDate');

const HOUR = 60 * 60 * 1000;
const HOUR_OF_QUIZ = 22;

/**
 * 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock
 */
function handleQuiz(msg, sock) {
    let id = msg.key.remoteJid;
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";


}


async function sendQuizDaily(id){

    while (GLOBAL?.Quiz?.[id]){
        let time = new Date().getHours();
        if (time === HOUR_OF_QUIZ){
            let quiz = await getQuiz();
            if (quiz){
                await sock.sendMessage(id, { text: quiz }, MessageType.text);
            }
        }
        await sleep(1 * HOUR);
    }

}



async function getQuiz(){
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}