import { sendCustomMsgQueue } from "../src/QueueObj.js";

export class Misc {

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

        sendCustomMsgQueue(jid, {
            text: `*מחשבון אהבה:*\nאחוזי ההתאמה בין @${cleanPhone1} ו @${cleanPhone2} \nהוא: ${lovePercentage}%`,
            mentions: [phone1, phone2]
        });
    }
}

export default new Misc();