const InputEvent = require('input-event');
const input = new InputEvent('/dev/input/event6');
const keyboard = new InputEvent.Keyboard(input);

keyboard.on('keyup', (event) => {
    console.log(event.code - 1);
});
