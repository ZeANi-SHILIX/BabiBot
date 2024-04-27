import { HebrewCalendar, HDate, Location, Event, Zmanim, OmerEvent, months } from '@hebcal/core';

/**
 * 
 * @param {Date} date 
 */
function isHebrewHolyday(date) {
    let hebToday = new HDate(date);
    console.log(hebToday.toString());

    /** @type {import('@hebcal/core').CalOptions} */
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
 * get the Omer day for a given date (default today)
 * the range is from 15 Nisan to 6 Sivan, otherwise will throw an error
 * @returns {OmerEvent}
 */
function getOmerDay(today = new Date()) {
    let today_he = new HDate(today);

    // get sunset
    let location = Location.lookup('Jerusalem');
    let zmanim = new Zmanim(today, location.getLatitude(), location.getLongitude());
    if (today >= zmanim.sunset()) today_he = today_he.next();

    const firstDayInOmer = new HDate(15, months.NISAN, today_he.getFullYear());
    return new OmerEvent(today_he, today_he.deltaDays(firstDayInOmer));
}

function testOmerDay() {
    const days = [
        new Date(2024, 3, 23), // טו בניסן
        new Date(2024, 3, 24),
        new Date(2024, 5, 11),
        new Date(2024, 5, 12), // ו' בסיון
    ];

    for (const day of days) {
        try {
            console.log(getOmerDay(day).render('he'));
        }
        catch (err) {
            console.error("not in Omer range")
        }
    }
}
//testOmerDay();

module.exports = {
    getOmerDay,
    isHebrewHolyday
}