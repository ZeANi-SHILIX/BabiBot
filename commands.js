/**
 * @type {Object.<string, Array<{
 *              name: string,
 *              description: string,
 *              usage: string,
 *              parameters: ? Array<{
 *                      name: string,
 *                      description: string
 *              }>,
 *              examples: Array<string>,
 *              response: string,
 *              notes: ? Array<string>
 * }>>}
 */
const AllCommands = {
    "iw": [
        {
            "name": "!פינג",
            "description": "בדוק אם הבוט עובד",
            "usage": "!פינג",
            "examples": [
                "!פינג"
            ],
            "response": "הבוט ישיב עם הודעת \"פונג\".",
        },
        {
            "name": "!סטיקר",
            "description": "צור סטיקר ממדיה או טקסט בקלות! (שלח '!סטיקר -עזרה' לפרטים נוספים)",
            "usage": "!סטיקר [-פרמטר ערך] [מילים]",
            "parameters": [
                {
                    "name": "פרמטר",
                    "description": "הפרמטר מתחיל בסימן \"-\"",
                },
                {
                    "name": "ערך",
                    "description": "ערך הפרמטר, צריך להיות מתוך הרשימה הנתמכת (נמצאת ב '!סטיקר -עזרה')",
                },
                {
                    "name": "מילים",
                    "description": "המילים שישמשו ליצירת הסטיקר, ביצירת סטיקר ממדיה - פרמטר זה אינו נדרש.",
                }
            ],
            "examples": [
                "!סטיקר -צבע כחול אין על באבי בוט!!",
                "!סטיקר -צבע אדום -גופן אלף באבי בוט הכי בעולם!",
                "!סטיקר -צורה עיגול",
                "!סטיקר -עזרה",
            ],
            "response": "אם קיימת מדיה בהודעה הנוכחית או המצוטטת - ישלח סטיקר מהמדיה,\nאחרת הבוט ייצור סטיקר מהמילים לאחר הפקודה.",
            "notes": [
                "אם לא זוהה הפרמטר או הערך - יעשה שימוש בערך המוגדר כברירת מחדל.",
            ]
        },
        {
            "name": "!יוטיוב",
            "description": "שלח לי קישור לסרטון או טקסט לחיפוש ביוטיוב ואני אשלח לך אותו כקובץ וידאו",
            "usage": "!יוטיוב [פרמטר]",
            "parameters": [
                {
                    "name": "פרמטר",
                    "description": "קישור לסרטון ביוטיוב או טקסט לחיפוש"
                }
            ],
            "examples": [
                "!יוטיוב חנן בן ארי חנניה",
                "!יוטיוב https://www.youtube.com/watch?v=JGwWNGJdvx8"
            ],
            "response": "אם קיים קישור בהודעה - הבוט יוריד וישלח את הקובץ האודיו של הסרטון.\nאחרת, הבוט יחפש את הסרטון ביוטיוב וישלח מספר תוצאות לבחירה.",
            "notes": [
                "פקודה זו נועדה להורדת שירים בלבד! נא לא לשלוח סרטונים ארוכים",
                "קיימת הגבלה של 10 דקות לסרטון"
            ]
        },
        {
            "name": "!ברקוני",
            "description": "קבל סטיקר רנדומלי של ברקוני",
            "usage": "!ברקוני",
            "examples": [
                "!ברקוני"
            ],
            "response": "הבוט ישיב עם סטיקר רנדומלי של ברקוני.",
            "notes": [
                "יש לכם סטיקרים של ברקוני שלא נמצאים בבוט? מוזמנים לשלוח"
            ]
        },
        {
            "name": "!קופהראשית",
            "description": "קבל סטיקר רנדומלי של קופה ראשית",
            "usage": "!קופהראשית",
            "examples": [
                "!קופהראשית"
            ],
            "response": "הבוט ישיב עם סטיקר רנדומלי של קופה ראשית.",
            "notes": [
                "יש לכם סטיקרים של קופה ראשית שלא נמצאים בבוט? מוזמנים לשלוח"
            ]
        },
        {
            "name": "!גוגל",
            "description": "קבל קישור לחיפוש בגוגל לטקסט בהודעה המצוטטת או לטקסט לאחר הפקודה",
            "usage": "!גוגל [פרמטר]",
            "parameters": [
                {
                    "name": "פרמטר",
                    "description": "טקסט חיפוש בגוגל"
                }
            ],
            "examples": [
                "!גוגל [פרמטר]",
                "!גוגל "
            ],
            "response": "כאשר מצטטים הודעה - טקסט החיפוש יהיה של ההודעה המצוטטת, אחרת טקסט החיפוש יהיה הטקסט לאחר הפקודה.",
            "notes": [
                "כאשר לא נשלח אף טקסט לחיפוש - יישלח קישור כללי."
            ]
        },
        {
            "name": "!אמלק",
            "description": "קבל סיכום קצרצר של ההודעות האחרונות בשיחה",
            "usage": "!אמלק [פרמטר]",
            "parameters": [
                {
                    "name": "פרמטר",
                    "description": "מספר ההודעות לסיכום"
                }
            ],
            "examples": [
                "!אמלק",
                "!אמלק 100"
            ],
            "response": "הבוט ישיב עם סיכום ההודעות האחרונות בשיחה.",
            "notes": [
                "ניתן לקבל סיכום של עד 1000 הודעות.",
                "ברירת המחדל היא 50 הודעות."
            ]
        },
        {
            "name": "!תמלל",
            "description": "תמלל הודעה קולית",
            "usage": "!תמלל",
            "examples": [
                "!תמלל"
            ],
            "response": "הבוט ישיב עם התמלול של ההודעה הקולית.",
            "notes": [
                "הפקודה מיועדת לתורמים בלבד.",
                "לקבלת פרטים נוספים על תרומה - שלח '!תרומה'.",
                "לקבלת מידע על היתרה - שלח '!יתרה'.",
                "למשתמשים חדשים יש הגבלה עד 2 דקות תמלול."
            ]
        },
        {
            "name": "!השתק",
            "description": "השתק את הקבוצה לפי זמן מסוים",
            "usage": "!השתק [פרמטר]",
            "parameters": [
                {
                    "name": "פרמטר",
                    "description": "מספר הדקות להשתקה"
                }
            ],
            "examples": [
                "!השתק [פרמטר]",
                "!השתק 5"
            ],
            "response": "כאשר מנהל שולח את הפקודה - הקבוצה תושתק מיד, אחרת - תישלח הצבעה שלאחר כמות ההצבעות מסויימת תבוצע ההשתקה",
            "notes": [
                "המספר חייב להיות בין 1 ל60.",
                "ניתן להגדיר את כמות ההצבעות על ידי פקודת \"!הגדר\"."
            ]
        },
        {
            "name": "!בטלהשתקה",
            "description": "בטל השתקה של הקבוצה",
            "usage": "!בטלהשתקה",
            "examples": [
                "!בטלהשתקה"
            ],
            "response": "פתיחת הקבוצה לדיבורים.",
            "notes": [
                "הפקודה זמינה למנהלים בלבד."
            ]
        },
        {
            "name": "!כולם",
            "description": "תייג את כל המשתמשים בקבוצה",
            "usage": "!כולם",
            "examples": [
                "!כולם"
            ],
            "response": "הבוט יתייג את כל המשתמשים בקבוצה.",
            "notes": [
                "הפקודה זמינה למנהלים בלבד."
            ]
        },
        {
            "name": "!תרגם",
            "description": "תרגם את הטקסט בהודעה המצוטטת או את הטקסט לאחר הפקודה",
            "usage": "!תרגם [פרמטר] [טקסט]",
            "parameters": [
                {
                    "name": "פרמטר",
                    "description": "שפת היעד לתרגום"
                },
                {
                    "name": "טקסט",
                    "description": "הטקסט לתרגום"
                }
            ],
            "examples": [
                "!תרגם לאנגלית באבי בוט הוא הבוט הכי חמוד בעולם!",
                "!תרגם Babi Bot is the cutest bot in the world!",
                "!תרגם (בציטוט הודעה)",
            ],
            "response": "כאשר מצטטים הודעה - הטקסט יהיה של ההודעה המצוטטת, אחרת הטקסט יהיה הטקסט לאחר הפקודה.",
            "notes": [
                "כאשר לא זוהתה שפת יעד לתרגום - ייעשה תרגום לעברית כברירת מחדל.",
            ]
        },
        {
            "name": "!חסוםקישורים",
            "description": "חסום קישורים בקבוצה",
            "usage": "!חסוםקישורים",
            "examples": [
                "!חסוםקישורים"
            ],
            "response": "הבוט יחסום קישורים בקבוצה.",
            "notes": [
                "הפקודה זמינה למנהלים בלבד.",
                "האיסור לא יחול על מנהלים.",
            ]
        },
        {
            "name": "!בטלחסימתקישורים",
            "description": "בטל חסימת קישורים בקבוצה",
            "usage": "!בטלחסימתקישורים",
            "examples": [
                "!בטלחסימתקישורים"
            ],
            "response": "הבוט יבטל את חסימת קישורים בקבוצה.",
            "notes": [
                "הפקודה זמינה למנהלים בלבד."
            ]
        }

        // {
        //   "name": "!פקודה_נוספת",
        //   "description": "פקודה זו מאפשרת למשתמשים לבצע פעולה נוספת באמצעות בוט WhatsApp.",
        //   "usage": "!פקודה_נוספת [פרמטר]",
        //   "parameters": [
        //     {
        //       "name": "פרמטר",
        //       "description": "זהו הפרמטר לפקודה וצריך להיות מסוג מחרוזת."
        //     }
        //   ],
        //   "examples": [
        //     "!פקודה_נוספת \"שלום\"",
        //     "!פקודה_נוספת \"בוט OpenAI\""
        //   ],
        //   "response": "הבוט ישיב עם הודעת תוצאה לאחר ביצוע הפעולה עם הפרמטר שסופק.",
        //   "notes": [
        //     "ודא כי אתה מקיף את ערך הפרמטר בגרשיים אם הוא מכיל רווחים או תווים מיוחדים.",
        //     "הפקודה תלויה ברישיון."
        //   ]
        //},


    ],
    "en": [
        {
            "name": "!ping",
            "description": "Ping the bot",
            "usage": "!ping",
            "examples": [
                "!ping"
            ],
            "response": "The bot will respond with a \"pong\" message.",
        },
        {
            "name": "!sticker",
            "description": "Send me an image/video with the command, or without media, and I will turn your words into a sticker",
            "usage": "!sticker [parameter | words]",
            "parameters": [
                {
                    "name": "parameter",
                    "description": "full \\ cut \\ round \\ circular"
                }
            ],
            "examples": [
                "!sticker [parameter | words]",
                "!sticker round"
            ],
            "response": "If there is media in the current or quoted message, a sticker will be sent based on the parameter.\nOtherwise, the bot will create a sticker from the words after the command.",
            "notes": [
                "If no parameter is specified when sending media, \"full\" will be the default."
            ]
        },
        {
            "name": "!youtube",
            "description": "Send me a link to a YouTube song and I will send it back to you here",
            "usage": "!youtube [parameter]",
            "parameters": [
                {
                    "name": "parameter",
                    "description": "Link to a YouTube video or text for search"
                }
            ],
            "examples": [
                "!youtube [parameter]",
                "!youtube http"
            ],
            "response": "After processing, the bot will send the audio file of the video.",
            "notes": [
                "This command is intended for downloading songs only! Please do not send long videos.",
                "There is a 10-minute limit for the video."
            ]
        },
        {
            "name": "!barkuni",
            "description": "Get a random sticker from barkuni",
            "usage": "!barkuni",
            "examples": [
                "!barkuni"
            ],
            "response": "The bot will reply with a random barkuni sticker.",
            "notes": [
                "Do you have barkuni stickers not found in the bot? Feel free to send them."
            ]
        },
        {
            "name": "!mute",
            "description": "Mute the group for a certain amount of time",
            "usage": "!mute [parameter]",
            "parameters": [
                {
                    "name": "parameter",
                    "description": "Number of minutes for muting"
                }
            ],
            "examples": [
                "!mute [parameter]",
                "!mute 5"
            ],
            "response": "When an admin sends the command, the group will be muted immediately; otherwise, a vote will be sent, and after a certain number of votes, muting will be applied.",
            "notes": [
                "The number must be between 1 and 60.",
                "The number of votes can be set using the \"!set\" command."
            ]
        },
        {
            "name": "!unmute",
            "description": "Unmute the group",
            "usage": "!unmute",
            "examples": [
                "!unmute"
            ],
            "response": "Opening the group for conversations.",
            "notes": [
                "This command is available for administrators only."
            ]
        },
        {
            "name": "!everyone",
            "description": "Tag all group participants",
            "usage": "!everyone",
            "examples": [
                "!everyone"
            ],
            "response": "The bot will tag all group participants",
            "notes": [
                "Command is available to group administrators only."
            ]
        },
        {
            "name": "!google",
            "description": "Get a link for a Google search for the quoted message or text after the command",
            "usage": "!google [parameter]",
            "parameters": [
                {
                    "name": "parameter",
                    "description": "Text to search on Google"
                }
            ],
            "examples": [
                "!google [parameter]",
                "!google "
            ],
            "response": "When quoting a message, the search text will be from the quoted message; otherwise, the search text will be the text after the command.",
            "notes": [
                "When no search text is sent - a general link will be sent."
            ]
        }
    ]
}

// Used in HTML page
const keyNotes = {
    "iw": {
        "notes": "הערות",
        "parameters": "פרמטרים",
        "examples": "דוגמאות",
        "response": "תגובה",
        "usage": "שימוש"
    },
    "en": {
        "notes": "Notes",
        "parameters": "Parameters",
        "examples": "Examples",
        "response": "Response",
        "usage": "Usage"
    }
}

export { AllCommands, keyNotes }
