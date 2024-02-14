import dotenv from 'dotenv';
dotenv.config();
const PRODUCTION = process.env.NODE_ENV === 'production';
PRODUCTION ? null : process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

import { errorMsgQueue, sendCustomMsgQueue, sendMsgQueue } from '../../src/QueueObj.js';
import didYouMean from 'didyoumean2';
import fetch from 'node-fetch';
import fs from 'fs';

const url_begin = 'https://docs.google.com/spreadsheets/d/';
const url_end = '/gviz/tq?&tqx=out:json';
const ssid = process.env.MAILLIST || "";

let courses = await updateCourses();
const credits = "המידע נלקח מתוך הפרוייקט\ngithub.com/ItamarShalev/semester_organizer";

function findCourse(query) {
    let allCoursesDidYouMean = courses.courses.filter(c => {
        let allNames = [c.name, ...c.aliases];
        return didYouMean(query, allNames);
    });
    let allNames = allCoursesDidYouMean.map(c => c.name);
    let allAliases = allCoursesDidYouMean.map(c => c.aliases);

    // find the most similar course
    let result = didYouMean(query, [...allNames, ...allAliases.flat()]);
    if (result) {
        return allCoursesDidYouMean.find(c => c.name === result || c.aliases.includes(result));
    }

    return null;
}
//console.log(findCourse("אלגברה לינארית ב"))

/**
 * @returns {Promise<{
*   version: number,
*   _comment: string,
*   courses: Array<{
*     id: number,
*     name: string,
*     course_number: number,
*     aliases: Array<string>,
*     blocked_by: Array<{
*       id: number,
*       course_number: number,
*       name: string,
*       can_be_taken_in_parallel: boolean
*     }>,
*     blocks: Array<{
*       id: number,
*       course_number: number,
*       name: string,
*       can_be_taken_in_parallel: boolean
*     }>
*   }>
* >}
*/
async function updateCourses() {
    let link = "https://raw.githubusercontent.com/ItamarShalev/semester_organizer/main/algorithms/generated_data/all_courses_blocked_and_blocks_info.json"

    try {
        const res = await fetch(link);
        const data = await res.json();
        console.log("courses updated");
        fs.writeFileSync("./helpers/jct/all_courses_blocked_and_blocks_info.json", JSON.stringify(data, null, 4));
        return data;
    } catch (err) {
        console.log(err);
        errorMsgQueue("Error updating courses");
        let rawjson = fs.readFileSync("./helpers/jct/all_courses_blocked_and_blocks_info.json");
        return JSON.parse(rawjson);
    }
}



/**
 * 
 * @param {string} jid
 * @param {string} query
*/
export async function getCoursesBlockedBy(jid, query) {
    let course = findCourse(query);

    if (course) {
        let block_by = course.blocked_by;
        if (block_by.length === 0) {
            return sendMsgQueue(jid, `אין קורסים שחוסמים את ${course.name}`);
        }

        let list = block_by.map(c => {
            let addon = c.can_be_taken_in_parallel ? " (ניתן לקחת במקביל)" : ""
            return c.name + addon;
        });
        // add number
        list = list.map((c, i) => `${i + 1}. ${c}`).join("\n");
        return sendMsgQueue(jid, `*הקורסים שחוסמים את ${course.name} הם:*\n${list}\n\n${credits}`)
    }
    else {
        sendMsgQueue(jid, `לא מצאתי את הקורס ${query}... נסה לחפש שוב במילים אחרות`)
    }
}

/**
 * 
 * @param {string} jid
 * @param {string} query
*/
export async function getWhatThisCourseBlocks(jid, query) {
    let course = findCourse(query);

    if (course) {
        let blocks = course.blocks;
        if (blocks.length === 0) {
            return sendMsgQueue(jid, `${course.name} לא חוסם אף קורס`);
        }

        let list = blocks.map(c => {
            let addon = c.can_be_taken_in_parallel ? " (ניתן לקחת במקביל)" : ""
            return c.name + addon;
        });
        // add number
        list = list.map((c, i) => `${i + 1}. ${c}`).join("\n");
        return sendMsgQueue(jid, `*${course.name} חוסם את הקורסים הבאים:*\n${list}\n\n${credits}`)
    }
    else {
        sendMsgQueue(jid, `לא מצאתי את הקורס ${query}... נסה לחפש שוב במילים אחרות`)
    }
}

