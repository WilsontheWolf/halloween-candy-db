import fs from 'node:fs/promises';
import koa from 'koa';
import koaRouter from '@koa/router';
import bodyParser from 'koa-bodyparser';
import path from 'node:path';
import enmap from 'enmap';

const homeDB = new enmap({ name: 'home' });
const tokenDB = new enmap({ name: 'token' });

const allowTesting = process.env.NODE_ENV === 'development';

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

const processHome = (home, submissions) => {
    const end = { ...home };

    delete end.tags;
    if (submissions)
        end.submissions = Object.values(submissions);

    return end;
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
        if (!allowTesting) return ctx.throw(403, 'Testing not allowed');
        ctx.body = JSON.stringify(data);
        ctx.type = 'application/json';
    });

    router.get('/api/house/random', async (ctx) => {
        const randomHouse = data[Math.floor(Math.random() * data.length)];
        const submissions = homeDB.get(randomHouse.id);
        ctx.body = JSON.stringify(processHome(randomHouse, submissions));
        ctx.type = 'application/json';
    });

    router.get('/api/house/:id', async (ctx) => {
        const house = data.find(h => h.id === ctx.params.id);
        if (!house) {
            ctx.status = 404;
            ctx.body = JSON.stringify({ error: 'House not found' });
            return;
        }
        const submissions = homeDB.get(house.id);
        ctx.body = JSON.stringify(processHome(house, submissions));
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

        ctx.body = JSON.stringify(homes.map(h => {
            const submissions = homeDB.get(h.id);
            return processHome(h, submissions);

        }));
        ctx.type = 'application/json';
    });

    router.post('/api/house/:id', async (ctx) => {
        const { id } = ctx.params;

        const house = data.find(h => h.id === id);

        if (!house) {
            ctx.status = 404;
            ctx.body = JSON.stringify({ error: 'House not found' });
            return;
        }
        const account = ctx.account;

        if (!account) {
            ctx.status = 401;
            ctx.body = JSON.stringify({ error: 'Unauthorized' });
            return;
        }

        const reqData = await ctx.request.body;

        if (!reqData) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Missing request data' });
            return;
        }

        const {
            candy,
            noCandyReason,
            candyType,
            candyCount,
        } = reqData;

        if (candy === undefined) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Missing request data' });
            return;
        }


        else if (!candy && ((candyType || candyCount) || !noCandyReason)) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Invalid request data' });
            return;
        }

        else if (candy && !candyType && !candyCount) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Invalid request data' });
            return;
        }

        homeDB.ensure(id, {});

        homeDB.set(id, {
            candy,
            candyType,
            candyCount,
            noCandyReason,
        }, account);

        ctx.body = JSON.stringify({ success: true });
        ctx.type = 'application/json';
    });

    router.get('/api/test/fillAll', async (ctx) => {
        if (!allowTesting) return ctx.throw(403, 'Testing not allowed');
        homeDB.clear();
        for (const house of data) {
            homeDB.ensure(house.id, {});
            for (let i = 0; i < Math.random() * 5; i++) {
                const candy = true; //Math.random() > 0.5;
                let obj = { candy };
                if (candy) {
                    obj.candyType = Math.round(Math.random() * 5);
                    obj.candyCount = Math.round(Math.random() * 5);
                } else {
                    obj.noCandyReason = Math.random() > 0.5 ? 'noCandy' : 'noHome';
                }
                homeDB.set(house.id, obj, i);
            }
        }

        ctx.body = JSON.stringify({ success: true });
        ctx.type = 'application/json';
    });


    router.delete('/api/house/:id', async (ctx) => {
        const { id } = ctx.params;

        const house = data.find(h => h.id === id);

        if (!house) {
            ctx.status = 404;
            ctx.body = JSON.stringify({ error: 'House not found' });
            return;
        }

        const account = ctx.account;

        if (!account) {
            ctx.status = 401;
            ctx.body = JSON.stringify({ error: 'Unauthorized' });
            return;
        }

        homeDB.delete(id, account);

        ctx.body = JSON.stringify({ success: true });
        ctx.type = 'application/json';
    });


    const handleAuth = async (ctx, next) => {
        const { authorization } = ctx.headers;
        if (!authorization) {
            return await next();
        }

        const account = tokenDB.get(authorization);
        if (!account) {
            return await next();
        }

        ctx.account = account;
        await next();
    };


    app.use(handleAuth);
    app.use(bodyParser());
    app.use(router.routes());
    app.use(router.allowedMethods());

    const port = process.env.PORT || 3000;
    app.listen(port);

    console.log(`Server running on port ${port}`);

})();