import WrappedChromeRuntimePort from './wrappedChromeRuntimePort';

declare global {
  interface Window {
    chrome: any;
  }
}

enum MessageTypes {
  U2F_REGISTER_REQUEST = 'u2f_register_request',
  U2F_SIGN_REQUEST = 'u2f_sign_request',
  U2F_REGISTER_RESPONSE = 'u2f_register_response',
  U2F_SIGN_RESPONSE = 'u2f_sign_response'
}

export enum ErrorCodes {
  OK = 0,
  OTHER_ERROR = 1,
  BAD_REQUEST = 2,
  CONFIGURATION_UNSUPPORTED = 3,
  DEVICE_INELIGIBLE = 4,
  TIMEOUT = 5,
  IFRAME_NOT_SUPPORTED = 6
}

interface Request {
  type: MessageTypes;
  signRequests: SignRequest[];
  registerRequest?: RegisterRequest[];
  timeoutSeconds?: number;
  requestId?: number;
}

interface MessageEvent {
  data: Response;
}

interface SimpleMessageEvent {
  data: string;
}

interface Response {
  type: MessageTypes;
  responseData: Error | RegisterResponse | SignResponse;
  requestId?: any;
}

export interface Error {
  errorCode: ErrorCodes;
  errorMessage?: string;
  requestId?: any;
}

export interface SignRequest {
  version: string;
  challenge: string;
  keyHandle: string;
  appId: string;
}

export interface SignResponse {
  keyHandle: string;
  signatureData: string;
  clientData: string;
}

export interface RegisterRequest {
  version: string;
  challenge: string;
  appId: string;
}

export interface RegisterResponse {
  registrationData: string;
  clientData: string;
}

type PortCallback = (
  err: Error,
  port?: MessagePort | WrappedChromeRuntimePort
) => any;

export type Callback = (
  err: Error,
  resp?: Error | RegisterResponse | SignResponse
) => any;

class U2fAuth {
  private jsApiVersion: number;
  private extensionId: string;
  private port: any;
  private reqCounter: number;
  private timeout: 30;
  private callbackMap: {
    [n: number]: Callback;
  };
  private waitingForPort: PortCallback[];

  constructor() {
    this.jsApiVersion = 1;
    this.extensionId = 'kmendfapggjehodndflmmgagdbamhnfd';
    this.reqCounter = 0;
    this.callbackMap = {};
  }

  public sign(reqs: SignRequest[], callback: Callback, timeout?: number) {
    this.getPortSingleton((err, port) => {
      if (err) {
        return callback(err);
      }

      const reqId = ++this.reqCounter;
      this.callbackMap[reqId] = callback;

      const timeoutSeconds =
        typeof timeout === 'undefined' ? this.timeout : timeout;
      const request = {
        requestId: reqId,
        signRequests: reqs,
        timeoutSeconds,
        type: MessageTypes.U2F_SIGN_REQUEST
      };

      port.postMessage(request);
    });
  }

  public register(
    registerRequests: RegisterRequest[],
    signRequests: SignRequest[],
    callback: Callback,
    timeout?: number
  ) {
    this.getPortSingleton((err, port) => {
      if (err) {
        return callback(err);
      }

      const reqId = ++this.reqCounter;
      this.callbackMap[reqId] = callback;

      const timeoutSeconds =
        typeof timeout === 'undefined' ? this.timeout : timeout;
      const request = {
        registerRequests,
        requestId: reqId,
        signRequests,
        timeoutSeconds,
        type: MessageTypes.U2F_REGISTER_REQUEST
      };

      port.postMessage(request);
    });
  }

  private getPortSingleton(callback: PortCallback) {
    if (this.port) {
      callback(null, this.port);
      return;
    }

    if (!this.waitingForPort.length) {
      this.getMessagePort((err, port) => {
        if (!err) {
          this.port = port;
          this.port.addEventListener('message', this.responseHandler);
        }

        while (this.waitingForPort.length) {
          this.waitingForPort.shift()(err, port);
        }
      });
    }
    this.waitingForPort.push(callback);
  }

  private responseHandler(message: MessageEvent): void {
    const response = message.data;
    const reqId = response.requestId;

    if (!reqId || !this.callbackMap[reqId]) {
      console.error('Unknown or missing requestId in response.');
      return;
    }

    const cb = this.callbackMap[reqId];
    delete this.callbackMap[reqId];
    cb(null, response.responseData);
  }

  private getMessagePort(callback: PortCallback) {
    if (typeof window.chrome !== 'undefined' && window.chrome.runtime) {
      const message = {
        signRequests: [],
        type: MessageTypes.U2F_SIGN_REQUEST
      };
      window.chrome.runtime.sendMessage(this.extensionId, message, () => {
        if (!window.chrome.runtime.lastError) {
          this.getChromeRuntimePort(callback);
        } else {
          this.getIframePort(callback);
        }
      });
    } else {
      this.getIframePort(callback);
    }
  }

  private getChromeRuntimePort(callback: PortCallback) {
    const port = window.chrome.runtime.connect(this.extensionId, {
      includeTlsChannelId: true
    });
    setTimeout(() => callback(null, new WrappedChromeRuntimePort(port)), 0);
  }

  private disconnect(): void {
    if (this.port && this.port.port) {
      this.port.port.disconnect();
      this.port = null;
    }
  }

  private getIframePort(callback: PortCallback) {
    const iframeOrigin: string = `chrome-extension://${this.extensionId}`;
    const iframe = document.createElement('iframe');
    iframe.src = `${iframeOrigin}/u2f-comms.html`;
    iframe.setAttribute('style', 'display:none');
    document.body.appendChild(iframe);

    let hasCalledBack: boolean = false;
    const channel = new MessageChannel();
    const ready = (message: SimpleMessageEvent) => {
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
        const err = {
          errorCode: ErrorCodes.IFRAME_NOT_SUPPORTED,
          errorMessage: 'Iframe not supported'
        };
        callback(err);
      }
    }, 200);
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
