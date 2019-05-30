import { config } from 'dotenv';
import { Client, Message } from 'discord.js';
import request from 'request';
import { Base64 } from 'js-base64';

config();


type Card = {
  faction: string;
  id: number;
  image: string;
  kredits: number;
  rarity: string;
  text: string;
  title: string;
  type: string;
}

type Command = {
  fn: (msg: Message) => void,
  desc: string
}

type CommandInfo = {
  name: string,
  args: string | null
}

interface Json {
  [key: string]: any
}

const PREFIX = '.';
const BASE_URL = 'https://kardsdeck.opengamela.com/';
const VIEW_DATA = BASE_URL + 'view?data=';
const CARDS_JSON = BASE_URL + 'assets/data/cards.json';
let cardsJson: Card[];

const commands = new Map<String, Command>();

const client = new Client();

export function registerCommand(name: string, desc: string, fn: (msg: Message) => void) {

  commands.set(name, {
    fn: fn,
    desc: desc,
  });

}

export function getCommandInfo(msg: Message): CommandInfo | null {

  if (msg.content.substr(0, PREFIX.length) !== PREFIX) return null;

  const to = msg.content.indexOf(' ') !== -1 ? msg.content.indexOf(' ') : undefined;
  const name = msg.content.substring(1, to);
  const args = to ? msg.content.substring(to).trim() : null;

  return {
    name: name,
    args: args
  };

}

client.on('ready', () => {

  console.log(`Logged in as ${client.user.tag}!`);

});

client.on('message', (msg: Message) => {

  const command = getCommandInfo(msg);

  if (command !== null && commands.has(command.name)) {

    commands.get(command.name).fn(msg);

  }

});

client.login(process.env.DISCORD_TOKEN).catch((reason) => {
  console.log(process.env, reason);
});

function help(msg: Message) {
  let cmds = '';

  for (const [key, cmd] of commands) {
    cmds += `${PREFIX}${key} - ${cmd.desc}\n\n`;
  }

  msg.channel.send(`Available commands:\n\`\`\`${cmds}\`\`\``);
}

registerCommand('help', 'Shows the available commands', help);

function textToJson(text: string, msg: Message): Json | null {
  const cardRegex = /^(\d)x \(\dK\) (.+)$/;
  const json: Json = {};
  const cards = text.split('\n').filter((line: string) => {
    return line.search(cardRegex) !== -1;
  });

  if (cards.length == 0) {
    msg.channel.send('Format was incorrect.');
    return null;
  }

  for (const card of cards) {
    const matched = card.match(cardRegex);
    const id = getIdFromName(matched[2]);
    const amount = parseInt(matched[1]);
    if (id == null) return null;
    json[id] = amount;
  }

  return json;
}

function getIdFromName(name: string): number | null {
  for (const card of cardsJson) {
    if (card.title == name.trim()) {
      return card.id;
    }
  }

  return null;
}

function encodeJson(json: Json): string {
  const regex = /[{}"]/gm;
  const str = JSON.stringify(json).replace(regex, '');
  const result = Base64.encodeURI(str);
  console.log(result);
  return result;
}

function kdb(msg: Message) {
  const deck = getCommandInfo(msg).args;

  // TODO: await Http Request CARDS_JSON
  try {
    request(CARDS_JSON, function(error, respone, body) {
      if (error) throw error;

      cardsJson = JSON.parse(body);
      const json = textToJson(deck, msg);

      if (json === null) {
        console.log('json null');
        return;
      }

      const url = VIEW_DATA + encodeJson(json);

      msg.channel.send(url);
    });
  } catch (e) {
    console.log('cards.json cannot be parsed.');
  }
}

registerCommand('kdb', 'Generate a Kards Deck Builder URL from a deck in text format', kdb);