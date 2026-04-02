import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, test } from 'vitest';

import { registerSpaFallback } from './spa-fallback.js';

const tempDirs = [];

afterEach(() => {
    while (tempDirs.length) {
        fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
});

function makeTempDist() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'twitcanva-spa-'));
    tempDirs.push(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
    return dir;
}

function request(server, pathname) {
    return new Promise((resolve, reject) => {
        const req = http.get({
            hostname: '127.0.0.1',
            port: server.address().port,
            path: pathname,
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk.toString(); });
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
    });
}

describe('registerSpaFallback', () => {
    test('serves index.html for root and nested frontend routes', async () => {
        const distDir = makeTempDist();
        const app = express();

        registerSpaFallback(app, distDir);

        const server = app.listen(0);
        try {
            const root = await request(server, '/');
            const nested = await request(server, '/workspace/123');

            expect(root.status).toBe(200);
            expect(root.body).toContain('<div id="root"></div>');
            expect(nested.status).toBe(200);
            expect(nested.body).toContain('<div id="root"></div>');
        } finally {
            server.close();
        }
    });

    test('does not swallow API requests', async () => {
        const distDir = makeTempDist();
        const app = express();

        app.get('/api/health', (req, res) => {
            res.json({ ok: true });
        });

        registerSpaFallback(app, distDir);

        const server = app.listen(0);
        try {
            const health = await request(server, '/api/health');
            const missingApi = await request(server, '/api/missing');

            expect(health.status).toBe(200);
            expect(health.body).toContain('"ok":true');
            expect(missingApi.status).toBe(404);
        } finally {
            server.close();
        }
    });
});
