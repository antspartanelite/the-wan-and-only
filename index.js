// require the modules
const fs = require('fs');
const readline = require('readline');

const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const { YTSearcher } = require('ytsearcher');
const youtubeCrawler = require("youtube-sr").default;



// create a new Discord client
const client = new Discord.Client();

//create song queue
let songQueue = [];
let quizQueue = [];

const {token, ytAPIkey, } = require('./config.json'); 

const youtube = new YTSearcher(ytAPIkey);

var isSongPlaying = false;



var quizMessageChannel = null;
var playerArray = [];
var songAuthorGuessed = false;
var songNameGuessed = false;
var passes = 0;

// when the client is ready, run this code
// this event will trigger whenever your bot:
// - finishes logging in
// - reconnects after disconnecting
client.on('ready', () => {
    console.log("Hello There!");
});

function quizNext(voiceChannel){
    songAuthorGuessed = false;
    songNameGuessed = false;
    passes = 0;
    quizMessageChannel.send("The song was "+quizQueue[0][0][0]+" by "+quizQueue[0][1][0]);
    quizQueue.shift();
    if(quizQueue.length > 0){
        playerArray.sort(function(a, b){return b.Score-a.Score});
        let toSend = "The current ranking is:\n";
        for(var i=0; i<playerArray.length;i++){
            toSend += playerArray[i].Name+": "+playerArray[i].Score+"\n";
            playerArray[i].Passed = false;       
        }
        quizMessageChannel.send(toSend);
        playSong([quizQueue[0][0][0]," by ", quizQueue[0][1][0]].join(), voiceChannel, quizMessageChannel);
    }
    else{
        playerArray.sort(function(a, b){return b.Score-a.Score});
        let toSend = "The quiz is over, the final ranking is:\n";
        for(var i=0; i<playerArray.length;i++){
            toSend += playerArray[i].Name+": "+playerArray[i].Score+"\n";       
        }
        quizMessageChannel.send(toSend);
        quizMessageChannel = null;
        songAuthorGuessed = false;
        songNameGuessed = false;
        playerArray = [];
        quizQueue = [];
    }
}

//Returns a specific lines from a text file
async function findLines(fileToRead, lineNumbers) {
  const fileStream = fs.createReadStream(fileToRead);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input.txt as a single line break.
  let lineNumber = 0;
  linesToReturn = [];
  for await (const line of rl) {
    for (var i=0; i < lineNumbers.length; i++){
        if(lineNumbers[i] == lineNumber){
            linesToReturn.push(line);        
        }        
    }
    lineNumber++;
  }
  return linesToReturn;
}


async function playSong(songUrl, voiceChannel, messageChannel, spareLinks=[]) {
    //If message is not a youtube url will search for video using key terms on youtube
    if(!songUrl.startsWith("https://www.youtube.com/watch?v=")){
        console.log(songUrl);
        try{
            await youtubeCrawler.search(songUrl, { limit: 8 })
            .then(x => {
                spareLinks = x;
                songUrl = spareLinks[0].url;
                console.log("crawler");
                console.log(songUrl);
                streamMusic(songUrl, voiceChannel, messageChannel, spareLinks)
            });
        }
        catch(error){
            console.log(error);
            let newLink = await youtube.search(songUrl);
            console.log(newLink.first.url);
            songUrl = newLink.first.url;
            spareLinks = newLink.currentPage;
        }
        
    }       
}


function streamMusic(songUrl, voiceChannel, messageChannel, spareLinks=[]) {
    try{
        console.log(songUrl);
        if(!quizMessageChannel){
            messageChannel.send("now playing "+songUrl);
        } 
        const originalMessage = songUrl.toString();
        voiceChannel.join().then(connection => {
          const dispatcher = connection.play(ytdl(songUrl, {filter: "audioonly"}));
          dispatcher.on('finish', end => {
            if(songQueue.length > 0 && isSongPlaying == true){
                playSong(songQueue[0].slice(9), voiceChannel, messageChannel);
                songQueue.shift();
                return;                
            }else if(quizMessageChannel){
                quizNext(voiceChannel);
            }
            else{
                isSongPlaying = false;
                voiceChannel.leave();
                return messageChannel.send("The queue has been completed"); 
            }
          });
            dispatcher.on('error', error => {if(spareLinks.length == 0){messageChannel.send("Invalid URL(s)");}else{
                messageChannel.send("Url unavailable trying another");
                spareLinks.shift();
                playSong(spareLinks[0].url, voiceChannel, messageChannel, spareLinks)
            }});
        }).catch(err => console.log(err))
    }
    catch(error){
        console.log(error);
    }
}

