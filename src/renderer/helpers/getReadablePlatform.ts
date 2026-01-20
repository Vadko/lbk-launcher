export const getReadablePlatform = (platform: string) => {
  switch (platform) {
    case "steam":
      return "Steam";
    case "epic":
      return "Epic Games Store";
    case "gog":
      return "GOG";
    case "emulator":
      return "Емулятор";
    case "other":
      return "Інша";
  }
};
