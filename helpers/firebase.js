const { initializeApp } = require("firebase/app");
const { getStorage, ref, listAll, getDownloadURL, uploadBytes, getBytes } = require("firebase/storage");
require('dotenv').config();
const fs = require('fs');

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: "puzzleforwabot.firebaseapp.com",
    projectId: "puzzleforwabot",
    storageBucket: "puzzleforwabot.appspot.com",
    messagingSenderId: "403440865602",
    appId: "1:403440865602:web:0b80321a8d7ebe8ec038db",
    measurementId: "G-ZQSC2JT3ZW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);


/**
 * @param {string} typeQuiz
 * @param {number} num_quiz
 * @returns {Promise<{ typeQuestion: string, question: string, typeAnswer: string, answer: string }>}
 * 
 * @example
 * const data = await getMathQuiz("MathQuiz", 1);
 * console.log(data);
 * 
 * @field typeQuestion: "image" | "text"
 * @field question: string
 * @field typeAnswer: "ABCD" | "freeText" | "math"
 * @field answer: string
 */
async function getFireBaseQuiz(typeQuiz ,num_quiz) {
    // return data 
    const data = {
        typeQuestion: "",
        question: "",
        typeAnswer: "",
        answer: ""
    };

    const mathQuizRef = ref(storage, `${typeQuiz}/${num_quiz}`);

    const list = await listAll(mathQuizRef);
    for (const item of list.items) {
        console.log(item.name);
        const pathToFile = `./quiz_files/${item.name}`;
        // download quiz to a file
        const ArrayBuffer = await getBytes(item);
        // convert to base64
        const base64 = Buffer.from(ArrayBuffer).toString('base64');
        // write to file
        fs.writeFileSync(pathToFile, base64, 'base64' );


        switch (item.name) {
            case "q.png":
            case "q.jpg":
                data.typeQuestion = "image";
                data.question = pathToFile;

                break;
            case "q.txt":
                data.typeQuestion = "text";
                data.question = fs.readFileSync(pathToFile, 'utf-8');

                break;
            case "a.jpg":
            case "a.png":
                data.typeAnswer = "image";
                data.answer = pathToFile;

                break;
            case "a.txt":
                data.typeAnswer = "text";
                data.answer = fs.readFileSync(pathToFile, 'utf-8');

                break;
        }
    }

    console.log(data);
    return data;
}
//getFireBaseQuiz("MathQuiz", 1);
//getFireBaseQuiz("Testing", 1);

module.exports = {
    //getFireBaseQuiz
}