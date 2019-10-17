//Mit WebsocketServer verbinden
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

//Config-Datei lesen mit gueltigen RFID-Codes
const fs = require('fs-extra');
const configObj = fs.readJsonSync('./config.json');

//Keyboard Events auslesen (USB-RFID Reader funkgiert als Tastatur)
const ioHook = require('iohook');

//RFID-Code wird aus 10 einzelnen Ziffern + Enter geabut
var rfidCode = "";

//Wenn Verbindung mit WSS hergestellt wird
ws.on('open', function open() {
    console.log("connected to wss");

    //Wenn eine Taste gedrueckt wird
    ioHook.on("keydown", event => {
        const rawcode = event.rawcode;

        //RFID-Codelaenge wurde noch nicht erreicht
        if (rfidCode.length < 10) {

            //Wenn Code im Ziffernbereich (48-57 = 0-9) liegt -> RFID-Code verlaengern (Code 53 entspricht Ziffer 5)
            if (rawcode >= 48 && rawcode <= 57) {
                console.log("add digit to code");
                rfidCode += (rawcode - 48);
            }

            //keine Ziffer -> Code zuruecksetzen
            else {
                console.log("no digit -> reset code");
                rfidCode = "";
            }
        }

        //RFID-Codelaenge = 10, wenn Enter kommt (Code 13)
        else if (rawcode === 13) {
            console.log("enter: final code " + rfidCode);

            //Nur RFID-Codes an WSS, die in Config hinterlegt sind
            if (rfidCode in configObj) {
                console.log("code exists in config");
                const cardData = configObj[rfidCode];

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

    //Auf Tastatureingaben reagieren
    ioHook.start();
});