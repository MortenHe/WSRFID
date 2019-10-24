//Port 8080 (audio player), 9090 (sh audio player), 7070 (soundquiz)
const port = process.argv[2] || 8080;

//Mit WebsocketServer verbinden
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:' + port);

//Configs laden fuer Tastatur-Input und RFID-Karten
const fs = require('fs-extra');
const inputConfig = fs.readJsonSync(__dirname + '/config_input.json');
const cardConfig = fs.readJsonSync(__dirname + '/config_cards.json');

//welches sind die Stanard-Kartenaktionen in dieser App (audio player -> playlist aendern)
const defaultType = {
    "7070": "send-card-data",
    "8080": "set-rfid-playlist",
    "9090": "set-audio-mode",
};

//Nur Umschaltkarten (audio -> sh audio) und Karten dieser App (ueber Port identifiziert) sollen ausgewertet werden
cardConfigLocal = Object.assign(cardConfig["all"], cardConfig[port]);

//HTTP Aufruf bei Wechsel zwischen audio und sh audio
const http = require('http');

//Keyboard-Eingaben auslesen (USB RFID-Leser ist eine Tastatur)
const InputEvent = require('input-event');
const input = new InputEvent(inputConfig.input);
const keyboard = new InputEvent.Keyboard(input);

//RFID-Code wird aus 10 einzelnen Ziffern + Enter geabut
var rfidCode = "";

//Wenn Verbindung mit WSS hergestellt wird
ws.on('open', function open() {
    console.log("connected to wss");

    //Wenn eine Taste gedrueckt wird
    keyboard.on('keyup', (event) => {
        const rawcode = event.code;

        //RFID-Codelaenge wurde noch nicht erreicht
        if (rfidCode.length < 10) {

            //Wenn Code im Ziffernbereich (2-11 = 0-9) liegt -> Ziffer berechnen (Code 2 entspricht Ziffer 1) und RFID-Code verlaengern
            if (rawcode >= 2 && rawcode <= 11) {
                const digit = ((rawcode - 1) % 10)
                console.log("add digit to code " + digit);
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

            //Nur RFID-Codes an WSS, die in Config hinterlegt sind
            if (rfidCode in cardConfigLocal) {
                console.log("code exists in config");
                const cardData = cardConfigLocal[rfidCode];

                //Welche Art von Befehl soll ausgefuhert werden?
                const type = cardData.type || defaultType[port];

                //Playerwechsel (audio vs. sh vs. soundquiz) per PHP Aufruf
                if (type === "activateApp") {
                    console.log("change to app " + cardData.mode)
                    http.get("http://localhost/php/activateApp.php?mode=" + cardData.mode);
                }

                //Nachricht an WSS schicken
                else {
                    ws.send(JSON.stringify({
                        type: type,
                        value: cardData
                    }));
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