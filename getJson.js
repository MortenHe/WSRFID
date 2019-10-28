const fs = require('fs-extra');
const { JSONPath } = require('jsonpath-plus');

cards = {};

const audiolist = fs.readJSONSync("C:/Apache24/htdocs/MortenHe/AudioClient/src/assets/json/pw/audiolist.json");
for (let [mode, data] of Object.entries(audiolist)) {
    for (file of data.filter.filters) {
        if (file.id !== "all") {
            let filePath = "C:/Apache24/htdocs/MortenHe/AudioClient/src/assets/json/pw/" + mode + "/" + file.id + ".json";
            const json = fs.readJSONSync(filePath);
            const result = JSONPath({ path: '$..rfid^', json });
            for (let obj of result) {
                cards[obj.rfid] = {
                    "allowRandom": data.allowRandom,
                    "mode": mode,
                    "name": obj.name,
                    "path": file.id + "/" + obj.file,
                    "port": 8080
                }
            }
        }
    }
}

console.log(cards);