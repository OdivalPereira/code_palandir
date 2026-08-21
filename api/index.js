import { handleRequest } from '../server/index.js';

export default async function handler(req, res) {
  return handleRequest(req, res);
}
