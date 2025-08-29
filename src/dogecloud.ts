import axios, { AxiosResponse } from 'axios'
import * as crypto from 'crypto'
import * as querystring from 'querystring'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3'
import { ReadStream } from 'fs'

type DogeCloudApiResponse<T = any> = {
  code: number
  msg: string
  data: T
}

type DogeCloudS3TmpToken = {
  Credentials: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken: string
  }
  ExpiredAt: number
  Buckets: {
    name: string
    s3Bucket: string
    s3Endpoint: string
  }[]
}

type DogeCloudError = {
  errno: number
  msg: string
}

export class DogeCloud {
  private s3Client?: S3Client
  private tmpToken?: DogeCloudS3TmpToken
  private tokenExpireTime: number = 0

  constructor(
    private accessKey: string,
    private secretKey: string,
    private bucket: string
  ) {}

  async uploadFile(key: string, file: Buffer): Promise<string> {
    const s3 = await this.initS3Client()

    const resp = await s3.send(
      new PutObjectCommand({
        Bucket: this.tmpToken?.Buckets[0].s3Bucket!,
        Key: key,
        Body: file
      })
    )

    return key
  }

  async deleteFile(key: string) {
    const s3 = await this.initS3Client()

    await s3.send(
      new DeleteObjectCommand({
        Bucket: this.tmpToken?.Buckets[0].s3Bucket!,
        Key: key
      })
    )
  }

  async allFiles(): Promise<string[]> {
    const s3 = await this.initS3Client()

    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: this.tmpToken?.Buckets[0].s3Bucket!
      })
    )

    return response.Contents?.map(item => item.Key!).filter(Boolean) || []
  }

  async initS3Client(): Promise<S3Client> {
    if (this.s3Client) {
      return this.s3Client
    }
    const token = await this.getTmpToken()
    const s3 = new S3Client({
      region: 'auto',
      endpoint: token.Buckets[0].s3Endpoint,
      credentials: {
        accessKeyId: token.Credentials.accessKeyId,
        secretAccessKey: token.Credentials.secretAccessKey,
        sessionToken: token.Credentials.sessionToken
      }
    })
    this.s3Client = s3
    return this.s3Client
  }

  async getTmpToken(): Promise<DogeCloudS3TmpToken> {
    const now = Math.floor(Date.now() / 1000)
    if (this.tmpToken && this.tokenExpireTime > now + 300) {
      return this.tmpToken
    }

    const tokenData = await this.dogecloudApi<DogeCloudS3TmpToken>(
      '/auth/tmp_token.json',
      {
        channel: 'OSS_FULL',
        scopes: [`${this.bucket}:*`]
      },
      true
    )

    this.tmpToken = tokenData
    this.tokenExpireTime = tokenData.ExpiredAt

    return tokenData
  }

  private async dogecloudApi<T = any>(
    apiPath: string,
    data: Record<string, any> = {},
    jsonMode: boolean = false
  ): Promise<T> {
    const body: string = jsonMode
      ? JSON.stringify(data)
      : querystring.encode(data)
    const sign: string = crypto
      .createHmac('sha1', this.secretKey)
      .update(Buffer.from(apiPath + '\n' + body, 'utf8'))
      .digest('hex')
    const authorization: string = 'TOKEN ' + this.accessKey + ':' + sign

    const response: AxiosResponse<DogeCloudApiResponse<T>> =
      await axios.request({
        url: 'https://api.dogecloud.com' + apiPath,
        method: 'POST',
        data: body,
        responseType: 'json',
        headers: {
          'Content-Type': jsonMode
            ? 'application/json'
            : 'application/x-www-form-urlencoded',
          Authorization: authorization
        }
      })

    if (response.data.code !== 200) {
      const error: DogeCloudError = {
        errno: response.data.code,
        msg: 'API Error: ' + response.data.msg
      }
      throw error
    }

    return response.data.data
  }
}
