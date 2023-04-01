import { ChatGPTUnofficialProxyAPI} from 'chatgpt'
import Authenticator from "openai-authenticator";
import Express from 'express';

const app = Express();
const port = 8080;

app.use(Express.json());

class ProxyGPT {
    constructor() {
        this.api = null;
        this.authenticator = new Authenticator();
    }

    async login(email, password) {
        // let { ChatGPTUnofficialProxyAPI , SendMessageBrowserOptions, ChatMessage } = await import("openai-authenticator");
        // await import("chatgpt");
        let data = await this.authenticator.login(email, password);
        this.api = new ChatGPTUnofficialProxyAPI({
            accessToken: data.accessToken,
            //accessToken: exampleToken,
            //model: "text-davinci-003",
            model: "gpt-3.5-turbo",
        })
        //console.log(data.accessToken)
    }

    /**
     * 
     * @param {String} message 
     * @param {SendMessageBrowserOptions} options 
     * @returns {Promise<ChatMessage>} if 2 times failed return undefined
     */
    async sendMessage(message, options) {
        try {
            return await this.api.sendMessage(message, options)

        } catch (error) {
            //console.log(error)
            this.relogin(user, password)
            try {
                return await this.api.sendMessage(message, options)
            } catch (error) {
                console.log(error);
            }
        }
        return;
    }

    async relogin(email, password) {
        console.log('relogin proxyGPT...')
        await this.login(email, password);
    }
}

const proxyGPT = new ProxyGPT();

app.post("/login", async (req, res) => {
    const { user, password } = req.body;
    proxyGPT.login(user, password)
        .then(() => {
            res.send({
                success: true,
                message: 'login success'
            })
        })
        .catch((err) => {
            console.log(err)
            res.send({
                success: false,
                message: 'login failed'
            })
        })
});

app.post('/sendMessage', async (req, res) => {
    const { message, options } = req.body;
    proxyGPT.sendMessage(message, options)
        .then((data) => {
            res.send(data)
        })
});

app.get ('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})


// async function example() {

//     const proxyGPT = new ProxyGPT();
//     await proxyGPT.login(user, password);

//     let res = await proxyGPT.sendMessage('השם שלי שולמית', {})
//     console.log(res)

//     let res2 = await proxyGPT.sendMessage('my name is yossi')
//     console.log(res2?.text)

//     res = await proxyGPT.sendMessage('what is my name?', { conversationId: res?.conversationId, parentMessageId: res?.id })
//     console.log(res?.text)

//     res2 = await proxyGPT.sendMessage('what is my name?', { conversationId: res2?.conversationId, parentMessageId: res2?.id })
//     console.log(res2?.text)
// }
// example()