import { HebrewCalendar, HDate, Location, Event, OmerEvent, months, CalOptions } from '@hebcal/core';

/**
 * 
 * @param {Date} date 
 */
function isHebrewHolyday(date) {
    let hebToday = new HDate(date);
    console.log(hebToday.toString());

    /** @type {CalOptions} */
    const options = {
        year: hebToday.getFullYear(),
        isHebrewYear: true,
        location: Location.lookup('Jerusalem'),
        //omer: true,
        il: true,
        //noModern: true,
        noRoshChodesh: true,
        noMinorFast: true,
        noSpecialShabbat: true
    };

    const filters = [
        "Tu BiShvat",
        "Family Day",
        "Shushan Purim",
        "Yom HaAliyah",
        //"Yom HaShoah",
        //"Yom HaZikaron",
        "Yom HaAtzma'ut",
        "Herzl Day",
        "Pesach Sheni",
        "Lag BaOmer",
        "Yom Yerushalayim",
        "Jabotinsky Day",
        "Tu B'Av",
        "Rosh Hashana LaBehemot",
        "Leil Selichot",
        "Yom HaAliyah School Observance",
        "Yitzhak Rabin Memorial Day",
        "Sigd",
        "Ben-Gurion Day",
        "Chag HaBanot"
    ]
    const allEvents = HebrewCalendar.calendar(options);
    const events = allEvents.filter(ev => !filters.includes(ev.getDesc()));
    for (const ev of events) {
        const hd = ev.getDate();

        if (hd.isSameDate(hebToday)) {
            console.log(ev.render('he'), hd.toString());
            return true;
        }
    }
    return false;

}
// console.log(isHebrewHolyday(new Date(2021, 3, 14)))
// console.log(isHebrewHolyday(new Date(2021, 3, 15)))
// console.log(isHebrewHolyday(new Date(2023, 11, 10)))

/**
 * 
 * @returns {OmerEvent}
 */
function getOmerDay() {
    const today = new HDate(new Date());
    const omer1 = new HDate(15, months.NISAN, today.getFullYear());
    const omer = new OmerEvent(today, today.deltaDays(omer1));
    return omer;
}

module.exports = {
    getOmerDay,
    isHebrewHolyday
}