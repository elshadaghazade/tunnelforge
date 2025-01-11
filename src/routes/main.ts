import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import terraformPaths from '../terraform-binary-paths.json'
import { ensureTerraformBinary } from '../terraform-installation';
import { existsSync } from 'fs';

const CONFIG_PATH = path.join(path.dirname(__dirname), 'client-config.json');

const router = express.Router();

router.get('/terraform_versions', async (_, res) => {
    res.json({
        versions: Object.keys(terraformPaths)
    })
});

router.get('/install_terraform/:version', async (req, res) => {
    const { version } = req.params;
    
    await ensureTerraformBinary(version as any);

    res.json({
        result: 'ok'
    })
});

router.get('/config', async (_, res) => {
    
    if (!existsSync(CONFIG_PATH)) {
        res.json({});
        return;
    }
    const config = await fs.readFile(CONFIG_PATH, 'utf-8');
    res.json(config);
});

router.put('/config', async (req, res) => {
    try {
        const body = req.body;

        const config = existsSync(CONFIG_PATH) ? JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8')) : {};
        if (body.RECONNECT_INTERVAL && config.RECONNECT_INTERVAL !== body.RECONNECT_INTERVAL) {
            config.RECONNECT_INTERVAL = body.RECONNECT_INTERVAL;
        }

        if (body.PROXY_SERVER_MAIN_HOST && config.PROXY_SERVER_MAIN_HOST !== body.PROXY_SERVER_MAIN_HOST) {
            config.PROXY_SERVER_MAIN_HOST = body.PROXY_SERVER_MAIN_HOST;
        }

        if (body.CLIENT_PARAM_SERVER_HOST && config.CLIENT_PARAM_SERVER_HOST !== body.CLIENT_PARAM_SERVER_HOST) {
            config.CLIENT_PARAM_SERVER_HOST = body.CLIENT_PARAM_SERVER_HOST;
        }

        if (body.CLIENT_PARAM_SERVER_PORT && config.CLIENT_PARAM_SERVER_PORT !== body.CLIENT_PARAM_SERVER_PORT) {
            config.CLIENT_PARAM_SERVER_PORT = body.CLIENT_PARAM_SERVER_PORT;
        }

        if (body.CLIENT_PARAM_LOCAL_APP_HOST && config.CLIENT_PARAM_LOCAL_APP_HOST !== body.CLIENT_PARAM_LOCAL_APP_HOST) {
            config.CLIENT_PARAM_LOCAL_APP_HOST = body.CLIENT_PARAM_LOCAL_APP_HOST;
        }

        if (body.CLIENT_PARAM_LOCAL_APP_PORT && config.CLIENT_PARAM_LOCAL_APP_PORT !== body.CLIENT_PARAM_LOCAL_APP_PORT) {
            config.CLIENT_PARAM_LOCAL_APP_PORT = body.CLIENT_PARAM_LOCAL_APP_PORT;
        }

        if (body.IAM_ID && config.IAM_ID !== body.IAM_ID) {
            config.IAM_ID = body.IAM_ID;
        }

        if (body.IAM_SECRET && config.IAM_SECRET !== body.IAM_SECRET) {
            config.IAM_SECRET = body.IAM_SECRET;
        }

        await fs.writeFile(CONFIG_PATH, JSON.stringify(config), 'utf-8');

        res.json({
            result: 'ok'
        });

    } catch (err) {
        res.status(500).json({
            error: err
        });
    }

})

export default router;