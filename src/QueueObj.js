const { default: PQueue } = require("p-queue");

/** queue of handlers promises.
 * 
 * to use: `handlerQueue.add(() => { })`
 */
const handlerQueue = new PQueue({
    concurrency: 1
});
//queue.add(() => { });

/** queue of msgs promises.
 * 
 * to use: `msgQueue.add(() => { })`
 */
const msgQueue = new PQueue({
    concurrency: 1,
    interval: 1000,
});

module.exports = {msgQueue, handlerQueue}