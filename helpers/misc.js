import { sendCustomMsgQueue } from "../src/QueueObj.js";
import { GLOBAL } from "../src/storeMsg.js";

const PRODUCTION = process.env.NODE_ENV === 'production';
const PollOptions = {
    POSITIVE: "מתאימים מאוד",
    NEGATIVE: "לא מתאימים",
    SAME_SEX: "בן לוקח בת ובת לוקחת בן!",
    IS_MERRIED: "הוא\\היא נשוי\\ה"
}

export class Misc {
    constructor() {
        // wait for the store to be ready
        setTimeout(() => {
            this._setInterval15Av();
        }, 10 * 1000);
    }

    /**
     * Set the status of the 15Av feature
     * @param {string} jid - jid of the chat
     * @param {boolean} toRemove - Whether to remove the feature
     * @returns {void}
     * */
    active_15Av(jid, toRemove = false) {
        // If the feature is to be removed, remove it
        if (toRemove) {
            delete GLOBAL.Av15.jids[jid];

            return sendCustomMsgQueue(jid, {
                text: `הפיצ'ר של יום האהבה נמחק מהקבוצה`
            });
        }


        // If the feature is already active, return
        if (GLOBAL.Av15.jids?.[jid]) {
            return sendCustomMsgQueue(jid, {
                text: `הפיצ'ר של יום האהבה כבר פעיל בקבוצה`
            });
        }

        // If the feature is not active, add it
        GLOBAL.Av15.jids[jid] = { savedPolls: [] };

        sendCustomMsgQueue(jid, {
            text: `הפיצ'ר של יום האהבה נוסף לקבוצה`
        });

        // set the interval to send the message every hour
        this._setInterval15Av();
    }

    _setInterval15Av(toActice = true) {
        console.log("setInterval15Av", GLOBAL.Av15);

        // to remove the interval
        if (!toActice) {
            if (!GLOBAL.Av15.interval) {
                return;
            }
            clearInterval(GLOBAL.Av15.interval);
            delete GLOBAL.Av15.interval;
            return;
        }

        // interval already set
        if (GLOBAL.Av15.interval) {
            // on restart the interval is set to true, we need to set new interval
            if (!GLOBAL.Av15.interval === true)
                return;
        }

        // get the time difference between now and the next hour
        let timeDiff_sec = 60 * 60 - new Date().getMinutes() * 60 - new Date().getSeconds();
        setTimeout(() => {
            // set the interval to send the message every hour
            GLOBAL.Av15.interval = setInterval(() => {
                for (const jid in GLOBAL.Av15.jids) {
                    this._randomLovewithPoll(jid)
                }
            },
                PRODUCTION
                    ? 60 * 60 * 1000
                    : 30 * 1000
            );
        },
            PRODUCTION
                ? timeDiff_sec * 1000
                : 5 * 1000
        );
    }

    /**
     * Send a random love poll to the chat
     * @param {string} jid - jid of the chat
     */
    async _randomLovewithPoll(jid) {
        // get 2 random users from the chat
        const groupData = await GLOBAL.sock.groupMetadata(jid);
        let users = groupData.participants.map(user => user.id);

        // filter out for better performance
        if (users.length < 50) {
            users = users.filter(user => !GLOBAL.Av15.allUsers.includes(user));

            // not enough users for love calculation
            if (users.length <= (PRODUCTION ? 5 : 2)) {
                return;
            }
        }

        const user1 = this._getRandomUser(users);
        GLOBAL.Av15.allUsers.push(user1);

        let highest = { love: 0, user: "" };
        for (let i = 0; i < 25; i++) {
            const user2 = this._getRandomUser(users);
            const love = this.loveCalculator(user1, user2);

            if (love > 90) {
                highest.love = love;
                highest.user = user2;
                break;
            }
            if (love > highest.love) {
                highest.love = love;
                highest.user = user2;
            }
        }
        GLOBAL.Av15.allUsers.push(highest.user);


        // send msgs
        sendCustomMsgQueue(jid, {
            text: `סקר אהבה חדש! @${user1.split("@")[0]} ו @${highest.user.split("@")[0]} יוצאים לדייט!`,
            mentions: [user1, highest.user]
        });

        // send the poll
        const poll = await sendCustomMsgQueue(jid, {
            poll: {
                name: "הצביעו והשפיעו!",
                values: [
                    PollOptions.POSITIVE,
                    PollOptions.NEGATIVE,
                    PollOptions.SAME_SEX,
                    PollOptions.IS_MERRIED
                ],
                selectableCount: 1
            }
        });

        GLOBAL.Av15.jids[jid].savedPolls.push({
            pollID: poll.key.id,
            votes: [],
            mentionUsers: [user1, highest.user]
        });
    }

    /**
     * @param {string[]} users
     */
    _getRandomUser(users) {
        while (true) {
            const user = users[Math.floor(Math.random() * users.length)];
            if (!GLOBAL.Av15.allUsers.includes(user)) {
                return user;
            }
        }
    }

