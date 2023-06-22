import PQueue from 'p-queue';

/** queue of handlers promises.
 * 
 * to use: `handlerQueue.add(() => { })`
 */
export const handlerQueue = new PQueue({
    concurrency: 1
});
//queue.add(() => { });

/** queue of msgs promises.
 * 
 * to use: `msgQueue.add(() => { })`
 */
export const msgQueue = new PQueue({
    concurrency: 1,
    interval: 1000,
});
