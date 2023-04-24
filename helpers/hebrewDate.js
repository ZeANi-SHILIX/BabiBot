const { HebrewCalendar, HDate, Location, Event, OmerEvent, months, CalOptions } = require('@hebcal/core');

/**
 * 
 * @param {Date} date 
 */
function isHebrewHolyday(date) {
    let hebToday = new HDate(date);

    /** @type {CalOptions} */
    const options = {
        year: 2023,
        isHebrewYear: false,
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
        "Yom HaZikaron",
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
        //console.log(ev.render('he'), hd.toString());
        //console.log(ev.getDesc())

        if (hd.isSameDate(hebToday)) {
            //console.log("\n------- same day -------\n")

            

            return true;
        }


    }
    return false;

}
//isHebrewHolyday(new Date())

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
    getOmerDay
}