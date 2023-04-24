const { GLOBAL } = require('../src/storeMsg');
const { getOmerDay } = require('./hebrewDate');

const HOUR = 60 * 60 * 1000;
const DEFAULT_HOUR_OF_QUIZ = 22;
let intervalID;

/**
 * 
 * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
 * @param {import('@adiwajshing/baileys').WASocket} sock
 */
function handleAnswerQuiz(msg, sock) {
    let id = msg.key.remoteJid;
    let textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    let groups = Object.keys(GLOBAL?.quizLev?.groups);

    if (!id in groups) return;
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
         *                  bible: number, math: number, programming: number
         *              }
         *              tempParticipates: {
         *                  "userID": {timestamp: Number, group: string}
         *              },
         *              tempAnswer: any
         * }} */
        let currentGroup = GLOBAL.quizLev.groups[grp];

        // not active
        if (!currentGroup?.isActive) continue;

        let quizTime = currentGroup?.hourOfQuiz ?? DEFAULT_HOUR_OF_QUIZ;

        // not the time to send quiz
        if (time !== quizTime) continue;


        // send quiz
        switch (day) {
            // send programming quiz
            case 0:
            case 3:
                break;

            // send math quiz
            case 1:
            case 4:
                break;

            // send bible quiz
            case 2:
                break;

            // case 5:
            //     break;
            // case 6:
            //     break;
            default:
                break;
        }

    }

}

async function dailyQuiz() {
    intervalID = setInterval(() => {
        let date = new Date();

        // don't send on weekend
        if (date.getDay() === 6 ||date.getDay() === 5) return;
            
        // don't send on holidays
        

        sendQuizToGroups()
    }, HOUR)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}