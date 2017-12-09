import WrappedChromeRuntimePort from './wrappedChromeRuntimePort';

enum MessageTypes {
  U2F_REGISTER_REQUEST = 'u2f_register_request',
  U2F_SIGN_REQUEST = 'u2f_sign_request',
  U2F_REGISTER_RESPONSE = 'u2f_register_response',
  U2F_SIGN_RESPONSE = 'u2f_sign_response'
}

enum ErrorCodes {
  OK = 0,
  OTHER_ERROR = 1,
  BAD_REQUEST = 2,
  CONFIGURATION_UNSUPPORTED = 3,
  DEVICE_INELIGIBLE = 4,
  TIMEOUT = 5
}

interface Request {
  type: MessageTypes;
  signRequests: SignRequest[];
  registerRequest?: RegisterRequest[];
  timeoutSeconds?: number;
  requestId?: number;
}

interface Response {
  type: MessageTypes;
  responseData: Error | RegisterResponse | SignResponse;
}

interface Error {
  errorCode: ErrorCodes;
  errorMessage?: string;
}

interface SignRequest {
  version: string;
  challenge: string;
  keyHandle: string;
  appId: string;
}

interface SignResponse {
  keyHandle: string;
  signatureData: string;
  clientData: string;
}

interface RegisterRequest {
  version: string;
  challenge: string;
  appId: string;
}

interface RegisterResponse {
  registrationData: string;
  clientData: string;
}

class U2fAuth {
  private jsApiVersion: number;
  private extensionId: string;
  private port: any;
  private callbackMap: {
    number: (err: Error, resp: RegisterRequest | SignResponse) => any;
  };

  constructor() {
    this.jsApiVersion = 1;
    this.extensionId = 'kmendfapggjehodndflmmgagdbamhnfd';
  }

  public register() {
    // TODO
  }

  private disconnect(): void {
    if (this.port && this.port.port) {
      this.port.port.disconnect();
      this.port = null;
    }
  }

  private getIframePort(callback: (err: any, arg?: MessagePort) => any) {
    const iframeOrigin: string = `chrome-extension://${this.extensionId}`;
    const iframe = document.createElement('iframe');
    iframe.src = `${iframeOrigin}/u2f-comms.html`;
    iframe.setAttribute('style', 'display:none');
    document.body.appendChild(iframe);

    let hasCalledBack: boolean = false;
    const channel = new MessageChannel();
    const ready = (message: MessageEvent) => {
      if (message.data === 'ready') {
        channel.port1.removeEventListener('message', ready);
        if (!hasCalledBack) {
          hasCalledBack = true;
          callback(null, channel.port1);
          return;
        }
      } else {
        console.error('First event on iframe port was not ready');
      }
    };

    channel.port1.addEventListener('message', ready);
    channel.port1.start();

    iframe.addEventListener('load', () => {
      iframe.contentWindow.postMessage('init', iframeOrigin, [channel.port2]);
    });

    setTimeout(() => {
      if (!hasCalledBack) {
        hasCalledBack = true;
        callback(new Error('iFrame extension not supported'));
      }
    }, 200);
  }

  private getMessagePort(
    callback: (arg: MessagePort | WrappedChromeRuntimePort) => any
  ) {
    // TODO
  }

  private sendRegisterRequest(
    registerRequest: RegisterRequest[],
    signRequests: SignRequest[],
    callback: (arg: Error | RegisterResponse) => any,
    timeoutSeconds?: number
  ): void {
    return;
  }
}

export default U2fAuth;
