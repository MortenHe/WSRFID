//Port 8080 (audio player), 9090 (sh audio player), 7070 (soundquiz)
const port = parseInt(process.argv[2]);

//Mit WebsocketServer verbinden
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:' + port);

//Beep-Ton bei RFID
const singleSoundPlayer = require('node-wav-player');

//Configs laden fuer Tastatur-Input und RFID-Karten
const fs = require('fs-extra');

//HTTP Aufruf bei Wechsel zwischen audio und sh audio
const http = require('http');

//Configs
const configFile = fs.readJsonSync(__dirname + "/../AudioServer/config.json");
const audioDir = configFile.audioDir;
const audioFilesDir = audioDir + "/wap/mp3";
const jsonDir = audioDir + "/wap/json";
const cardConfig7070 = fs.readJsonSync(audioDir + "/soundquiz/soundquiz_rfid.json");
const randomConfig8080 = fs.readJsonSync(audioDir + "/wap/json/random_rfid.json");
const cardConfig9090 = fs.readJsonSync(audioDir + "/shp/shp_rfid.json");

//Keyboard-Eingaben auslesen (USB RFID-Leser ist eine Tastatur)
const InputEvent = require('input-event');
const input = new InputEvent(configFile.USBRFIDReaderInput);
const keyboard = new InputEvent.Keyboard(input);

//RFID-Karten der Player sammeln
const cards = {};

//Soundquiz-Karten
for (let key in cardConfig7070) {
    cards[key] = cardConfig7070[key];
    cards[key]["port"] = 7070;
};

//Random Karten sammeln
const randomData = [];
for (let key in randomConfig8080) {
    const value = randomConfig8080[key].value;

    //Bereich anlegen bei randomArr, z.B. "hsp/bibi-tina"
    randomData[value] = [];

    //Karteninfos sammeln
    cards[key] = [];
    cards[key]["value"] = value;
    cards[key]["port"] = 8080;
    cards[key]["random"] = true;
};

//SH Player Karten
for (let key in cardConfig9090) {
    cards[key] = cardConfig9090[key];
    cards[key]["port"] = 9090;
};

//Audio Player Karten aus JSON-Config des Player Clients ermitteln, dazu ueber alle JSON-Files gehen
const audiolist = fs.readJSONSync(jsonDir + "/audiolist.json");
for (const [mode, data] of Object.entries(audiolist)) {
    for (const file of data.filter.filters) {

        //Filter "all" hat keine JSON-Datei
        if (file.id !== "all") {

            //JSON-Datei laden (janosch.json)
            const filePath = jsonDir + "/" + mode + "/" + file.id + ".json";
            const jsonData = fs.readJSONSync(filePath);

            //Ueber Playlists gehen
            for (const obj of jsonData) {

                //RFID-Karten sammeln
                if (obj.rfid) {
                    cards[obj.rfid] = {
                        "mode": mode,
                        "name": obj.name,
                        "lang": obj.lang || "de-DE",
                        "path": file.id + "/" + obj.file,
                        "port": 8080
                    }
                }

                //Wenn es fuer diesen Bereich (hsp/bibi-tina) eine Randomkarte gibt, Playlist darin merken
                if (randomData[mode + "/" + file.id]) {
                    randomData[mode + "/" + file.id].push({
                        "mode": mode,
                        "name": obj.name,
                        "lang": obj.lang || "de-DE",
                        "path": file.id + "/" + obj.file,
                        "port": 8080
                    });
                }
            }
        }
    }
}

//Welches sind die Stanard-Kartenaktionen in dieser App (audio player -> playlist aendern)
const defaultType = {
    "7070": "send-card-data",
    "8080": "set-rfid-playlist",
    "9090": "set-audio-mode",
};

//RFID-Code wird aus 10 einzelnen Ziffern + Enter geabut
var rfidCode = "";

