interface VsCodeApi {
  postMessage(message: any): void;
  getState(): any;
  setState(newState: any): void;
}

declare function acquireVsCodeApi(): VsCodeApi;
