import './boot-log';
import { join } from 'path';

// A plain require keeps index.js (and its hoisted external requires) out of this chunk
// eslint-disable-next-line @typescript-eslint/no-require-imports -- must load after boot-log
require(join(__dirname, 'index.js'));
