#!/usr/bin/env node
import { stdin, stdout } from 'node:process';
import { dispatch } from './mcp-protocol.mjs';

const transportIdx = process.argv.indexOf('--transport');
const transport = transportIdx > -1 && process.argv[transportIdx + 1] ? process.argv[transportIdx + 1] : 'stdio';

if (transport === 'remote') {
  // Remote (Streamable HTTP) transport is planned but not part of M0.
  process.stderr.write('[hdcommunity-toolkit] remote transport not implemented yet; falling back to stdio\n');
}

runStdioServer();

function runStdioServer() {
  let buffer = Buffer.alloc(0);
  let useContentLengthFraming = true;

  stdin.on('close', onStdinClose);
  stdin.on('end', onStdinClose);
  stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    readFrames();
  });

  function onStdinClose() {
    process.exitCode = 0;
  }

  function readFrames() {
    for (;;) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        useContentLengthFraming = true;
        if (!parseContentLengthFrame(headerEnd)) return;
        continue;
      }
      const lf = buffer.indexOf('\n');
      if (lf !== -1) {
        useContentLengthFraming = false;
        const line = buffer.subarray(0, lf).toString('utf8').trim();
        buffer = buffer.subarray(lf + 1);
        if (line) {
          try {
            void handleMessage(JSON.parse(line));
          } catch {
            writeJsonRpcError(-32700, 'Parse error');
          }
        }
        continue;
      }
      return;
    }
  }

  function parseContentLengthFrame(headerEnd) {
    const header = buffer.subarray(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = Buffer.alloc(0);
      return true;
    }
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (buffer.length < bodyEnd) return false;
    const body = buffer.subarray(bodyStart, bodyEnd).toString('utf8');
    buffer = buffer.subarray(bodyEnd);
    try {
      void handleMessage(JSON.parse(body));
    } catch {
      writeJsonRpcError(-32700, 'Parse error');
    }
    return true;
  }

  async function handleMessage(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      writeJsonRpcError(-32600, 'Invalid Request');
      return;
    }
    if (!Object.hasOwn(message, 'id')) return;
    try {
      const result = await dispatch(message.method, message.params || {}, { sessionId: 'stdin' });
      writeMessage({ jsonrpc: '2.0', id: message.id, result });
    } catch (error) {
      writeMessage({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: Number.isSafeInteger(error.code) ? error.code : -32603,
          message: error.message,
        },
      });
    }
  }

  function writeMessage(message) {
    const json = JSON.stringify(message);
    if (useContentLengthFraming) {
      stdout.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`);
    } else {
      stdout.write(json + '\n');
    }
  }

  function writeJsonRpcError(code, message) {
    writeMessage({ jsonrpc: '2.0', id: null, error: { code, message } });
  }
}