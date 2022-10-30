import fs from 'node:fs/promises';


(async () => {
    const data = JSON.parse(await fs.readFile('data/results.json', 'utf-8'));

    console.log(`The file contains ${data.features.length} results.`);

    const homes = data.features.filter(f => ['house', 'semidetached_house'].includes(f.properties.tags.building));

    let potentialHomes = data.features.filter(f => ['detached', 'yes'].includes(f.properties.tags.building));

    console.log(`The file contains ${homes.length} homes.`);

    // Filter out anything with one of these tags
    potentialHomes = potentialHomes.filter(f => ['cuisine', 'shop', 'amenity', 'man_made', 'type', 'sport', 'name', 'old_name', 'delivery', 'office', 'golf'].every(tag => !f.properties.tags[tag]));

    console.log(`The file contains ${potentialHomes.length} potential homes.`);

    let final = homes.concat(potentialHomes).map(h => {
        h.geometry.coordinates[0] = h.geometry.coordinates[0].map(c => [c[1], c[0]]);
        return {
            id: h.id.split('/')[1],
            tags: h.properties.tags,
            geometry: h.geometry
        };
    });

    await fs.writeFile('data/final.json', JSON.stringify(final, null, 4));

})();