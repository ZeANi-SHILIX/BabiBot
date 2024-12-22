import fs from "fs";
import { sendMsgQueue } from "../src/QueueObj.js";
import { downloadMediaMessage } from "@adiwajshing/baileys";
import { getMsgType, MsgType } from "./msgType.js";
import MemoryStore from "../src/memorystore.js";
import dotenv from 'dotenv';
dotenv.config();

export default class GroqAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Transcribes and summarizes an audio file.
   * If the transcription is short, returns it as is.
   * @param {string} audioFilePath - Path to the audio file in OGG format.
   * @returns {Promise<string>} - The summarized transcription.
   */
  async transcribeAndSummarize(audioFilePath) {
    let fullTranscription = await this.transcribe(audioFilePath);
    if (fullTranscription.length < 200) {
      return fullTranscription;
    }
    return fullTranscription + '\n\n' + await this.getSummary(fullTranscription);
  }

  /**
   * Transcribes an audio file, handling large files by splitting them into chunks.
   * @param {string} audioFilePath - Path to the audio file.
   * @returns {Promise<string>} - The transcribed text.
   */
  async transcribe(audioFilePath) {
    const stats = fs.statSync(audioFilePath);
    const fileSize = stats.size;

    if (fileSize > 25 * 1024 * 1024) {
      const audioChunks = await this.splitAudioFile(audioFilePath);
      let fullTranscription = '';
      for (let i = 0; i < audioChunks.length; i++) {
        const chunkTranscription = await this.transcribeChunk(audioChunks[i]);
        fullTranscription += chunkTranscription;
      }
      return fullTranscription;
    } else {
      const fileBuffer = fs.readFileSync(audioFilePath);
      return await this.transcribeChunk(fileBuffer);
    }
  }

  /**
   * Transcribes a single chunk of audio.
   * @param {Buffer} chunk - An audio file chunk as Buffer.
   * @returns {Promise<string>} - The transcribed text for the chunk.
   */
  async transcribeChunk(chunk) {
    // Create boundary for multipart form-data
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    // Construct the multipart form-data manually
    const body = Buffer.concat([
      // Add model field
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="model"\r\n\r\n'),
      Buffer.from('whisper-large-v3\r\n'),

      // Add response_format field
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="response_format"\r\n\r\n'),
      Buffer.from('verbose_json\r\n'),

      // Add file field
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="file"; filename="audio.opus"\r\n'),
      Buffer.from('Content-Type: audio/ogg\r\n\r\n'),
      chunk,
      Buffer.from('\r\n'),

      // Add closing boundary
      Buffer.from(`--${boundary}--\r\n`)
    ]);

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString()
      },
      body: body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    return result.text;
  }

  /**
   * Splits a large audio file into 24MB chunks.
   * @param {string} filePath - Path to the audio file.
   * @returns {Promise<Buffer[]>} - Array of file chunks as Buffers.
   */
  async splitAudioFile(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const chunkSize = 24 * 1024 * 1024;
    const chunks = Math.ceil(fileBuffer.length / chunkSize);
    const audioChunks = [];

    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min((i + 1) * chunkSize, fileBuffer.length);
      const chunk = fileBuffer.slice(start, end);
      audioChunks.push(chunk);
    }

    return audioChunks;
  }

  /**
   * Summarizes the given text.
   * @param {string} text - The text to summarize.
   * @returns {Promise<string>} - The summary.
   */
  async getSummary(text) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          { role: "system", content: "אתה עוזר מועיל שמסכם טקסטים בצורה תמציתית וברורה." },
          { role: "user", content: `צור סיכום קצר של ההקלטה הבאה:\n\n${text}` }
        ],
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  }

  /**
   * @param {import('@adiwajshing/baileys').proto.WebMessageInfo} msg 
   */
  async stt(msg) {
    const id = msg.key.remoteJid;
  
    // get type of original message
    let { type } = getMsgType(msg);
  
    let quotedMsg = msg;
    if (type !== MsgType.AUDIO) {
      // has quoted message?
      if (!msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
        return sendMsgQueue(id, "יש לצטט הודעה")
      }
  
      // get from store
      quotedMsg = await MemoryStore.loadMessage(id, msg.message.extendedTextMessage.contextInfo.stanzaId);
      if (!quotedMsg) {
        await sleep(2000);
        quotedMsg = await MemoryStore.loadMessage(id, msg.message.extendedTextMessage.contextInfo.stanzaId);
      }
      if (!quotedMsg) {
        return sendMsgQueue(id, "ההודעה המצוטטת לא נמצאה, נסה לשלוח את הפקודה שוב בעוד כמה שניות")
      }
  
      // get type of quoted message
      type = getMsgType(quotedMsg).type
  
      if (type !== MsgType.AUDIO) {
        return sendMsgQueue(id, "ההודעה המצוטטת איננה קובץ שמע")
      }
    }
  
    try {
      const filename = `./${id}_whisper.ogg`;
  
      // download file
      /** @type {Buffer} */
      let buffer = await downloadMediaMessage(quotedMsg, "buffer");
      // save temp file
      fs.writeFileSync(filename, buffer);
      // send to stt
      let res = await this.transcribeAndSummarize(filename);
      // delete file
      fs.unlinkSync(filename);
      // send result
      return sendMsgQueue(id, res);
    }
    catch (error) {
      sendMsgQueue(id, "אופס משהו לא עבד טוב")
    }
  }
  
}

async function test() {
  const apiKey = process.env.GROQ_API_KEY;
  const groq = new GroqAPI(apiKey);

  try {
    const summary = await groq.transcribeAndSummarize("./testingFiles/test.opus");
    console.log(summary);
  } catch (error) {
    console.error('Error:', error);
  }
}

//test();