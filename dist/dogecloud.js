"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DogeCloud = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
const querystring = __importStar(require("querystring"));
const client_s3_1 = require("@aws-sdk/client-s3");
class DogeCloud {
    constructor(accessKey, secretKey, bucket) {
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.bucket = bucket;
        this.tokenExpireTime = 0;
    }
    async uploadFile(key, file, contentType) {
        var _a;
        const s3 = await this.initS3Client();
        const resp = await s3.send(new client_s3_1.PutObjectCommand({
            Bucket: (_a = this.tmpToken) === null || _a === void 0 ? void 0 : _a.Buckets[0].s3Bucket,
            Key: key,
            Body: file,
            ContentType: contentType || 'application/octet-stream'
        }));
        return key;
    }
    async deleteFile(key) {
        var _a;
        const s3 = await this.initS3Client();
        await s3.send(new client_s3_1.DeleteObjectCommand({
            Bucket: (_a = this.tmpToken) === null || _a === void 0 ? void 0 : _a.Buckets[0].s3Bucket,
            Key: key
        }));
    }
    async allFiles() {
        var _a, _b;
        const s3 = await this.initS3Client();
        const response = await s3.send(new client_s3_1.ListObjectsV2Command({
            Bucket: (_a = this.tmpToken) === null || _a === void 0 ? void 0 : _a.Buckets[0].s3Bucket
        }));
        return ((_b = response.Contents) === null || _b === void 0 ? void 0 : _b.map(item => item.Key).filter(Boolean)) || [];
    }
    async refreshUrls(urls) {
        await this.dogecloudApi('/cdn/refresh/add.json', {
            rtype: 'path',
            urls: JSON.stringify(urls)
        }, true);
    }
    async initS3Client() {
        if (this.s3Client) {
            return this.s3Client;
        }
        const token = await this.getTmpToken();
        const s3 = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: token.Buckets[0].s3Endpoint,
            credentials: {
                accessKeyId: token.Credentials.accessKeyId,
                secretAccessKey: token.Credentials.secretAccessKey,
                sessionToken: token.Credentials.sessionToken
            }
        });
        this.s3Client = s3;
        return this.s3Client;
    }
    async getTmpToken() {
        const now = Math.floor(Date.now() / 1000);
        if (this.tmpToken && this.tokenExpireTime > now + 300) {
            return this.tmpToken;
        }
        const tokenData = await this.dogecloudApi('/auth/tmp_token.json', {
            channel: 'OSS_FULL',
            scopes: [`${this.bucket}:*`]
        }, true);
        this.tmpToken = tokenData;
        this.tokenExpireTime = tokenData.ExpiredAt;
        return tokenData;
    }
    async dogecloudApi(apiPath, data = {}, jsonMode = false) {
        const body = jsonMode
            ? JSON.stringify(data)
            : querystring.encode(data);
        const sign = crypto
            .createHmac('sha1', this.secretKey)
            .update(Buffer.from(apiPath + '\n' + body, 'utf8'))
            .digest('hex');
        const authorization = 'TOKEN ' + this.accessKey + ':' + sign;
        const response = await axios_1.default.request({
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
        });
        if (response.data.code !== 200) {
            const error = {
                errno: response.data.code,
                msg: 'API Error: ' + response.data.msg
            };
            throw error;
        }
        return response.data.data;
    }
}
exports.DogeCloud = DogeCloud;
//# sourceMappingURL=dogecloud.js.map