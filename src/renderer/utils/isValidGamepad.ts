/**
 * Validate that the gamepad is a real controller, not a phantom device.
 * Some USB devices (multimedia keyboards, special mice, racing wheels without proper drivers, etc.)
 * can be incorrectly detected as gamepads by the browser.
 */
export function isValidGamepad(gp: Gamepad | null): gp is Gamepad {
  if (!gp) return false;

  // Must have standard button layout (at least 12 buttons like Xbox/PS controllers)
  if (gp.buttons.length < 12) return false;

  // Must have at least 2 axes (left stick)
  if (gp.axes.length < 2) return false;

  // Filter out known phantom/non-standard devices by checking ID
  const id = gp.id.toLowerCase();

  // Blacklist: devices that are NOT gamepads (joysticks, HOTAS, racing wheels, etc.)
  const nonGamepadPatterns = [
    // Flight sim devices
    'joystick',
    'stick',
    'flight',
    'hotas',
    'throttle',
    'rudder',
    'pedals',
    'yoke',
    't16000', // Thrustmaster T.16000M
    't.16000',
    // Flight sim brands (primarily make non-gamepad controllers)
    'thrustmaster',
    'saitek',
    'ch products',
    'vkb',
    'virpil',
    'winwing',
    // Racing wheels
    'wheel',
    'racing',
    'fanatec',
    'moza',
  ];

  if (nonGamepadPatterns.some((pattern) => id.includes(pattern))) {
    console.log('[Gamepad] Rejecting non-gamepad device:', gp.id);
    return false;
  }

  // Known valid gamepad patterns (brands and types)
  const validGamepadPatterns = [
    'xbox',
    'xinput',
    'playstation',
    'dualshock',
    'dualsense',
    'switch',
    'nintendo',
    'sony',
    'microsoft',
    '8bitdo',
    'logitech gamepad',
    'logitech dual',
    'steelseries',
    'razer',
    'hori',
    'powera',
    'pdp',
    'hyperkin',
    'mayflash',
    'brook',
    'gamesir',
  ];

  // Check if it matches a known gamepad brand
  if (validGamepadPatterns.some((pattern) => id.includes(pattern))) {
    return true;
  }

  // For generic devices, check if they have typical gamepad characteristics
  // Standard gamepads have 4 axes (2 sticks) and 16+ buttons
  if (gp.axes.length >= 4 && gp.buttons.length >= 16) {
    return true;
  }

  // Reject unknown devices that don't match gamepad patterns
  console.log('[Gamepad] Rejecting unrecognized device:', gp.id, {
    buttons: gp.buttons.length,
    axes: gp.axes.length,
  });
  return false;
}
