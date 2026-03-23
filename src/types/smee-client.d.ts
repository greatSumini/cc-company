declare module 'smee-client' {
  interface SmeeClientOptions {
    source: string
    target: string
    logger?: Console
  }

  class SmeeClient {
    constructor(options: SmeeClientOptions)
    start(): EventSource
  }

  export default SmeeClient
}
