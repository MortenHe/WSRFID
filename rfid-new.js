//Mit WebsocketServer verbinden
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

//Configs laden fuer Tastatur-Input und RFID-Karten
const fs = require('fs-extra');
const inputConfig = fs.readJsonSync('./input_config.json');
const cardConfig = fs.readJsonSync('./card_config.json');

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
        const rawcode = event.rawcode;

        //RFID-Codelaenge wurde noch nicht erreicht
        if (rfidCode.length < 10) {

            //Wenn Code im Ziffernbereich (1-0 = 0-9) liegt -> Ziffer berechnen (Code 2 entspricht Ziffer 1) und RFID-Code verlaengern
            if (rawcode >= 1 && rawcode <= 11) {
                console.log("add digit to code");
                rfidCode += (rawcode - 1);
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
            if (rfidCode in cardConfig) {
                console.log("code exists in config");
                const cardData = cardConfig[rfidCode];

                //Nachricht an WSS schicken
                ws.send(JSON.stringify({
                    type: "set-rfid-playlist",
                    value: cardData
                }));
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