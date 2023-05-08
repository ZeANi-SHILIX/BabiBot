const { get } = require('mongoose');
const { GLOBAL } = require('../src/storeMsg');
const { getOmerDay, isHebrewHolyday } = require('./hebrewDate');
const { getFireBaseQuiz } = require('./firebase');
const messageRetryHandler = require('../src/retryHandler');

const HOUR = 60 * 60 * 1000;
const DEFAULT_HOUR_OF_QUIZ = 22;
let intervalID;

/**
 * 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg
 */
function handleAnswerQuiz(msg) {
    const id = msg.key.remoteJid;
    const user = msg.key.participant;
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    let groups = Object.keys(GLOBAL?.quizLev?.groups);

    if (!id in groups) return;

    // uniq char for answer
    if (!textMsg.includes("uniq")) return;

    /** 
     * @type {{isActive: boolean,hourOfQuiz: number,
     *         progress: {ProgrammingQuiz: number, MathQuiz: number, BibleQuiz: number},
     *         tempParticipates: {"userID": {timestamp: Number, group: string}},
     *         tempAnswer: {typeQuestion: string, question: string, typeAnswer: string, answer: string}   
     * }} 
     * */
    let currentGroup = GLOBAL.quizLev.groups[id];

    // check the answer
    if (currentGroup.tempAnswer.typeAnswer === "ABCD") {
        // remove all non-english char
        const tempText = textMsg.replace(/^[a-z]|[A-Z]/, "") // ??
        if (textMsg.toLocaleLowerCase().includes(currentGroup.tempAnswer.answer.toLocaleLowerCase()))
            currentGroup.tempParticipates[user] = {
                timestamp : (new Date()).getTime(),
                group: id
            }
    }

    if (currentGroup.tempAnswer.typeAnswer === "freeText"){

    }

    if (currentGroup.tempAnswer.typeAnswer === "math"){

    }


}


async function sendQuizToGroups() {
    let today = new Date();
    let time = today.getHours();
    let day = today.getDay();
    let groups = Object.keys(GLOBAL?.quizLev?.groups);

    for (const grp of groups) {

        /** 
         * @type { {   isActive: boolean,hourOfQuiz: number,
         *              progress: {
         *                  ProgrammingQuiz: number, MathQuiz: number, BibleQuiz: number
         *              }
         *              tempParticipates: {
         *                  "userID": {timestamp: Number, group: string}
         *              },
         *              tempAnswer: {
         *                  typeQuestion: string;
         *                  question: string;
         *                  typeAnswer: string;
         *                  answer: string;
         *              }
         * }} 
         * */
        let currentGroup = GLOBAL.quizLev.groups[grp];

        // not active
        if (!currentGroup?.isActive) continue;

        let quizTime = currentGroup?.hourOfQuiz ?? DEFAULT_HOUR_OF_QUIZ;

        // not the time to send quiz
        if (time !== quizTime) continue;

        const typeQuiz = day === 0 || day === 3 ? "ProgrammingQuiz" : day === 1 || day === 4 ? "MathQuiz" : day === 2 ? "BibleQuiz" : null;

        if (process.env.NODE_ENV !== "production") {
            // "Testing"?
            console.log("typeQuiz", typeQuiz);
        }

        const quizData = await getFireBaseQuiz(typeQuiz, currentGroup?.progress[typeQuiz]);

        currentGroup.tempAnswer = quizData;

        if (quizData.typeQuestion === "text") {
            await GLOBAL.sock.sendMessage(grp, quizData.question).then(messageRetryHandler.addMessage);
        }
        else if (quizData.typeQuestion === "image") {
            await GLOBAL.sock.sendMessage(grp, { image: { url: quizData.question } }).then(messageRetryHandler.addMessage);
        }
    }
}

async function dailyQuiz() {
    intervalID = setInterval(() => {
        let date = new Date();

        // don't send on weekend
        if (date.getDay() === 6 || date.getDay() === 5) return;

        // don't send on holidays
        if (isHebrewHolyday(date)) return;

        sendQuizToGroups()
    }, HOUR)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
