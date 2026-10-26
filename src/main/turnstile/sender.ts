interface SenderFrame {
  readonly parent: object | null;
  readonly origin: string;
}

interface IpcSender {
  readonly sender: object;
  readonly senderFrame: SenderFrame | null;
}

// The page is remote: only the captcha window's top frame, still on the page's origin, is heard
export function isFromCaptchaPage(
  event: IpcSender,
  contents: object,
  origin: string
): boolean {
  const frame = event.senderFrame;
  return (
    event.sender === contents &&
    frame !== null &&
    frame.parent === null &&
    frame.origin === origin
  );
}
