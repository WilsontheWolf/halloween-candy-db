import fs from 'node:fs/promises';
import koa from 'koa';
import koaRouter from '@koa/router';
import path from 'node:path';

const app = new koa();

const router = new koaRouter();

const mimes = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    ico: 'image/x-icon',
    svg: 'image/svg+xml',
};

const getFile = async (name, ctx) => {
    const data = await fs.readFile(path.join('./public', name), 'utf-8');
    const file = path.extname(name).replace('.', '');
    ctx.body = data;
    ctx.type = mimes[file] || 'text/plain';
};

(async () => {
    let data;
    try {
        data = JSON.parse(await fs.readFile('data/final.json', 'utf-8'));

    } catch (e) {
        console.error('Error loading data', e);
        process.exit(1);
    }

    router.get('/', async (ctx) => {
        await getFile('index.html', ctx);
    });

    router.get('/main.js', async (ctx) => {
        await getFile('main.js', ctx);
    });


    // API
    router.get('/api/test', async (ctx) => {
        ctx.body = JSON.stringify(data);
        ctx.type = 'application/json';
    });

    router.get('/api/house/random', async (ctx) => {
        const randomHouse = data[Math.floor(Math.random() * data.length)];
        ctx.body = JSON.stringify(randomHouse);
        ctx.type = 'application/json';
    });

    router.get('/api/house/:id', async (ctx) => {
        const house = data.find(h => h.id === ctx.params.id);
        if (!house) {
            ctx.status = 404;
            ctx.body = JSON.stringify({ error: 'House not found' });
            return;
        }
        ctx.body = JSON.stringify(house);
        ctx.type = 'application/json';
    });

    router.get('/api/homes/in', async (ctx) => {
        const { nwLat, nwLng, seLat, seLng } = ctx.query;
        if (!nwLat || !nwLng || !seLat || !seLng) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Missing query parameters' });
            return;
        }
        const homes = data.filter(h => {
            // check if any one point is in the box
            return h.geometry.coordinates[0].some(([lat, lng]) => {
                return lat >= seLat && lat <= nwLat && lng >= nwLng && lng <= seLng;
            });
        });

        ctx.body = JSON.stringify(homes);
        ctx.type = 'application/json';
    });


    app.use(router.routes());

    const port = process.env.PORT || 3000;
    app.listen(port);

    console.log(`Server running on port ${port}`);

})();