export function getAllCourses(jid) {
    sendMsgQueue(jid, `*רשימת הקורסים במכון:*\n${courses.courses.map(c => c.name).join("\n")}`)
}

/**
 * 
 * @param {string} jid
 * @param {string} textMsg 
 * @returns 
 */
export async function getMailOf(jid, textMsg) {
    let contacts = loadMailsListFromFile();
    if (contacts.length === 0) contacts = await getMails();

    let searchText = textMsg.replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
        .replace(/[?]/g, "")
        .replace("בבקשהה", "").replace("בבקשה", "")
        .replace("המרצה ", "").replace("מרצה ", "")
        .replace("המתרגל ", "").replace("מתרגל ", "")
        .trim();

    if ((" " + searchText).includes(" דר "))
        searchText = searchText.replace("דר ", "")

    let arr_search = searchText.split(" ");
    console.log(arr_search)

    let contactsToSend = [];

    for (let contact of contacts) {
        if (arr_search.every(s => contact.mailName.includes(s) || contact.nickname.includes(s))) {
            contactsToSend.push(contact)
        }
    }

    if (contactsToSend.length > 0 && contactsToSend.length < 10)
        sendMsgQueue(jid, contactsToSend.map(c => c.mailName + ": " + c.mail).join("\n"))

    else if (jid.includes("s.whatsapp.net")) {
        if (contactsToSend.length === 0)
            sendMsgQueue(jid, `לא מצאתי את המייל המבוקש... נסה לחפש שוב במילים אחרות`
                //+ `\n(אם המייל חסר גם כאן ${url_begin}${ssid}\nנשמח אם תשלח לנו ונוסיף אותו)`
            )
        else
            sendMsgQueue(jid, `מצאתי ${contactsToSend.length} מיילים עבור ${searchText}\n`
                + `נסה לחפש באופן ממוקד יותר`)
    }
}

/**
 * @param {string} jid
 * @param {string} textMsg 
 */
export async function getPhoneNumberOf(jid, textMsg) {
    let contacts = loadMailsListFromFile();
    if (contacts.length === 0) contacts = await getMails();

    let searchText = textMsg.replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, '')
        .replace(/[?]/g, "")
        .replace("בבקשהה", "").replace("בבקשה", "")
        .replace("המרצה ", "").replace("מרצה ", "")
        .replace("המתרגל ", "").replace("מתרגל ", "")
        .trim();

    if ((" " + searchText).includes(" דר "))
        searchText = searchText.replace("דר ", "")

    let arr_search = searchText.split(" ");
    console.log(arr_search)

    let contactsToSend = [];

    for (let contact of contacts) {
        if (!(contact.phone || contact.whatsapp)) continue;

        if (arr_search.every(s => contact.name.includes(s) || contact.nickname.includes(s) || contact.mailName.includes(s))) {
            contactsToSend.push({ vcard: await makeVcard(contact) })
        }
    }

    if (contactsToSend.length)
        return sendCustomMsgQueue(jid, {
            contacts: {
                contacts: contactsToSend
            }
        })

    if (jid.includes("s.whatsapp.net")) {
        if (contactsToSend.length === 0)
            return sendMsgQueue(jid, "לא מצאתי מספרי טלפון התואמים לחיפוש שלך")

        //return sendMsgQueue(jid, "מצאתי " + contactsToSend.length + "מספרי טלפון התואמים לחיפוש שלך... נסה לחפש באופן ממוקד יותר")
    }
}

/**
 * 
 * @returns {Promise<{  mail: string, mailName: string, nickname: string,
 *                      phone: string, name: string, officeReceptionHours: string, 
 *                      phoneReceptionHours: string, location: string, whatsapp: string}[]>}
 */
