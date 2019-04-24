import { RequestInit, Response } from 'node-fetch'
import BigNumber from 'bignumber.js'
import createPlugin, { PluginInstance } from 'ilp-plugin'

interface assetDetails {
  assetCode: string | undefined,
  assetScale: number | undefined
}

export interface FetchOptions extends RequestInit {
  maxPrice?: BigNumber.Value,
  payToken?: Buffer,
  plugin?: PluginInstance
}

export class FetchResponse extends Response {
  public price: string
  public destination?: assetDetails
  public source?: assetDetails
  constructor (response: Response, price: string, destination?: assetDetails, source?: assetDetails) {
    super(response.body, {
      headers: response.headers,
      size: response.size,
      status: response.status,
      statusText: response.statusText,
      timeout: response.timeout,
      url: response.url
    })
    this.price = price
    this.destination = destination
    this.source = source
  }
}
