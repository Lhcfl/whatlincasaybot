import TelegramBot, {
  InlineQueryResultArticle,
} from "node-telegram-bot-api";
import DB from "./lib/db.js";
import fuse, { FuseResult } from "fuse.js";
import crypto from "crypto";

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

const users = db.defineDataBase<boolean>("joinedUsers", false, {
  saveInSeconds: 0,
  autoDeleteInSecond: 0,
});

const messages = db.defineDataBase<string[]>("messages", [], {
  autoDeleteInSecond: 0,
  saveInSeconds: 0,
});

const said = db.defineDataBase<boolean>("said", false, {
  autoDeleteInSecond: 0,
  saveInSeconds: 0,
});

const messageLib = Object.keys(messages).map(id => messages[id]).reduce((a, b) => a.concat(b), ["喵"]);
const messageSearch = Object.keys(messages).map(id => messages[id]).reduce((a, b) => a.concat(b), ["喵"]);

const msgsearch = new fuse(messageSearch);


bot.on("message", (msg) => {
  if (!msg.text) return;
  if (!msg.from?.id) return;
  if (msg.text.length > 128) return;
  if (msg.text.startsWith(`/join@${config.name}`)) {
    bot.sendMessage(msg.chat.id, "加入成功", { reply_to_message_id: msg.message_id });
    users[msg.from?.id] = true;
    return;
  }
  if (msg.text.startsWith(`/quit@${config.name}`)) {
    bot.sendMessage(msg.chat.id, "退出成功", { reply_to_message_id: msg.message_id });
    users[msg.from?.id] = true;
    return;
  }
  if (said[msg.text.trim()]) return;
  if (msg.from?.id && users[msg.from?.id]) {
    const s = msg.text.trim();
    said[s] = true;
    messages[msg.from.id].push(s);
    messages[msg.from.id] = messages[msg.from.id];
    messageLib.push(s);
    msgsearch.add(s);
    console.log("[add record]", msg.text);
  }
});

const mkres : (x: FuseResult<string>[] | typeof messageLib) => InlineQueryResultArticle[] = (x) => x.map(res => {
  let txt = res;
  if (typeof res !== "string") {
    txt = res.item;
  }
  return {
    type: "article",
    id: crypto.randomUUID(),
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
    console.log(mkres(messageLib));
    bot.answerInlineQuery(query.id, mkres(messageLib), {
      cache_time: 5,
    });
  } else {
    const res = msgsearch.search(query.query);
    console.log("querying ", query.query, "result:");
    console.log(mkres(res));
    bot.answerInlineQuery(query.id, mkres(res), {
      cache_time: 5,
    });
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