const {HebrewCalendar, HDate, Location, Event, OmerEvent, months} = require('@hebcal/core');

// console.log(getOmerDay());

// const options = {
//   year: 2023,
//   isHebrewYear: false,
//   location: Location.lookup('Jerusalem'),
//   omer: true,
// };
// const events = HebrewCalendar.calendar(options);
// for (const ev of events) {
//   const hd = ev.getDate();
//   hd.isSameDate()
//   const date = hd.greg();

//   //console.log(date.toLocaleDateString(), ev.render('he'), hd.toString());
// }

/**
 * 
 * @returns {OmerEvent}
 */
function getOmerDay(){
  const today = new HDate(new Date());
  const omer1 = new HDate(15, months.NISAN, today.getFullYear());
  const omer = new OmerEvent(today, today.deltaDays(omer1));
  return omer;
}

module.exports = {
    getOmerDay
}