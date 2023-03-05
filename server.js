const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@adiwajshing/baileys')
const { handlerQueue } = require('./src/QueueObj');
const { store, tempStore } = require('./src/storeMsg');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { handleMessage } = require('./handler');
const Mongo = require('./mongo');
const express = require('express');
const QRCode = require('qrcode');
const apikeys = require('./src/apikeys');

const secret = process.env.SECRET ?? 'MySecretDefault';

const app = express()
const port = 8000;

app.use(bodyParser.json());

const mongo = new Mongo();

let qr = "";
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    const sock = makeWASocket({
        // can provide additional config here
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: state.keys,
        }
    })
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect)
            // reconnect if not logged out
            if (shouldReconnect) {
                connectToWhatsApp()
            }
        } else if (connection === 'open') {
            console.log('opened connection')
        }
        qr = update.qr;
    })
    sock.ev.on('creds.update', () => {
        console.log('creds.update')
        saveCreds()
    })

    // handle messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];

        if (!msg.message) return // if there is no text or media message
        if (msg.key.fromMe) return
        //console.log(JSON.stringify(msg, undefined, 2))

        handlerQueue.add(() => handleMessage(sock, msg));

        // save msg of specific users
        if (Object.keys(store).some(id => id === msg.key.remoteJid)) {
            try {
                store[msg.key.remoteJid].push(msg)
                tempStore[msg.key.remoteJid].push(msg)

            } catch (error) {
                console.log("Can't store message")
            }
        }

    })

}
// run in main file
connectToWhatsApp();



app.get('/qr', async (req, res) => {
    if (qr === undefined) return res.send("Already connected")

    await QRCode.toFile('./qr_code.png', qr);
    res.sendFile(__dirname + '/qr_code.png');
})

app.get('/', (req, res) => {
    //res.sendFile(__dirname + '/imgtoshare.jpeg');
    res.send('Hello World!')
})



app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(req.body)

    const user = await mongo.findApiKey({ name: username })

    if (!user) {
        return res.status(401).send({ message: 'Invalid username' });
    }

    if (password !== user.apikey)
        return res.status(401).send({ message: 'Invalid username or password' });

    const token = jwt.sign({ sub: user.apikey }, secret, { expiresIn: '1h' });

    res.send({ token });


});


app.post('/newMsgs', (req, res) => {
    const authHeader = req.headers.authorization;
    const contactID = req.body.contact;

    if (!authHeader) {
        return res.status(401).send({ message: 'Missing Authorization header' });
    }

    if (!contactID) {
        return res.status(401).send({ message: 'Missing Contact ID' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Invalid token' });
        }

        //const newToken = jwt.sign({ sub: user.id }, secret, { expiresIn: '30m' });


        // Return data that belongs to the authenticated user
        res.send({
            data: tempStore[contactID]
            //newToken
        });

        delete tempStore[contactID];
    });
});

app.post('/allMsgs', (req, res) => {
    const authHeader = req.body.auth;
    const contactID = req.body.contact;

    if (!authHeader) {
        return res.status(401).send({ message: 'Missing Authorization header' });
    }

    if (!contactID) {
        return res.status(401).send({ message: 'Missing Contact ID' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Invalid token' });
        }


        // Return data that belongs to the authenticated user
        res.send({
            data: store[contactID]
        });
    });
});


app.listen(port, () => {
    console.log(`WaAPI app listening at http://localhost:${port}`)
    console.log(`QR at http://localhost:${port}/qr`)
});