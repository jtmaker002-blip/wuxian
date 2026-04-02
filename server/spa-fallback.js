import express from 'express';
import path from 'path';

function shouldServeSpa(req) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return false;
    }

    return !req.path.startsWith('/api/') &&
        req.path !== '/api' &&
        !req.path.startsWith('/library/') &&
        req.path !== '/library';
}

export function registerSpaFallback(app, distDir) {
    app.use(express.static(distDir));

    app.use((req, res, next) => {
        if (!shouldServeSpa(req)) {
            next();
            return;
        }

        res.sendFile(path.join(distDir, 'index.html'));
    });
}
