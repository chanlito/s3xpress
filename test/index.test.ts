import cors from 'cors';
import express from 'express';

import { s3xpress } from '../src';

const app = express();

const { PORT = '3002' } = process.env;

app.use(cors());

app.use(
  s3xpress({
    accessKeyId: 'XXX',
    secretAccessKey: 'XXX',
    region: 'ap-southeast-1',
    bucket: 'uploads',
    acl: 'private',
    keyPrefix: 'original-',
    minSize: 0,
    maxSize: 1000000 * 500, // 5 mb
  }),
);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
