import aws from 'aws-sdk';
import cuid from 'cuid';
import express from 'express';
import mime from 'mime';

export function s3xpress(options: S3xpressOptions): express.RequestHandler {
  const defaultOptions: Partial<S3xpressOptions> = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_DEFAULT_REGION,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'private',
    expires: 900,
    keyPrefix: 'original-',
    maxSize: 100000,
    minSize: 0,
  };

  options = { ...defaultOptions, ...options };

  const s3 = new aws.S3({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    region: options.region,
    signatureVersion: 'v4',
  });

  const router = express.Router();

  router.get('/uploads', async (req, res, next) => {
    try {
      const { filename, contentType = mime.getType(filename) } = req.query;

      if (!filename) {
        res.status(400).json({ message: 'Query param filename is missing.' });
        return;
      }

      const key = cuid();

      const param: aws.S3.PresignedPost.Params = {
        Bucket: options.bucket,
        Expires: options.expires,
        Conditions: [
          ['content-length-range', options.minSize, options.maxSize],
          ['starts-with', '$Key', options.keyPrefix],
        ],
        Fields: {
          'acl': options.acl,
          'Key': `${options.keyPrefix}${key}/${filename}`,
          'X-Key': key,
        },
      };

      if (contentType && param.Fields) {
        param.Fields['Content-Type'] = contentType;
      }

      const data: aws.S3.PresignedPost = await new Promise((resolve, reject) =>
        s3.createPresignedPost(param, (err, data) =>
          err ? reject(err) : resolve(data),
        ),
      );

      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  router.get('/uploads/:id', async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(404).end();
      }

      const param: any = {
        Bucket: options.bucket,
      };

      const objects = await s3
        .listObjectsV2({
          ...param,
          Prefix: `${options.keyPrefix}${id}`,
        })
        .promise();

      if (!objects || !objects.Contents || objects.Contents.length <= 0) {
        return res.status(404).end();
      }

      const url = await new Promise<string>((resolve, reject) =>
        s3.getSignedUrl(
          'getObject',
          { Key: objects.Contents![0].Key, Expires: options.expires, ...param },
          (err, url) => (err ? reject(err) : resolve(url)),
        ),
      );

      res.redirect(url);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export interface S3xpressOptions {
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  acl?: import('aws-sdk').S3.ObjectCannedACL;
  keyPrefix?: string;
  expires?: number;
  minSize?: number;
  maxSize?: number;
}
