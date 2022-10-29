import overpass from 'query-overpass';
import { promisify } from 'util';
import fs from 'node:fs/promises';

const queryOverpass = promisify(overpass);
// Get from https://nominatim.openstreetmap.org
let id = parseInt(process.argv[0]) || 4163076; // Relation ID
id += 36e8; // Honestly, I don't know why this is necessary, but it is.

let query = `
[out:json];
area(id:${id})->.searchArea;
(
  way["building"](area.searchArea);
  relation["building"](area.searchArea);
);
out body;
>;
out skel qt;`;

(async () => {
    console.log('Downloading all buildings in the area. This may take a while...');
    let results = await queryOverpass(query)
        .catch(err => {
            console.error(err);
            process.exit(1);
        });

    await fs.writeFile('data/results.json', JSON.stringify(results, null, 4));
    console.log('Downloaded all buildings and saved to results.json. Make sure to run process.js next.');

})();
