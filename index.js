const dotenv = require('dotenv');
dotenv.config();

const Discord = require("discord.js");
const cron = require('cron');

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.DirectMessageTyping,
    Discord.GatewayIntentBits.GuildMessageReactions,
  ],
});

function sendMessageToChannelById(channelId, messageContent) {
    const channel = client.channels.cache.get(channelId);
    if (channel) {
        channel.send(messageContent)
            .then(() => console.log(`Message sent to channel ${channelId}`))
            .catch(console.error);
    } else {
        console.error(`Channel ${channelId} not found`);
    }
}

function sendToLog(messageContent) {
  const channelId = process.env.LOG_CHANNEL_ID;
  sendMessageToChannelById(channelId, messageContent);
}

function sendToScheduling(messageContent) {
  const channelId = process.env.SCHEDULING_CHANNEL_ID;
  sendMessageToChannelById(channelId, messageContent);
}

function sendToDNDGeneral(messageContent) {
  const channelId = process.env.DNDGENERAL_CHANNEL_ID;
  sendMessageToChannelById(channelId, messageContent);
}

function sundays() {
  function showDateOfNextWeek() {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const beginDayOfTheWeek = currentDate.getDate() + 1;
      const endDayOfTheWeek = currentDate.getDate() + 7;
      sendToScheduling(`${beginDayOfTheWeek}.${month}.${year} - ${endDayOfTheWeek}.${month}.${year}`);
  }

  let currentSession = 3;
  function incrementedSession() {
    currentSession++;
    return currentSession;
  }


  let resetVotesSunday = new cron.CronJob('12 00 16 * * 7', () => {
    sendToScheduling("/clearChat");
    sendToScheduling("/resetVotes");
    sendToScheduling("DND Woche " + incrementedSession().toString());
    showDateOfNextWeek();
  }
                                          , null, true, 'Europe/Berlin');

  resetVotesSunday.start();


  let compareVotesSunday = new cron.CronJob('12 00 21 * * 7', () => {
    sendToScheduling("/compareVotes");
  }
                                          , null, true, 'Europe/Berlin');

  compareVotesSunday.start();
}



// let job1 = new cron.CronJob('01 05 01,13 * * *', test); // fires every day, at 01:05:01 and 13:05:01
// let job2 = new cron.CronJob('00 00 08-16 * * 1-5', test); // fires from Monday to Friday, every hour from 8 am to 16


const weekdays = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'];

client.on("ready", () => {
  console.log(`Ligged in as ${client.user.tag}!`);

  sendToLog(`time to die`);

  sundays();


});


    let messageIDs = {};

    client.on("messageCreate", async msg => {
      if (msg.content === "/clearChat" && msg.channel.name === "scheduling") {
        try {
          const fetched = await msg.channel.messages.fetch({ limit: 100 });
          msg.channel.bulkDelete(fetched, true);
        } catch (error) {
          console.error('Error occurred while clearing messages:', error);
        }
      }
    });

    let currentGuildId = '';
    client.on("messageCreate", async msg => {
      currentGuildId = msg.guild.id

      const d20Emoji = msg.guild.emojis.cache.find(emoji => emoji.name === "d20");

      if (msg.content === "/resetVotes" && msg.channel.name === "scheduling") {
        try {
          const fetched = await msg.channel.messages.fetch({ limit: 100 });
          msg.channel.bulkDelete(fetched, true);
        } catch (error) {
          console.error('Error occurred while clearing messages:', error);
        }

        for (let i = 0; i < weekdays.length; i++) {
          try {
            const sentMessage = await msg.channel.send(weekdays[i]);  
            messageIDs[weekdays[i]] = sentMessage.id;
            if (d20Emoji) {
              await sentMessage.react(d20Emoji);
            } else {
              console.log("Custom emoji 'd20' not found.");
            }
          } catch (error) {
            console.error('Error occurred while sending message or reacting:', error);
          }
        }
        sendToDNDGeneral(`${process.env.TABLETOP_PING} Die Votes wurden resetted \n Voted für die nächste Woche! \nhttps://discord.com/channels/${currentGuildId}/${process.env.SCHEDULING_CHANNEL_ID}`);
      }
    });

  client.on("messageReactionRemove", async (reaction, user) => {
    try {
      if (weekdays.includes(reaction.message.content.toLowerCase())) {
        sendToLog(`${user.tag} kann doch nicht am ${reaction.message.content} 😢.`);
      }
    } catch (error) {
      console.error("Error occurred while handling removed reaction:", error);
    }
  });

client.on("messageCreate", async msg => {
  if (msg.content === "/compareVotes") {
    sendToLog("Comparing votes...");
    const d20Emoji = msg.guild.emojis.cache.find(emoji => emoji.name === "d20");

    let maxFoundCount = 0;
    let maxFoundDay = "Keiner";

    try {
      for (let i = 0; i < weekdays.length; i++) {
        const messageReacted = await client.channels.cache.get(process.env.SCHEDULING_CHANNEL_ID).messages.fetch(messageIDs[weekdays[i]]);
        const reactions = messageReacted.reactions.cache;

        console.log(`${weekdays[i]} reactions count: ${reactions.size}`); // Log reaction count

        await Promise.all(reactions.map(async reaction => {
          const emojiName = reaction._emoji.name;
          const emojiCount = reaction.count - 1;
          const reactionUsers = await reaction.users.fetch();

          if (emojiName === "d20") {
            if (emojiCount > maxFoundCount && emojiCount > 0) {
              maxFoundCount = emojiCount;
              maxFoundDay = weekdays[i];
            } else if (emojiCount === maxFoundCount && emojiCount > 0) {
              maxFoundDay += ` & ${weekdays[i]}`;
            }
          }
        }));
      }

      console.log(`Max found day: ${maxFoundDay}, Count: ${maxFoundCount}`);

      if (maxFoundDay === "Keiner") {
        sendToDNDGeneral(`Keiner hat gewählt.`);
      }
      else if (weekdays.includes(maxFoundDay)) {
        sendToDNDGeneral(`${process.env.TABLETOP_PING} ${maxFoundDay} hat mit ${maxFoundCount} Votes die Übereinstimmung.`);
      } else {
        sendToDNDGeneral(`${process.env.TABLETOP_PING} ${maxFoundDay} haben mit ${maxFoundCount} Votes die Übereinstimmung.`);
      }
      // es braucht noch eine condition wenn die maxFoundCount == 1 ist 

      if (maxFoundCount < 4 && maxFoundCount > 0) {
        msg.channel.send("Wir haben nicht genügend Arbeiter my lord. \nSoll eine D&D Runde diese Woche dennoch organisiert werden?");
      }
    } catch (error) {
      console.error("Error occurred while comparing votes:", error);
    }
  }
});


client.on("messageReactionAdd", async (reaction, user) => {
  const d20Emoji = reaction.message.guild.emojis.cache.find(emoji => emoji.name === "d20");

  try {
    if (weekdays.includes(reaction.message.content.toLowerCase())) {

      if (user.bot) return;

      if (reaction.emoji.name === "d20" && d20Emoji) {
        sendToLog(`${user.tag} kann am ${reaction.message} ${d20Emoji}`);
      }
    }
  } catch (error) {
    console.error("Error occurred while fetching message or sending reaction message:", error);
  }
});

client.login(process.env.DISCORD_TOKEN);
