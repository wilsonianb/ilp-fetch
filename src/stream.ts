import BigNumber from 'bignumber.js'
import { createConnection } from 'ilp-protocol-stream'
import createLogger from 'ilp-logger'
import { PluginInstance } from 'ilp-plugin'
import { default as fetch } from 'node-fetch'
import { FetchOptions, FetchResponse } from './types/fetch'

const log = createLogger('ilp-fetch:stream')

export default async function streamPayment (
  url: string,
  opts: FetchOptions,
  payParams: Array<string>,
  plugin: PluginInstance,
  payToken: Buffer,
  maxPrice: BigNumber.Value
): Promise<FetchResponse> {
  const [ destinationAccount, _sharedSecret ] = payParams
  log.debug('streaming via STREAM. destination=' + destinationAccount)

  const sharedSecret = Buffer.from(_sharedSecret, 'base64')
  const connection = await createConnection({
    plugin,
    destinationAccount,
    sharedSecret
  })

  const stream = connection.createStream()
  stream.setSendMax(maxPrice)

  await new Promise(resolve => stream.on('data', resolve))

  const result = await fetch(url, opts)

  if (stream.isOpen()) {
    stream.end()
    // Wait for the stream 'end' event to be emitted so the stream can finish sending funds
    await new Promise(resolve => stream.once('end', resolve))
  }
  return new FetchResponse(result, stream.totalSent, {
    assetCode: connection.destinationAssetCode,
    assetScale: connection.destinationAssetScale
  }, {
    assetCode: connection.sourceAssetCode,
    assetScale: connection.sourceAssetScale
  })
}
