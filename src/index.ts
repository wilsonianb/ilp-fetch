import { default as fetch } from 'node-fetch'
import createLogger from 'ilp-logger'
import * as crypto from 'crypto'
import createPlugin from 'ilp-plugin'
import { default as handleStreamRequest } from './stream'
import { FetchOptions, FetchResponse } from './types/fetch'

const base64url = (buffer: Buffer) => buffer.toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')

const log = createLogger('ilp-fetch')

const PSK_IDENTIFIER = 'interledger-psk'
const PSK_2_IDENTIFIER = 'interledger-psk2'
const STREAM_IDENTIFIER = 'interledger-stream'

export default async function ilpFetch (url: string, _opts: FetchOptions): Promise<FetchResponse> {
  // Generate the payment token to go along with our requests
  const payToken = _opts.payToken || crypto.randomBytes(16)
  const payTokenText = base64url(payToken)

  // Add the payment token to the headers
  const headers = Object.assign({},
    (_opts.headers || {}),
    { 'Pay-Token': payTokenText })

  // Make the request for the first time---if the endpoint is paid, this will
  // fail.
  log.info('attempting http request. url=' + url, 'opts=', _opts)
  const opts = Object.assign({}, _opts, { headers })
  const firstTry = await fetch(url, opts)

  // If the request succeeded, just return the result. Keep going if payment is
  // required.
  if (firstTry.status !== 402) {
    log.info('request is not paid. returning result.')
    return new FetchResponse(firstTry, '0')
  }

  const maxPrice = opts.maxPrice
  const plugin = opts.plugin || createPlugin()

  if (!maxPrice) {
    throw new Error('opts.maxPrice must be specified on paid request')
  }

  // Parse the `Pay` header to determine how to pay the receiver. A handler is
  // selected by checking what the payment method is.
  const [ payMethod, ...payParams ] = firstTry.headers.get('Pay')!.split(' ')
  log.trace('parsed `Pay` header. method=' + payMethod, 'params=', payParams)

  if (payMethod !== STREAM_IDENTIFIER) {
    if (payMethod === PSK_IDENTIFIER) {
      log.warn('PSK1 is no longer supported. use `superagent-ilp` for legacy PSK.')
    } else if (PSK_2_IDENTIFIER) {
      log.warn('PSK2 is no longer supported.')
    }
    log.error('no handler exists for payment method. method=' + payMethod)
    throw new Error('unsupported payment method in `Pay`. ' +
      'header=' + firstTry.headers.get('Pay'))
  }

  log.trace('using STREAM handler.')
  const handler = handleStreamRequest

  log.trace('connecting plugin')
  await plugin.connect()

  log.trace('calling handler.')
  const result = await handler(url, opts, payParams, plugin, payToken, maxPrice)

  // clean up the plugin if ilp-fetch created it
  if (!opts.plugin) {
    await plugin.disconnect()
  }

  return result
}
