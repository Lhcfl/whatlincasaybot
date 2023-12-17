import TelegramBot, {
  InlineQueryResultArticle,
  Message,
} from "node-telegram-bot-api";
import DB from "./lib/db.js";
import fuse, { FuseResult } from "fuse.js";
import { createHash } from "crypto";

const config = {
  name: "whatdidlincasaybot",
  token: "",
};


// The bot to sync posts
const bot = new TelegramBot(config.token, {
  polling: {
    interval: 2000,
  },
  // @ts-expect-error proxy
  request: {
    proxy: "http://127.0.0.1:10809"
  }
  // webhook: true,
});

const db = new DB();

const users = db.defineDataBase<boolean>("joinedUsers", {
  saveInSeconds: 0,
  autoDeleteInSecond: 0,
});

const messages = db.defineDataBase<Message[]>("messages", {
  autoDeleteInSecond: 86400,
});

const fuzzyOptions = { keys: ["text"] };

const messageLib = Object.keys(messages).map(id => messages[id]).reduce((a, b) => a.concat(b), []);

const msgsearch = new fuse(messageLib, fuzzyOptions);


bot.on("message", (msg) => {
  if (!msg.text) return;
  if (!msg.from?.id) return;
  if (msg.text.length > 128) return;
  if (msg.text.startsWith(`/join@${config.name}`)) {
    bot.sendMessage(msg.chat.id, "加入成功", { reply_to_message_id: msg.message_id });
    users[msg.from?.id] = true;
  }
  if (msg.text.startsWith(`/quit@${config.name}`)) {
    bot.sendMessage(msg.chat.id, "退出成功", { reply_to_message_id: msg.message_id });
    users[msg.from?.id] = true;
  }
  if (msg.from?.id && users[msg.from?.id]) {
    messages[msg.from.id].push(msg);
    messageLib.push(msg);
    msgsearch.add(msg);
    console.log("[add record]", msg.text);
  }
});

const mkres : (x: FuseResult<TelegramBot.Message>[] | typeof messageLib) => InlineQueryResultArticle[] = (x) => x.map(res => {
  let txt = "";
  if ("text" in res && res.text) {
    txt = res.text;
  } else if ("item" in res && res.item.text) {
    txt = res.item.text;
  }
  return {
    type: "article",
    id: createHash("md5").update(txt).digest("hex"),
    title: txt,
    input_message_content: {
      message_text: txt,
    } 
  } as InlineQueryResultArticle;
}).slice(0, 20);

bot.on("inline_query", (query) => {
  console.log("[query from ", query.from.username, "]: ", query.query);
  if (query.query.trim() === "") {
    messageLib.sort(() => Math.random() - 0.5);
    bot.answerInlineQuery(query.id, mkres(messageLib));
  } else {
    const res = msgsearch.search(query.query);
    console.log("result:");
    console.log(res);
    bot.answerInlineQuery(query.id, mkres(res));
  }
});

bot.setMyCommands([
  {
    command: "join",
    description: "加入我们的语录收集",
  },
  {
    command: "quit",
    description: "退出我们的语录收集",
  }
]);