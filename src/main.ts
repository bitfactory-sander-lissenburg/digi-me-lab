import {
  establishSession,
  getGuestAuthorizeUrl,
  getSessionData,
  getAuthorizeUrl,
  getCreatePostboxUrl,
  pushDataToPostbox,
  getPostboxImportUrl,
  getReceiptUrl
} from '@digime/digime-js-sdk';
import * as fs from 'fs';
import * as express from 'express';
import { TwingEnvironment, TwingLoaderFilesystem } from 'twing';
import * as path from 'path';

const appId = '';
const contractId = 'fJI8P5Z4cIhP3HawlXVvxWBrbyj5QkTF';
const pushContractId = 'Cb1JC2tIatLfF7LH1ksmdNx4AfYPszIn';
const key = fs.readFileSync(__dirname + '/../digi-me-private.key');

const main = async () => {
  // Establish session for only twitter posts
  const session = await establishSession(appId, contractId, {
    serviceGroups: [
      {
        id: 1,
        serviceTypes: [
          {
            id: 3,
            serviceObjectTypes: [
              {
                id: 2
              }
            ]
          }
        ]
      }
    ]
  });

  console.log(session);

  const app = express();
  const loader = new TwingLoaderFilesystem('./src/templates');
  const twing = new TwingEnvironment(loader);

  app.get('/', (req, res) => {
    const url = getAuthorizeUrl(
      appId,
      session,
      `${req.protocol}://${req.headers.host}/digi-me-callback?sessionId=${session.sessionKey}`
    );

    console.log(url);

    twing.render('index.twig', { url }).then(output => {
      res.end(output);
    });
  });

  app.get('/digi-me-callback', (req, res) => {
    console.log(req.query.sessionKey);

    const data = getSessionData(
      req.query.sessionKey,
      key,
      ({ fileData, fileName, fileDescriptor }) => {
        console.log('success!');
        console.log(fileData);
        // console.log(fileName);
        // console.log(fileDescriptor);
      },
      ({ fileName, error }) => {
        console.log('error!');
        // console.log(fileName);
        console.log(error);
      }
    );

    twing
      .render('callback.twig', { sessionKey: req.query.sessionKey })
      .then(output => {
        res.end(output);
      });
  });

  app.get('/postbox', (req, res) => {
    twing
      .render('postbox.twig', {
        url: `${req.protocol}://${req.headers.host}/get-test-results`
      })
      .then(output => {
        res.end(output);
      });
  });

  app.get('/get-test-results', async (req, res) => {
    const session = await establishSession(appId, pushContractId);

    const url = await getCreatePostboxUrl(
      appId,
      session,
      `${req.protocol}://${req.headers.host}/push-test-results?sessionKey=${session.sessionKey}`
    );

    res.redirect(url);
  });

  app.get('/push-test-results', async (req, res) => {
    const { result, postboxId, publicKey, sessionKey } = req.query;

    const canPush =
      result === 'SUCCESS' && postboxId && publicKey && sessionKey;

    if (!canPush) {
      res.render('pages/error');
      return;
    }

    const filePath = `${__dirname}/../test2.csv`;
    const file = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    try {
      await pushDataToPostbox(sessionKey, postboxId, publicKey, {
        fileData: file.toString('base64'),
        fileName,
        fileDescriptor: {
          mimeType: 'text/csv',
          tags: ['result'],
          reference: [fileName],
          accounts: [{ accountId: '1' }]
        }
      });
    } catch (e) {
      console.log(e);
    }

    twing
      .render('download.twig', { url: getPostboxImportUrl() })
      .then(output => {
        res.end(output);
      });
  });

  app.get('/get-receipt', (req, res) => {
    twing
      .render('receipt.twig', { url: getReceiptUrl(appId, pushContractId) })
      .then(output => {
        res.end(output);
      });
  });

  app.listen(3000, () => {
    console.log(`Listing on port 3000`);
  });
};

main();