// login to Discord with your app's token
client.login(token);

client.on('message', message => {
    //if (message.author.bot) return;
    if (message.author === client.user) return;

    if(message.content.startsWith("obi!play")){
        if(!message.member.voice.channel){
            return message.reply("You are not in a voice channel");  
        }
        if(quizMessageChannel){
            return message.reply("A quiz is now playing please wait until it is finished");                    
        }
        if(message.content == "obi!play"){
            if(isSongPlaying == false){
                if(songQueue.length > 0){
                    playSong(songQueue[0].slice(9), message.member.voice.channel, message.channel);
                    songQueue.shift();
                    isSongPlaying = true;
                    return;                
                }
                return message.reply("The queue is empty!");  
            }
            return message.reply("I am already playing songs from the queue");       
        }
        else{
            isSongPlaying = true;
            playSong(message.content.slice(9), message.member.voice.channel, message.channel);
        }
    }
    if(message.content.startsWith("obi!pause")){
        message.guild.voice.connection.dispatcher.pause();
    }
    if(message.content.startsWith("obi!resume")){
        message.guild.voice.connection.dispatcher.resume();
    }

    if(message.content.startsWith("obi!queue add ")){
        if(message.content.length < 15){
            return message.reply("You didn't enter a valid song"); 
        }
        songQueue.push("obi!play "+message.content.slice(14));
        message.channel.send("You have added: "+message.content.slice(14)+" to the queue");
    }
    else if(message.content.startsWith("obi!queue remove ")){
        if(Number.isInteger(Number(message.content.slice(17))) && message.content.slice(17) <= songQueue.length && message.content.slice(17) > 0){
            message.channel.send("Queue entry "+message.content.slice(17)+" - "+songQueue[Number(message.content.slice(17)-1)].slice(9)+ " - has been removed from the queue");
            songQueue.splice(Number(message.content.slice(17))-1, 1);
            return;
        }
        return message.reply("You didn't enter a valid queue index! Please check if it is in bounds.");
    }
    else if(message.content == "obi!queue"){
        var tmp = "Queue:\n";
        for (var i = 0; i < songQueue.length; i++) {
            tmp += (i+1).toString()+": "+songQueue[i].slice(9)+"\n";
        } 
        message.channel.send(tmp);
    }
    else if(message.content == "obi!queue clear"){
        songQueue = [];
        return message.channel.send("The queue has been cleared");
    }
    else if(message.content == "obi!queue skip"){
        if(message.guild.voice == null || message.guild.voice.channel == null){
            return message.reply("I'm not in a voice channel at the moment");
        }
        if(quizMessageChannel){
            return message.reply("A quiz is currently playing, please wait until it has finished");
        }
        if(songQueue.length >= 1){
            playSong(songQueue[0].slice(9), message.guild.voice.channel, message.channel);
            songQueue.shift();
            return;              
        }
        isSongPlaying = false;
        message.guild.voice.channel.leave();  
        return message.channel.send("The queue has been completed");
    }
    else if(message.content == "obi!queue save"){
        fs.writeFile('./music/songqueue.json',JSON.stringify(songQueue), function (err) {
            if (err) {
                console.error('Crap happens');
            }
        });
        return;              
    }
    else if(message.content == "obi!queue load"){
        fs.readFile('./music/songqueue.json', (err, data) => {
            if (err) throw err;
            songQueue = JSON.parse(data);
        });
        return;              
    }

    message.content = message.content.toLowerCase();

    if(message.content === "hi" || message.content.indexOf("hello") != -1){
        message.channel.send("", {
        files: [
            "./Hello There.png"
        ]
        });
    }

    if(message.content.indexOf("underestimate") != -1 && message.content.indexOf("power") != -1){
        message.channel.send("Don't try it!");
    }
    else if(message.content.indexOf("my new ") != -1){
        message.content = message.content + ".";
        var words = message.content.split(" ");
        var t = 0;
        var index;
        var questions = [];
        for (var i = 0; i < words.length; i++) {
          if (words[i] === "my") {
            words[i] = "your";
            t = 1;
            index = i;
          }
          if((words[i][words[i].length - 1] === "." || words[i][words[i].length - 1] === "," || words[i][words[i].length - 1] === "?" || words[i][words[i].length - 1] === "!") && t === 1){
            t = 0;
            questions.push(words.slice(index,i + 1));
          }
        }
        for(var i = 0; i < questions.length; i++){
            questions[i] = questions[i].join(" ");
            questions[i] = questions[i].slice(0,questions[i].length-1) + "?";
            message.channel.send(questions[i]);
        }
    }

    if(message.content.indexOf("politics") != -1 || message.content.indexOf("politician") != -1 || message.content.indexOf("brexit") != -1 || message.content.indexOf("conservatives") != -1 || message.content.indexOf("republican") != -1 || message.content.indexOf("democrat") != -1){
        message.channel.send("Oh no, I'm not brave enough for politics");
    }

    if(message.content.indexOf("theresa may") != -1 || message.content.indexOf("hillary clinton") != -1 || message.content.indexOf("padme") != -1 || message.content.indexOf("margaret thatcher") != -1 || message.content.indexOf("angela merkel") != -1){
        message.channel.send("Don't forget, she's a politician, and they're **not** to be trusted.");
    }

    if(message.content.startsWith("obi!invite")){
        message.channel.send("https://discord.com/api/oauth2/authorize?client_id=806342829995065435&permissions=70339648&scope=bot");
    }

    else if(message.content == "obi!leave"){
        if(message.guild.voice != null && message.guild.voice.channel != null){
            isSongPlaying = true
            message.guild.voice.channel.leave();        
        }
        else{
            message.reply("I'm not in a voice channel at the moment"); 
        }
    }
    else if(message.content == "obi!music-quiz"){
        if(!message.member.voice.channel){
            return message.reply("You are not in a voice channel");  
        }
        message.channel.send("Welcome to the wan and only discord music quiz, the aim of the quiz is to guess the author and the song name correctly\nThe quiz will be starting in\n5");
        let i = 4        
        var counter = setInterval(() => {
            message.channel.send(i.toString()); 
            i-=1; 
            if(i==0){
                quizQueue = [];
                for(var j = 0; j < 7; j++){
                    quizQueue.push(Math.floor(Math.random() * 479));                  
                }
                console.log(quizQueue);
                findLines('./music/spotifysongsreformatted', quizQueue).then(function(result){
                    for(var j=0; j<result.length;j++){
                        result[j] = result[j].toLowerCase().split(" by ");
                        result[j][0] = result[j][0].split(" | ");
                        result[j][1] = result[j][1].split(" | ");
                    }
                    console.log(result);
                    quizMessageChannel = message.channel;
                    isSongPlaying = false;
                    quizQueue = result;
                    playSong([quizQueue[0][0][0]," by ", quizQueue[0][1][0]].join(), message.member.voice.channel, quizMessageChannel);
                });
                clearInterval(counter);
            }
        }, 1000); 
    }
    else if(message.channel == quizMessageChannel && message.content == "obi!pass"){
        for(i in playerArray){
            if(playerArray[i].Id == message.author.id && playerArray[i].Passed == false){
                passes+=1;
                message.channel.send(passes.toString()+"/"+Math.ceil((playerArray.length/2)+0.0001)+"votes required to pass the song have been cast"); 
                playerArray[i].Passed = true;
            }
        }
        if(passes>playerArray.length/2){
            quizNext(message.guild.voice.channel);                
        }
    }
    else if(message.channel == quizMessageChannel){
        let isInArray = false;
        let userIndex = 0;
        var reacted = false;
        for(i in playerArray){
            if(playerArray[i].Id == message.author.id){
                isInArray = true;
                userIndex = i;
            }
        }
        if(!isInArray){
            playerArray.push({Id:message.author.id, Score:0, Name:message.author.username, Passed:false});
            userIndex = playerArray.length-1;
        }
        if(!songNameGuessed){
            for(i in quizQueue[0][0]){
                if(message.content.indexOf(quizQueue[0][0][i]) != -1 ){
                    songNameGuessed = true;
                    reacted = true;
                }
            }
            if(songNameGuessed){
                playerArray[userIndex].Score += 1;
                message.react("✅");   
            }        
        }
        if(!songAuthorGuessed){
            for(i in quizQueue[0][1]){
                if(message.content.indexOf(quizQueue[0][1][i]) != -1 ){
                    songAuthorGuessed = true;
                }
            }
            if(songAuthorGuessed){
                playerArray[userIndex].Score += 1;  
                if(!reacted){
                        message.react("✅");
                }
            }
            else if(!reacted){
                    message.react("❌");                
            }        
        }
        if(songAuthorGuessed && songNameGuessed){
            quizNext(message.guild.voice.channel);
        }
        
    }
});
