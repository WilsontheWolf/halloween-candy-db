/* eslint-env browser */
/* global L */

const getHome = async (id) => {
    let req;
    try {
        req = await fetch(`/api/house/${id}`);
    } catch (e) {
        return null;
    }
    if (req.ok) {
        return await req.json();
    }
    return null;
};

const getRandomHome = async () => {
    let req;
    try {
        req = await fetch('/api/house/random');
    } catch (e) {
        return null;
    }
    if (req.ok) {
        return await req.json();
    }
    return null;
};

const loadedPolygons = [];

let map;

const makePolygon = (coords, popup) => {
    if (!map) return;
    const polygon = new L.Polygon(coords, {
        color: 'red',
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.2,
    });
    polygon.addTo(map);
    loadedPolygons.push(polygon);
    if (popup) polygon.bindPopup(popup);
    return polygon;
};

const clearPolygons = () => {
    loadedPolygons.forEach(p => p.remove());
};

const displayRandomHome = async () => {
    const home = await getRandomHome();

    if (!home) return;

    clearPolygons();
    const polygon = makePolygon(home.geometry.coordinates[0], `<h1>${home.id}</h1>`);

    map.fitBounds(polygon.getBounds());

    return home;
};

const displaySpecificHome = async (id) => {
    clearPolygons();
    const home = await getHome(id);

    if (!home) return;

    const polygon = makePolygon(home.geometry.coordinates[0], `<h1>${home.id}</h1>`);

    map.fitBounds(polygon.getBounds());

    return home;
};

const getHomeInBounds = async () => {
    const bounds = map.getBounds();
    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();

    return await fetch(`/api/homes/in?nwLat=${nw.lat}&nwLng=${nw.lng}&seLat=${se.lat}&seLng=${se.lng}`)
        .then(res => {
            if (res.ok) return res.json();
            else return null;
        })
        .catch(console.error);
};

const displayHomesInBounds = async () => {
    const homes = await getHomeInBounds();
    if (!homes) return alert('Error loading homes');

    clearPolygons();
    homes.forEach(home => {
        makePolygon(home.geometry.coordinates[0], `<h1>${home.id}</h1>`);
    });
};


// Wait for dom to load
document.addEventListener('DOMContentLoaded', async () => {
    map = L.map('map').setView([49.6945782, -112.8331033], 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // await displayRandomHome();



    // Handlers

    const randomHomeButton = document.getElementById('random-home');
    const homeIdInput = document.getElementById('home-id');
    const homeIdButton = document.getElementById('home-id-button');
    const homesInBoundsButton = document.getElementById('inbound-homes');

    randomHomeButton.addEventListener('click', async () => {
        const home = await displayRandomHome();

        if (!home) alert('No home found');
    });

    homeIdButton.addEventListener('click', async () => {
        const home = await displaySpecificHome(homeIdInput.value);

        if (!home) alert(`No home found with id ${homeIdInput.value}`);
    });

    homesInBoundsButton.addEventListener('click', async () => {
        const zoom = map.getZoom();
        if(zoom < 15) {
            const ok = confirm('Loading houses in bounds may take a while. Are you sure you want to continue?');
            if (!ok) return;
        }
        await displayHomesInBounds();
    });
});