export interface MessageEvent {
  data: string;
}

export default class WrappedChromeRuntimePort {
  public port: any;

  constructor(port) {
    this.port = port;
  }

  public addEventListener(
    eventName: string,
    handler: (arg: MessageEvent) => any
  ) {
    const name: string = eventName.toLowerCase();

    if (name === 'message' || name === 'onmessage') {
      this.port.onMessage.addListener(message => {
        handler({ data: message });
        return;
      });
    }

    console.error('WrappedChromeRuntimePort only supports onMessage');
  }

  public postMessage(message) {
    this.port.postMessage(message);
  }
}