//Wenn Verbindung mit WSS hergestellt wird
ws.on('open', function open() {
    console.log("connected to wss");

    //Wenn eine Taste gedrueckt wird (RFID Reader sendet Tastaturbefehle)
    keyboard.on('keyup', (event) => {
        const rawcode = event.code;

        //RFID-Codelaenge wurde noch nicht erreicht
        if (rfidCode.length < 10) {

            //Wenn Code im Ziffernbereich (2-11 = 0-9) liegt -> Ziffer berechnen (Code 2 entspricht Ziffer 1) und RFID-Code verlaengern
            if (rawcode >= 2 && rawcode <= 11) {
                const digit = ((rawcode - 1) % 10)
                //console.log("add digit to code " + digit);
                rfidCode += digit;
            }

            //keine Ziffer -> Code zuruecksetzen
            else {
                console.log("no digit -> reset code");
                rfidCode = "";
            }
        }

        //RFID-Codelaenge = 10, wenn Enter kommt (Code 28)
        else if (rawcode === 28) {
            console.log("enter: final code " + rfidCode);
            playSound("rfid");

            //Nur RFID-Codes bearbeiten, die in Config hinterlegt sind
            if (rfidCode in cards) {
                console.log("code exists in config");

                //let, weil Variable bei Random ueberschrieben wird
                let cardData = cards[rfidCode];
                const cardDataPort = cardData.port;

                //Wenn wir nicht im passenden Player sind
                if (port !== cardDataPort) {
                    console.log("switch to player " + cardDataPort)
                    switch (cardDataPort) {

                        //Karte kommt vom Soundquiz -> Soundquiz-Server oder -Player starten
                        case 7070:

                            //wenn moeglich schon direkt ein Spiel starten
                            let suffix = "";

                            //Soundquiz-Server oder Player starten?
                            let soundquizType = "soundquiz";
                            switch (cardData.type) {

                                //Soundquiz-Player starten
                                case "start-server-player":
                                    soundquizType = "soundquizplayer";
                                    break;

                                //Bei Game-Select Karte -> dieses Spiel starten
                                case "game-select":
                                    suffix = "&gameSelect=" + cardData.value;
                                    break;

                                //Bei Antwortkarte -> 1. hinterlegtes Spiel dieser Karte starten
                                case "answer":
                                    suffix = "&gameSelect=" + cardData.games[0];
                                    break;
                            }

                            //Soundquiz oder Soundquiz-Player starten
                            switch (soundquizType) {

                                //Soundquiz-Server starten
                                case "soundquiz":
                                    http.get("http://localhost/php/activateAudioApp.php?mode=soundquiz" + suffix);
                                    break;

                                //Soundquiz-Player starten
                                case "soundquizplayer":
                                    http.get("http://localhost/php/activateAudioApp.php?mode=soundquizplayer");
                                    break;
                            }
                            break;

                        //Karte ist fuer Audioplayer: lastSession.json schreiben und Audio Player starten (dieser laedt lastSession.json beim Start und liest Name der Playlist)
                        case 8080:

                            //Soll der Name der Playlist vorgelesen werden?
                            let readPlaylist = false;

                            //Wenn es eine Randomkarte ist, zufaellige Playlist aus einer Serie (z.B. bebl) oder eines Bereichs (z.B. kindermusik) auswaehlen
                            if (cardData.random) {
                                result = randomData[cardData.value];
                                cardData = result[Math.floor(Math.random() * result.length)];
                                readPlaylist = true;
                            }

                            //lastSession Objekt schreiben
                            fs.writeJsonSync(__dirname + "/../AudioServer/lastSession.json", {
                                path: audioFilesDir + "/" + cardData.mode + "/" + cardData.path,
                                activeItem: cardData.path,
                                activeItemName: cardData.name,
                                activeItemLang: cardData.lang || "de-DE",
                                position: 0,
                                readPlaylist: readPlaylist
                            });

                            //Player starten per HTTP starten
                            http.get("http://localhost/php/activateAudioApp.php?mode=audio");
                            break;

                        //Karte kommt von SH Player -> SH Player in passendem Modus starten (kids vs. sh)
                        case 9090:
                            http.get("http://localhost/php/activateAudioApp.php?mode=sh&audioMode=" + cardData.audioMode);
                            break;
                    }
                }

                //Fuer diese Karte laueft bereits der richtige Player (=Port)
                else {

                    //Wechsel zwischen Soundquiz und Soundquiz Player ermoeglichen
                    //Wenn wir bereits im Soundquiz oder Soundquiz Player sind und eine weitere Soundquiz / Sounduizplayerkarte kommt - aber keine Antwortkarte
                    if (cardDataPort === 7070 && cardData.type !== "answer") {

                        //Den Serverplayer starten
                        if (cardData.type === "start-server-player") {
                            http.get("http://localhost/php/activateAudioApp.php?mode=soundquizplayer");
                        }

                        //Das Soundquiz im gewuneschten Modus starten
                        else if (cardData.type === "game-select") {
                            console.log("goto quiz " + cardData.value)
                            http.get("http://localhost/php/activateAudioApp.php?mode=soundquiz&gameSelect=" + cardData.value);
                        }
                    }

                    //Karte kommt tatsaechlich aus dem gleichen Player -> Nachricht an WSS schicken
                    else {

                        //welcher Modus soll gestartet werden
                        let type = defaultType[port];

                        //Wenn es eine Randomkarte ist, zufaellige Playlist aus einer Serie (z.B. bebl) oder eines Bereichs (z.B. kindermusik) auswaehlen
                        if (cardData.random) {
                            result = randomData[cardData.value];
                            cardData = result[Math.floor(Math.random() * result.length)];
                            type = "set-playlist-read";
                        }

                        ws.send(JSON.stringify({
                            type: type,
                            value: cardData
                        }));
                    }
                }
            }
            else {
                console.log("code is not in config");
            }

            //RFID-Code wieder zuruecksetzen, entweder nach erfolgreichem Senden oder bei Code, der nicht in Config ist
            rfidCode = "";
        }

        //Abschlusszeichen war kein Enter -> Code zuruecksetzen
        else {
            console.log("no enter: reset code");
            rfidCode = "";
        }
    });
});

//Einzelsound abspielen
function playSound(sound) {
    singleSoundPlayer.play({ path: audioDir + "/sounds/" + sound + ".wav" });
}