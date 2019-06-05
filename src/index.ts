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
let cardsJson: Card[] = null;
let lastCheked: number;

const commands = new Map<String, Command>();

const client = new Client();

/**
 * Register a new command that will execute when any user types it's name on the
 * chat, with the corresponding prefix.
 * @param name
 * @param desc
 * @param fn
 */
export function registerCommand(name: string, desc: string, fn: (msg: Message) => void) {

  commands.set(name, {
    fn: fn,
    desc: desc,
  });

}
/**
 * Transforms the message into a CommandInfo, separating the name of the command
 * and its arguments if any.
 * @param msg
 */
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

/**
 * Send a simple message as soon as the bot is ready to be used.
 */
client.on('ready', () => {

  console.log(`Logged in as ${client.user.tag}!`);
  fetchCardsJson();

});

/**
 * Check if the message is a valid command an execute the corresponding code.
 */
client.on('message', (msg: Message) => {

  const command = getCommandInfo(msg);

  if (command !== null && commands.has(command.name)) {

    commands.get(command.name).fn(msg);

  }

});

/**
 * Attempt to login as with the given toekn.
 */
client.login(process.env.DISCORD_TOKEN).catch((reason) => {
  console.log(reason);
});

/**
 * Shows the available commands and a little description of what they do.
 * @param msg
 */
function help(msg: Message) {
  let cmds = '';

  for (const [key, cmd] of commands) {
    cmds += `${PREFIX}${key} - ${cmd.desc}\n\n`;
  }

  msg.channel.send(`Available commands:\n\`\`\`${cmds}\`\`\``);
}

registerCommand('help', 'Shows the available commands', help);

/**
 * Tries to convert the text containing the cards list into a Json.
 * @param text
 * @param msg
 */
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

/**
 * Searches the cards.json for a card that matches the name and returns the ID
 * of the matching card.
 * @param name
 */
function getIdFromName(name: string): number | null {
  for (const card of cardsJson) {
    if (card.title == name.trim()) {
      return card.id;
    }
  }

  return null;
}

/**
 * Turns the Json object into a string and removes {, } and " before encoding
 * into a Base64 string.
 * @param json
 */
function encodeJson(json: Json): string {
  const regex = /[{}"]/gm;
  const str = JSON.stringify(json).replace(regex, '');
  const result = Base64.encodeURI(str);
  return result;
}

/**
 * Fetches the cards list, but only if it has not been done before or 1 minute
 * has passed since the last time it was fetched.
 */
function fetchCardsJson(msg?: Message) {
  const now = Date.now();
  try {
    if (cardsJson === null || now - lastCheked >= 60000) {
        request(CARDS_JSON, function(error, response, body) {
          if (error) throw error;

          cardsJson = JSON.parse(body);
          lastCheked = now;
          if (msg) generateUrl(msg);
        });
    } else if (msg) {
      generateUrl(msg);
    }
  } catch (e) {
    console.log('Error while trying to fetch cards.json\n' + e);
  }
}

/**
 * Generate the URL based on the card list from the message and sends it to the
 * channel.
 * @param msg
 */
function generateUrl(msg: Message) {
  if (cardsJson !== null) {
    const deck = getCommandInfo(msg).args || '';
    const json = textToJson(deck, msg);

    if (json === null) {
      return;
    }

    const url = VIEW_DATA + encodeJson(json);

    msg.channel.send(url);
  }
}

/**
 * Generates a Kards Deck Builder URL based on the cards list on the message and
 * sends the URL to the channel.
 * @param msg
 */
function kdb(msg: Message) {
  try {
    fetchCardsJson(msg);
  } catch (e) {
    console.log('cards.json cannot be parsed.\n' + e);
  }
}

registerCommand('kdb', 'Generate a Kards Deck Builder URL from a deck in text format', kdb);