    async get15AvStatistic(jid) {
        const jidData = GLOBAL.Av15.jids[jid];
        if (!jidData) {
            return sendCustomMsgQueue(jid, {
                text: `הפיצ'ר של יום האהבה לא פעיל בקבוצה`
            });
        }

        const pollsAggregateVotes = [];

        for (const poll of jidData.savedPolls) { // fix this

            let pollData = poll.votes.reduce((acc, vote) => {
                switch (vote.name) {
                    case PollOptions.POSITIVE:
                        acc.positive += vote.voters.length;
                        break;
                    case PollOptions.NEGATIVE:
                        acc.positive -= vote.voters.length; // negative voters
                        break;
                    case PollOptions.SAME_SEX:
                        acc.sameSex += vote.voters.length;
                        break;
                    case PollOptions.IS_MERRIED:
                        acc.isMerried += vote.voters.length;
                        break;
                }
                return acc;
            }, { positive: 0, sameSex: 0, isMerried: 0, mentionUsers: poll.mentionUsers });

            pollsAggregateVotes.push(pollData);
        }

        const TOP3 = {
            positive: pollsAggregateVotes.sort((a, b) => b.positive - a.positive).filter(poll => poll.positive > 0).slice(0, 3),
            sameSex: pollsAggregateVotes.sort((a, b) => b.sameSex - a.sameSex).filter(poll => poll.sameSex > 0).slice(0, 3),
            isMerried: pollsAggregateVotes.sort((a, b) => b.isMerried - a.isMerried).filter(poll => poll.isMerried > 0).slice(0, 3)
        }

        sendCustomMsgQueue(jid, {
            text: 'סטטיסטיקת סקרי האהבה בקבוצה:\n' +
                `הזוגות הכי חמודים:\n` +
                TOP3.positive.map((poll, i) => `${i + 1}. @${poll.mentionUsers[0].split("@")[0]} ו @${poll.mentionUsers[1].split("@")[0]} - ${poll.positive} קולות`).join('\n') +
                `\n\nהזוגות הכי 2024:\n` +
                TOP3.sameSex.map((poll, i) => `${i + 1}. @${poll.mentionUsers[0].split("@")[0]} ו @${poll.mentionUsers[1].split("@")[0]} - ${poll.sameSex} קולות`).join('\n') +
                `\n\nהזוגות הכי ט.ל.ח.:\n` +
                TOP3.isMerried.map((poll, i) => `${i + 1}. @${poll.mentionUsers[0].split("@")[0]} ו @${poll.mentionUsers[1].split("@")[0]} - ${poll.isMerried} קולות`),
            mentions: jidData.savedPolls.flatMap(poll => poll.mentionUsers)
        });
    }

    /**
     * Calculate love percentage between two phone numbers
     * @param {string} phone1 - First phone number
     * @param {string} phone2 - Second phone number
     * @param {string} jid - jid of the chat 
     * @returns {number} - Love percentage between 1 and 100
     */
    loveCalculator(phone1, phone2, jid) {
        // Function to sum digits of a number
        function sumDigits(num = 0) {
            return num.toString().split('').reduce((acc, digit) => acc + parseInt(digit), 0);
        }

        // Function to repeatedly sum digits until we get a double-digit number
        function reduceToDoubleDigit(num = 0) {
            while (num > 100) {
                num = sumDigits(num) + num % 100;
            }
            return num;
        }

        // Remove any non-digit characters from phone numbers
        const cleanPhone1 = phone1.replace(/\D/g, '');
        const cleanPhone2 = phone2.replace(/\D/g, '');

        // Sum digits for each phone number
        const sum1 = sumDigits(cleanPhone1);
        const sum2 = sumDigits(cleanPhone2);

        // Calculate final love percentage
        let lovePercentage = Math.max(
            reduceToDoubleDigit(sum1 + sum2),
            reduceToDoubleDigit(Number(cleanPhone1) + Number(cleanPhone2))
        );

        // Some more magic ;)
        const magic1 = (sum1 * sum2)
            * (sum1 + sum2)
            % 100;
        if (lovePercentage + magic1 < 100) {
            lovePercentage += magic1;
        }

        const magic2 = (Number(cleanPhone1) * Number(cleanPhone2))
            * (Number(cleanPhone1) + Number(cleanPhone2))
            % 100;
        if (lovePercentage + magic2 < 100) {
            lovePercentage += magic2;
        }

        const magic3 = (Number(cleanPhone1) * sum2 + Number(cleanPhone2) * sum1)
            * (sum1 + sum2)
            % 100;
        if (lovePercentage + magic3 < 100) {
            lovePercentage += magic3;
        }

        if (jid)
            sendCustomMsgQueue(jid, {
                text: `*מחשבון אהבה:*\nאחוזי ההתאמה בין @${cleanPhone1} ו @${cleanPhone2} \nהוא: ${lovePercentage}%`,
                mentions: [phone1, phone2]
            });

        return lovePercentage;
    }
}

export default new Misc();