async function getMails() {
    let url = `${url_begin}${ssid}${url_end}`;

    let res = await fetch(url);
    let data = await res.text();

    let json = JSON.parse(data.substr(47).slice(0, -2));

    let contacts = [];
    for (let mail of json.table.rows) {
        let contact = {
            mail: mail.c[0]?.v.split(":")[1]?.trim() || "",
            mailName: mail.c[0]?.v.split(":")[0]?.trim() || "",
            nickname: mail.c[1]?.v || "",
            phone: mail.c[2]?.v || "",
            whatsapp: mail.c[3]?.v || "",
            name: mail.c[4]?.v || "",
            officeReceptionHours: mail.c[5]?.v || "",
            phoneReceptionHours: mail.c[6]?.v || "",
            location: mail.c[7]?.v || "",
        }
        contacts.push(contact);
    }
    contacts.shift(); // remove the first row

    // save to file
    fs.writeFileSync("./helpers/jct/mails.json", JSON.stringify(contacts, null, 2));

    return contacts;
}

/**
 * 
 * @param {{mail: string, mailName: string, nickname: string,
 *          phone: string, name: string, officeReceptionHours: string,
 *          phoneReceptionHours: string, location: string, whatsapp: string}} contact 
 * @returns 
 */
async function makeVcard(contact = {}) {

    let VCARD = 'BEGIN:VCARD\n' // metadata of the contact card
        + `VERSION:3.0\n`
        + `FN:${contact.name || ""}\n`
        + `N:${contact.name || ""}\n`
        + `ORG:JCT;\n`

    let whatsapps = contact.whatsapp.split(",").map(p => p.replace("0", "972").replace(/-/g, "").trim());
    for (let whatsapp of whatsapps) {
        if (whatsapp) VCARD += `TEL;type=CELL;type=VOICE;waid=${whatsapp}:+${whatsapp}\n`
    }

    let phones = contact.phone.split(",").map(p => p.replace("0", "972").replace(/-/g, "").trim());

    // Not Working...
    // Info at: https://whiskeysockets.github.io/Baileys/#md:misc
    // for (let phone of phones) {
    //     let [result] = await GLOBAL.sock.onWhatsApp(phone)
    //     if (result.exists) VCARD += `TEL;type=CELL;type=VOICE;waid=${phone}:+${phone}\n`
    //     else VCARD += `TEL;type=CELL;type=VOICE:+${phone}\n`
    // }

    for (let phone of phones) {
        if (phone) VCARD += `TEL;type=WORK;type=VOICE:+${phone}\n`
    }

    if (contact.mail) VCARD += `EMAIL:${contact.mail}\n`

    if (contact.location) {
        let address = contact.location.split(",").map(p => p.trim());
        VCARD += `ADR;type=WORK:;;${address[0]}${address[1] ? ";" + address[1] : ""}${address[2] ? ";" + address[2] : ""};\n`
    }

    if (contact.officeReceptionHours || contact.phoneReceptionHours) {

        VCARD += `TITLE:שעות קבלה: `
        VCARD += contact.officeReceptionHours ? `במשרד: ${contact.officeReceptionHours} ` : ""
        VCARD += contact.phoneReceptionHours ? `בטלפון: ${contact.phoneReceptionHours} ` : ""
        VCARD += `\n`

        // "Reception" property is not exist, show as "other" in android
        VCARD += contact.officeReceptionHours ? `Reception:שעות קבלה במשרד: ${contact.officeReceptionHours} \n` : ""
        VCARD += contact.phoneReceptionHours ? `Reception:שעות קבלה בטלפון: ${contact.phoneReceptionHours} \n` : ""
    }

    VCARD += `END:VCARD`

    return VCARD;
}

export async function saveMailsListToFile() {
    let contacts = await getMails();
    fs.writeFileSync("./helpers/jct/mails.json", JSON.stringify(contacts, null, 2));
}

/**
 * @returns {{mail: string, mailName: string, nickname: string,
 *         phone: string, name: string, officeReceptionHours: string,
 *        phoneReceptionHours: string, location: string, whatsapp: string}[]}
 */
function loadMailsListFromFile() {
    let contacts = [];
    try {
        contacts = JSON.parse(fs.readFileSync("./helpers/jct/mails.json"));
    } catch (error) {
        console.log(error)
        errorMsgQueue("Error loading mails list from file")
    }
    return contacts;
}