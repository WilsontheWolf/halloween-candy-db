import fs from 'node:fs/promises';
import koa from 'koa';
import koaRouter from '@koa/router';
import bodyParser from 'koa-bodyparser';
import path from 'node:path';
import Enmap from 'enmap';
import crypto from 'node:crypto';

const homeDB = new Enmap({ name: 'home' });
const tokens = new Enmap({ name: 'token' });
const accounts = new Enmap({ name: 'accounts' });

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
    const data = await fs.readFile(path.join('./src/public', name), 'utf-8');
    const file = path.extname(name).replace('.', '');
    ctx.body = data;
    ctx.type = mimes[file] || 'text/plain';
};

const processHome = (home, submissions, user) => {
    const end = { ...home };

    delete end.tags;
    if (submissions)
        end.submissions = Object.values(submissions);

    if(user && submissions[user]) 
        end.submission = submissions[user];

    return end;
};


/*
Must either be:
{ 
    "candy": true, 
    "candyType": 1, // Number between 0 and 1 
    "candyCount": 1, // Number between 0 and 1
 }

 or 
 {
    "candy": false,
    "noCandyReason": "notHome" | "noCandy"
 }
*/
const validateCandy = (candy) => {
    if(typeof candy.candy !== 'boolean') return false;
    if (candy.candy) {
        if (candy.candyType === undefined || candy.candyCount === undefined)
            return false;
        if (typeof candy.candyType !== 'number' || typeof candy.candyCount !== 'number')
            return false;
        if (candy.candyType < 0 || candy.candyType > 1)
            return false;
        if (candy.candyCount < 0 || candy.candyCount > 1)
            return false;
    } else {
        if (candy.noCandyReason !== 'notHome' && candy.noCandyReason !== 'noCandy')
            return false;
    }
    return true;
};

const genToken = (account) => {
    let token = crypto.randomBytes(32).toString('hex');
    while (tokens.has(token))
        token = crypto.randomBytes(32).toString('hex');

    tokens.set(token, account);
    return token;
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

    router.get('/main.css', async (ctx) => {
        await getFile('main.css', ctx);
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
        ctx.body = JSON.stringify(processHome(randomHouse, submissions, ctx.account));
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
        ctx.body = JSON.stringify(processHome(house, submissions, ctx.account));
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
            return processHome(h, submissions, ctx.account);

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

        const reqData = ctx.request.body;

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

        if (!validateCandy(reqData)) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Invalid candy data' });
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
                const candy = Math.random() > 0.5;
                let obj = { candy };
                if (candy) {
                    obj.candyType = Math.random();
                    obj.candyCount = Math.random();
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

    router.post('/api/register', async (ctx) => {
        const reqData = ctx.request.body;

        if (!reqData) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Missing request data' });
            return;
        }

        let {
            username,
            password,
        } = reqData;

        username = username.trim().toLowerCase();

        if (!username || !password) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Missing request data' });
            return;
        }

        if (username.length < 3 || username.length > 20) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Username must be between 3 and 20 characters' });
            return;
        }

        if (password.length < 8 || password.length > 100) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Password must be between 8 and 100 characters' });
            return;
        }

        if (accounts.get(username)) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Username already taken' }); 
            return;
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

        accounts.set(username, {
            salt,
            hash,
        });

        const token = genToken(username);

        ctx.body = JSON.stringify({ success: true, token });
        ctx.type = 'application/json';
    });

    router.post('/api/login', async (ctx) => {
        const reqData = ctx.request.body;

        if (!reqData) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Missing request data' });
            return;
        }

        let {
            username,
            password,
        } = reqData;

        username = username.trim().toLowerCase();

        if (!username || !password) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Missing request data' });
            return;
        }

        const account = accounts.get(username);

        if (!account) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Invalid username or password' });
            return;
        }

        const hash = crypto.pbkdf2Sync(password, account.salt, 1000, 64, 'sha512').toString('hex');

        if (hash !== account.hash) {
            ctx.status = 400;
            ctx.body = JSON.stringify({ error: 'Invalid username or password' });
            return;
        }

        const token = genToken(username);

        ctx.body = JSON.stringify({ success: true, token });
        ctx.type = 'application/json';
    });

    router.get('/api/me', async (ctx) => {
        const account = ctx.account;

        if (!account) {
            ctx.status = 401;
            ctx.body = JSON.stringify({ error: 'Unauthorized' });
            return;
        }

        ctx.body = JSON.stringify({ success: true, username: account });
        ctx.type = 'application/json';
    });
    

    const handleAuth = async (ctx, next) => {
        const { authorization } = ctx.headers;
        if (!authorization) {
            return await next();
        }

        const account = tokens.get(authorization);
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