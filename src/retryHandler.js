class MessageRetryHandler {
  messagesMap;

  constructor() {
    this.messagesMap = {};
  }

  /**
   * 
   * @param {import('@adiwajshing/baileys').proto.IWebMessageInfo} message 
   * @returns 
   */
  addMessage = async (message) => {
    const id = message.key.id ?? "";

    //console.log(this);
    console.log("adding message to retry handler" + id);

    this.messagesMap[id] = this.cleanMessage(message);

    return message;
  };

  getMessage = (msgKey) => {
    return this.messagesMap[msgKey];
  };

  removeMessage = (msgKey) => {
    delete this.messagesMap[msgKey];
  };

  getMessageKeys = () => {
    return Object.keys(this.messagesMap);
  };

  cleanMessage = (message) => {
    const msg = message.message ?? {};
    return msg;
  };

  messageRetryHandler = async (message) => {
    const msg = this.getMessage(message.id ?? "");
    // Remove msg from map
    this.removeMessage(message.id ?? "");
    return msg;
  };
}

const messageRetryHandler = new MessageRetryHandler();

module.exports = messageRetryHandler