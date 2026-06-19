/** True for main or numpad Enter. */
export function isConfirmKey(event: Pick<KeyboardEvent, 'code' | 'key'>): boolean {
    return event.code === 'Enter' || event.code === 'NumpadEnter' || event.key === 'Enter';
}

export function resetKeyboard(scene: Phaser.Scene) {
    scene.input.keyboard?.resetKeys();
}

/** Clear Phaser's duplicate-key suppression so the next Enter registers. */
export function clearKeyboardHistory(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin & {
        prevCode?: number;
        prevTime?: number;
        prevType?: string;
    };

    if (!keyboard) {
        return;
    }

    keyboard.resetKeys();
    keyboard.prevCode = -1;
    keyboard.prevTime = -1;
    keyboard.prevType = '';
}
